import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import requestHelper from "../../helpers/requestHelper";
import mockHelper from "../../helpers/mockHelper";
import modelFixtures from "../../fixtures/modelFixtures";
import dbHelper from "../../helpers/dbHelper";
import { setupAdminUser } from "../../globalSetup";
import config from "../../config";
import streamLogHelper from "../../helpers/streamLogHelper";

interface ResponsesFixture {
    adminToken: string;
    testUserToken: string;
    responsesModelName: string;
}

const describeWithStreamLog = process.env.STREAM_LOG_ENABLED === "true" ? describe : describe.skip;


function createUniqueInput(prefix: string): string {
    return `${prefix}-${randomUUID()}`;
}


async function setupResponsesFixture(): Promise<ResponsesFixture> {
    await dbHelper.truncate();
    const adminToken = await setupAdminUser();

    const userResponse = await requestHelper.post(
        "/user/create.json",
        mockHelper.generateUser(),
        adminToken,
    );

    const vendorResponse = await requestHelper.post(
        "/vendor/create.json",
        {
            type: "other",
            name: "Mock Responses Log Vendor",
            token: "mock-responses-log-token",
            urls: { openai: config.UPSTREAM_CONFIG.mock.url },
        },
        adminToken,
    );

    const responsesModelName = `responses-log-model-${Date.now()}`;
    await requestHelper.post(
        "/model/create.json",
        modelFixtures.createRandomModel(vendorResponse.body.id, responsesModelName),
        adminToken,
    );

    return {
        adminToken,
        testUserToken: userResponse.body.token,
        responsesModelName,
    };
}


async function getLatestRecord(adminToken: string): Promise<any> {
    const recordsResponse = await requestHelper.get(
        "/record/latest.json?limit=1",
        adminToken,
    );

    expect(recordsResponse.status).toBe(200);
    expect(recordsResponse.body[0]).toBeDefined();
    return recordsResponse.body[0];
}


describeWithStreamLog("AI Responses API Node stream logs", () => {
    let fixture: ResponsesFixture;

    beforeEach(async () => {
        fixture = await setupResponsesFixture();
    });

    it("should write non-streaming request logs", async () => {
        const input = createUniqueInput("responses-node-non-stream");
        const req = mockHelper.generateResponsesRequest({
            model: fixture.responsesModelName,
            input,
            stream: false,
        });

        const response = await requestHelper.post(
            "/llm/v1/responses",
            req,
            fixture.testUserToken,
        );

        expect(response.status).toBe(200);

        const record = await getLatestRecord(fixture.adminToken);
        const requestLog = await streamLogHelper.readRequestLog(record.id);
        const upstreamReq = JSON.parse(requestLog);

        expect(upstreamReq.model).toBe(fixture.responsesModelName);
        expect(upstreamReq.input).toBe(input);
        expect(upstreamReq.stream).toBe(false);
    }, 30000);

    it("should write streaming response and request logs", async () => {
        const input = createUniqueInput("responses-node-stream");
        const req = mockHelper.generateResponsesRequest({
            model: fixture.responsesModelName,
            input,
            stream: true,
        });

        const response = await requestHelper.post(
            "/llm/v1/responses",
            req,
            fixture.testUserToken,
        );

        expect(response.status).toBe(200);
        expect(typeof response.body).toBe("string");

        const record = await getLatestRecord(fixture.adminToken);
        const streamLog = await streamLogHelper.readStreamLog(record.id);
        expect(streamLog).toContain("response.created");
        expect(streamLog).toContain("response.output_text.delta");
        expect(streamLog).toContain("response.completed");

        const requestLog = await streamLogHelper.readRequestLog(record.id);
        const upstreamReq = JSON.parse(requestLog);
        expect(upstreamReq.model).toBe(fixture.responsesModelName);
        expect(upstreamReq.input).toBe(input);
        expect(upstreamReq.stream).toBe(true);
    }, 30000);
});
