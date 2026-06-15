import { describe, it, expect, beforeAll } from "vitest";
import { fetch } from "undici";
import requestHelper from "../../helpers/requestHelper";
import mockHelper from "../../helpers/mockHelper";
import dbHelper from "../../helpers/dbHelper";
import { setupAdminUser } from "../../globalSetup";
import config from "../../config";

/**
 * Stream Failure Handling Tests
 *
 * Verifies that failed_code is correctly set when a streaming request ends abnormally:
 * - stream_incomplete: upstream closed without [DONE] / message_stop / response.completed
 * - upstream_disconnected: upstream destroyed the TCP socket mid-stream
 */

const MOCK_BASE = config.UPSTREAM_CONFIG.mock.url; // e.g. http://localhost:9999

let testUserToken: string;
let adminToken: string;

// Vendor and model IDs for each failure scenario
let openaiIncompleteModelName: string;
let openaiDisconnectModelName: string;
let anthropicIncompleteModelName: string;
let responsesIncompleteModelName: string;

// Slow vendors/models for client_disconnected tests
let openaiSlowModelName: string;
let anthropicSlowModelName: string;
let responsesSlowModelName: string;


describe("Stream Failure Handling", () => {
    beforeAll(async () => {
        await dbHelper.truncate();
        adminToken = await setupAdminUser();

        const userResponse = await requestHelper.post(
            "/user/create.json",
            mockHelper.generateUser(),
            adminToken,
        );
        testUserToken = userResponse.body.token;

        // --- OpenAI stream_incomplete vendor/model ---
        const openaiIncompleteVendor = await requestHelper.post(
            "/vendor/create.json",
            {
                type: "other",
                name: "Mock OpenAI Incomplete",
                token: "test-token",
                urls: { openai: `${MOCK_BASE}/chat/completions/incomplete` },
            },
            adminToken,
        );
        openaiIncompleteModelName = `openai-incomplete-${Date.now()}`;
        await requestHelper.post(
            "/model/create.json",
            { name: openaiIncompleteModelName, vendor_id: openaiIncompleteVendor.body.id, enable: true },
            adminToken,
        );

        // --- OpenAI upstream_disconnected vendor/model ---
        const openaiDisconnectVendor = await requestHelper.post(
            "/vendor/create.json",
            {
                type: "other",
                name: "Mock OpenAI Disconnect",
                token: "test-token",
                urls: { openai: `${MOCK_BASE}/chat/completions/disconnect` },
            },
            adminToken,
        );
        openaiDisconnectModelName = `openai-disconnect-${Date.now()}`;
        await requestHelper.post(
            "/model/create.json",
            { name: openaiDisconnectModelName, vendor_id: openaiDisconnectVendor.body.id, enable: true },
            adminToken,
        );

        // --- Anthropic stream_incomplete vendor/model ---
        const anthropicIncompleteVendor = await requestHelper.post(
            "/vendor/create.json",
            {
                type: "other",
                name: "Mock Anthropic Incomplete",
                token: "test-token",
                urls: { anthropic: `${MOCK_BASE}/messages/incomplete` },
            },
            adminToken,
        );
        anthropicIncompleteModelName = `anthropic-incomplete-${Date.now()}`;
        await requestHelper.post(
            "/model/create.json",
            { name: anthropicIncompleteModelName, vendor_id: anthropicIncompleteVendor.body.id, enable: true },
            adminToken,
        );

        // --- Responses API stream_incomplete vendor/model ---
        const responsesIncompleteVendor = await requestHelper.post(
            "/vendor/create.json",
            {
                type: "other",
                name: "Mock Responses Incomplete",
                token: "test-token",
                urls: { responses: `${MOCK_BASE}/responses/incomplete` },
            },
            adminToken,
        );
        responsesIncompleteModelName = `responses-incomplete-${Date.now()}`;
        await requestHelper.post(
            "/model/create.json",
            { name: responsesIncompleteModelName, vendor_id: responsesIncompleteVendor.body.id, enable: true },
            adminToken,
        );

        // --- OpenAI slow vendor/model (for client_disconnected tests) ---
        const openaiSlowVendor = await requestHelper.post(
            "/vendor/create.json",
            {
                type: "other",
                name: "Mock OpenAI Slow",
                token: "test-token",
                urls: { openai: `${MOCK_BASE}/chat/completions/slow` },
            },
            adminToken,
        );
        openaiSlowModelName = `openai-slow-${Date.now()}`;
        await requestHelper.post(
            "/model/create.json",
            { name: openaiSlowModelName, vendor_id: openaiSlowVendor.body.id, enable: true },
            adminToken,
        );

        // --- Anthropic slow vendor/model ---
        const anthropicSlowVendor = await requestHelper.post(
            "/vendor/create.json",
            {
                type: "other",
                name: "Mock Anthropic Slow",
                token: "test-token",
                urls: { anthropic: `${MOCK_BASE}/messages/slow` },
            },
            adminToken,
        );
        anthropicSlowModelName = `anthropic-slow-${Date.now()}`;
        await requestHelper.post(
            "/model/create.json",
            { name: anthropicSlowModelName, vendor_id: anthropicSlowVendor.body.id, enable: true },
            adminToken,
        );

        // --- Responses API slow vendor/model ---
        const responsesSlowVendor = await requestHelper.post(
            "/vendor/create.json",
            {
                type: "other",
                name: "Mock Responses Slow",
                token: "test-token",
                urls: { responses: `${MOCK_BASE}/responses/slow` },
            },
            adminToken,
        );
        responsesSlowModelName = `responses-slow-${Date.now()}`;
        await requestHelper.post(
            "/model/create.json",
            { name: responsesSlowModelName, vendor_id: responsesSlowVendor.body.id, enable: true },
            adminToken,
        );
    });


    describe("OpenAI /llm/v1/chat/completions", () => {
        it("should set failed_code=stream_incomplete when upstream closes without [DONE]", async () => {
            await requestHelper.post(
                "/llm/v1/chat/completions",
                { model: openaiIncompleteModelName, messages: [{ role: "user", content: "hi" }], stream: true },
                testUserToken,
            );

            const recordRes = await requestHelper.get("/record/latest.json?limit=1", adminToken);
            const record = recordRes.body[0];

            expect(record.status).toBe("failed");
            expect(record.failed_code).toBe("stream_incomplete");
        }, 15000);

        it("should set failed_code=upstream_disconnected when upstream destroys socket mid-stream", async () => {
            await requestHelper.post(
                "/llm/v1/chat/completions",
                { model: openaiDisconnectModelName, messages: [{ role: "user", content: "hi" }], stream: true },
                testUserToken,
            );

            const recordRes = await requestHelper.get("/record/latest.json?limit=1", adminToken);
            const record = recordRes.body[0];

            expect(record.status).toBe("failed");
            expect(record.failed_code).toBe("upstream_disconnected");
        }, 15000);

        it("should have null failed_code on successful stream", async () => {
            const upstreamConfig = config.getCurrentUpstreamConfig();
            const vendor = await requestHelper.post(
                "/vendor/create.json",
                {
                    type: "other",
                    name: "Mock OpenAI OK",
                    token: "test-token",
                    urls: { openai: upstreamConfig.openai.url },
                },
                adminToken,
            );
            const modelName = `openai-ok-${Date.now()}`;
            await requestHelper.post(
                "/model/create.json",
                { name: modelName, vendor_id: vendor.body.id, enable: true },
                adminToken,
            );

            await requestHelper.post(
                "/llm/v1/chat/completions",
                { model: modelName, messages: [{ role: "user", content: "hi" }], stream: true },
                testUserToken,
            );

            const recordRes = await requestHelper.get("/record/latest.json?limit=1", adminToken);
            const record = recordRes.body[0];

            expect(record.status).toBe("success");
            expect(record.failed_code).toBeNull();
        }, 15000);
    });


    describe("Anthropic /llm/v1/messages", () => {
        it("should set failed_code=stream_incomplete when upstream closes without message_stop", async () => {
            await requestHelper.post(
                "/llm/v1/messages",
                {
                    model: anthropicIncompleteModelName,
                    messages: [{ role: "user", content: "hi" }],
                    stream: true,
                    max_tokens: 100,
                },
                testUserToken,
            );

            const recordRes = await requestHelper.get("/record/latest.json?limit=1", adminToken);
            const record = recordRes.body[0];

            expect(record.status).toBe("failed");
            expect(record.failed_code).toBe("stream_incomplete");
        }, 15000);
    });


    describe("Responses API /llm/v1/responses", () => {
        it("should set failed_code=stream_incomplete when upstream closes without response.completed", async () => {
            await requestHelper.post(
                "/llm/v1/responses",
                { model: responsesIncompleteModelName, input: "hi", stream: true },
                testUserToken,
            );

            const recordRes = await requestHelper.get("/record/latest.json?limit=1", adminToken);
            const record = recordRes.body[0];

            expect(record.status).toBe("failed");
            expect(record.failed_code).toBe("stream_incomplete");
        }, 15000);
    });


    describe("Client disconnect — upstream still running", () => {
        async function abortStreamAfterFirstChunk(
            endpoint: string,
            body: object,
        ): Promise<void> {
            const baseUrl = config.SERVER_CONFIG.baseUrl;
            const ac = new AbortController();

            const response = await fetch(`${baseUrl}${endpoint}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${testUserToken}`,
                },
                body: JSON.stringify(body),
                signal: ac.signal,
            } as any);

            const reader = (response.body as any).getReader();
            // Read at least one chunk to confirm the stream started
            await reader.read();
            // Abort the client connection while upstream is still hanging
            ac.abort();
            reader.cancel().catch(() => {});

            // Give the gateway time to detect the disconnect and update the record
            await new Promise((resolve) => setTimeout(resolve, 800));
        }

        it("should set failed_code=client_disconnected for OpenAI /llm/v1/chat/completions", async () => {
            await abortStreamAfterFirstChunk("/llm/v1/chat/completions", {
                model: openaiSlowModelName,
                messages: [{ role: "user", content: "hi" }],
                stream: true,
            });

            const recordRes = await requestHelper.get("/record/latest.json?limit=1", adminToken);
            const record = recordRes.body[0];

            expect(record.status).toBe("failed");
            expect(record.failed_code).toBe("client_disconnected");
        }, 15000);

        it("should set failed_code=client_disconnected for Anthropic /llm/v1/messages", async () => {
            await abortStreamAfterFirstChunk("/llm/v1/messages", {
                model: anthropicSlowModelName,
                messages: [{ role: "user", content: "hi" }],
                stream: true,
                max_tokens: 100,
            });

            const recordRes = await requestHelper.get("/record/latest.json?limit=1", adminToken);
            const record = recordRes.body[0];

            expect(record.status).toBe("failed");
            expect(record.failed_code).toBe("client_disconnected");
        }, 15000);

        it("should set failed_code=client_disconnected for Responses /llm/v1/responses", async () => {
            await abortStreamAfterFirstChunk("/llm/v1/responses", {
                model: responsesSlowModelName,
                input: "hi",
                stream: true,
            });

            const recordRes = await requestHelper.get("/record/latest.json?limit=1", adminToken);
            const record = recordRes.body[0];

            expect(record.status).toBe("failed");
            expect(record.failed_code).toBe("client_disconnected");
        }, 15000);
    });
});
