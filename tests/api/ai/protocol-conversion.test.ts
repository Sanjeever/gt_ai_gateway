import { describe, it, expect, beforeAll } from "vitest";
import requestHelper from "../../helpers/requestHelper";
import mockHelper from "../../helpers/mockHelper";
import modelFixtures from "../../fixtures/modelFixtures";
import dbHelper from "../../helpers/dbHelper";
import { setupAdminUser } from "../../globalSetup";
import config from "../../config";

/**
 * Protocol conversion API tests
 */

let testUserId: number;
let testUserToken: string;
let adminToken: string;
let openAIClientModelId: number;
let openAIClientModelName: string;
let anthropicClientModelId: number;
let anthropicClientModelName: string;


describe("AI Protocol Conversion API", () => {
    beforeAll(async () => {
        await dbHelper.truncate();
        adminToken = await setupAdminUser();

        const userResponse = await requestHelper.post(
            "/user/create.json",
            mockHelper.generateUser(),
            adminToken,
        );
        testUserId = userResponse.body.id;
        testUserToken = userResponse.body.token;

        const mockBaseUrl = config.UPSTREAM_CONFIG.mock.url;

        const anthropicOnlyVendor = await requestHelper.post(
            "/vendor/create.json",
            {
                type: "other",
                name: "Mock Anthropic Only Conversion",
                token: "anthropic-conversion-token",
                urls: { anthropic: `${mockBaseUrl}/messages` },
            },
            adminToken,
        );
        openAIClientModelName = `openai-client-anthropic-upstream-${Date.now()}`;
        const openAIClientModel = await requestHelper.post(
            "/model/create.json",
            modelFixtures.createRandomModel(anthropicOnlyVendor.body.id, openAIClientModelName),
            adminToken,
        );
        openAIClientModelId = openAIClientModel.body.id;

        const openAIOnlyVendor = await requestHelper.post(
            "/vendor/create.json",
            {
                type: "other",
                name: "Mock OpenAI Only Conversion",
                token: "openai-conversion-token",
                urls: { openai: `${mockBaseUrl}/chat/completions` },
            },
            adminToken,
        );
        anthropicClientModelName = `anthropic-client-openai-upstream-${Date.now()}`;
        const anthropicClientModel = await requestHelper.post(
            "/model/create.json",
            modelFixtures.createRandomModel(openAIOnlyVendor.body.id, anthropicClientModelName),
            adminToken,
        );
        anthropicClientModelId = anthropicClientModel.body.id;
    });


    it("should convert OpenAI non-stream request to Anthropic upstream and return OpenAI response", async () => {
        const chatRequest = mockHelper.generateOpenAIChatRequest({
            model: openAIClientModelName,
            stream: false,
        });

        const response = await requestHelper.post(
            "/llm/v1/chat/completions",
            chatRequest,
            testUserToken,
        );

        expect(response.status).toBe(200);
        expect(response.body.object).toBe("chat.completion");
        expect(response.body.choices[0].message.role).toBe("assistant");
        expect(response.body.choices[0].message.content).toContain("mock Claude assistant");
        expect(response.body.usage.prompt_tokens).toBeGreaterThan(0);
        expect(response.body.usage.completion_tokens).toBeGreaterThan(0);

        const recordsResponse = await requestHelper.get("/record/latest.json?limit=1", adminToken);
        const record = recordsResponse.body[0];
        expect(record.user_id).toBe(testUserId);
        expect(record.model_id).toBe(openAIClientModelId);
        expect(record.status).toBe("success");

        const responseData = JSON.parse(record.response_data);
        expect(responseData.object).toBe("chat.completion");
        expect(responseData.choices[0].message.content).toBe(response.body.choices[0].message.content);
        expect(responseData.usage.prompt_tokens).toBe(response.body.usage.prompt_tokens);
    }, 30000);


    it("should convert Anthropic non-stream request to OpenAI upstream and return Anthropic response", async () => {
        const messageRequest = mockHelper.generateAnthropicMessageRequest({
            model: anthropicClientModelName,
            stream: false,
        });

        const response = await requestHelper.postWithAnthropicStyleApiKey(
            "/llm/v1/messages",
            messageRequest,
            testUserToken,
        );

        expect(response.status).toBe(200);
        expect(response.body.type).toBe("message");
        expect(response.body.role).toBe("assistant");
        expect(response.body.content[0].type).toBe("text");
        expect(response.body.content[0].text).toContain("mock AI assistant");
        expect(response.body.usage.input_tokens).toBeGreaterThan(0);
        expect(response.body.usage.output_tokens).toBeGreaterThan(0);

        const recordsResponse = await requestHelper.get("/record/latest.json?limit=1", adminToken);
        const record = recordsResponse.body[0];
        expect(record.user_id).toBe(testUserId);
        expect(record.model_id).toBe(anthropicClientModelId);
        expect(record.status).toBe("success");

        const responseData = JSON.parse(record.response_data);
        expect(responseData.type).toBe("message");
        expect(responseData.content[0].text).toBe(response.body.content[0].text);
        expect(responseData.usage.input_tokens).toBe(response.body.usage.input_tokens);
    }, 30000);


    it("should convert OpenAI stream request to Anthropic upstream and return OpenAI SSE", async () => {
        const chatRequest = mockHelper.generateOpenAIChatRequest({
            model: openAIClientModelName,
            stream: true,
        });

        const response = await requestHelper.post(
            "/llm/v1/chat/completions",
            chatRequest,
            testUserToken,
        );

        expect(response.status).toBe(200);
        expect(typeof response.body).toBe("string");
        expect(response.body).toContain("chat.completion.chunk");
        expect(response.body).toContain("[DONE]");
        expect(response.body).not.toContain("message_start");

        const recordsResponse = await requestHelper.get("/record/latest.json?limit=1", adminToken);
        const record = recordsResponse.body[0];
        expect(record.user_id).toBe(testUserId);
        expect(record.model_id).toBe(openAIClientModelId);
        expect(record.status).toBe("success");
        expect(record.prompt_tokens).toBeGreaterThan(0);
        expect(record.output_tokens).toBeGreaterThan(0);

        const responseData = JSON.parse(record.response_data);
        expect(responseData.choices[0].message.role).toBe("assistant");
        expect(responseData.choices[0].message.content).toContain("mock Claude assistant");
        expect(responseData.usage.prompt_tokens).toBeGreaterThan(0);
    }, 30000);


    it("should convert Anthropic stream request to OpenAI upstream and return Anthropic SSE", async () => {
        const messageRequest = mockHelper.generateAnthropicMessageRequest({
            model: anthropicClientModelName,
            stream: true,
        });

        const response = await requestHelper.postWithAnthropicStyleApiKey(
            "/llm/v1/messages",
            messageRequest,
            testUserToken,
        );

        expect(response.status).toBe(200);
        expect(typeof response.body).toBe("string");
        expect(response.body).toContain("event: message_start");
        expect(response.body).toContain("event: content_block_delta");
        expect(response.body).toContain("event: message_stop");
        expect(response.body).not.toContain("[DONE]");

        const recordsResponse = await requestHelper.get("/record/latest.json?limit=1", adminToken);
        const record = recordsResponse.body[0];
        expect(record.user_id).toBe(testUserId);
        expect(record.model_id).toBe(anthropicClientModelId);
        expect(record.status).toBe("success");
        expect(record.prompt_tokens).toBeGreaterThan(0);
        expect(record.output_tokens).toBeGreaterThan(0);

        const responseData = JSON.parse(record.response_data);
        expect(responseData.choices[0].message.role).toBe("assistant");
        expect(responseData.choices[0].message.content).toContain("mock AI assistant");
        expect(responseData.usage.prompt_tokens).toBeGreaterThan(0);
    }, 30000);
});
