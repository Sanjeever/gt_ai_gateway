/**
 * 供应商代理配置集成测试
 *
 * 验证：
 * - HTTP 代理：请求经过 mock proxy → mock AI server，返回成功
 * - 无代理：直接请求 mock AI server，返回成功
 * - 代理不可达：返回失败
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import requestHelper from "../../helpers/requestHelper";
import dbHelper from "../../helpers/dbHelper";


const ROOT_TOKEN = "root-token-123";
const MOCK_PROXY_URL = "http://localhost:9997";
const MOCK_SERVER_URL = "http://localhost:9999";

/**
 * 通过 HTTP 查询 mock proxy 的转发记录
 */
async function getProxyRequests(): Promise<Array<{ method: string; url: string; host: string }>> {
    const resp = await fetch(`${MOCK_PROXY_URL}/_test/requests`);
    return await resp.json() as any;
}

/**
 * 通过 HTTP 清空 mock proxy 的转发记录
 */
async function clearProxyRequests(): Promise<void> {
    await fetch(`${MOCK_PROXY_URL}/_test/requests`, { method: "DELETE" });
}


describe("Vendor Proxy Configuration", () => {
    beforeAll(async () => {
        await dbHelper.truncate();
    });

    beforeEach(async () => {
        await clearProxyRequests();
    });

    it("should test vendor connectivity through HTTP proxy", async () => {
        // 创建走代理的供应商
        const vendor = await requestHelper.post(
            "/vendor/create.json",
            {
                type: "other",
                name: "Proxy Vendor",
                token: "test-token",
                urls: { openai: `${MOCK_SERVER_URL}/v1/chat/completions` },
                config: {
                    proxy: { type: "http", url: MOCK_PROXY_URL },
                },
            },
            ROOT_TOKEN,
        );

        // 测试连通性
        const response = await requestHelper.post(
            `/vendor/${vendor.body.id}/test.json`,
            { format: "openai", model: "gpt-4" },
            ROOT_TOKEN,
        );

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        // 验证请求经过了 mock proxy
        const requests = await getProxyRequests();
        expect(requests.length).toBeGreaterThanOrEqual(1);
    });

    it("should test vendor connectivity without proxy", async () => {
        // 创建不走代理的供应商
        const vendor = await requestHelper.post(
            "/vendor/create.json",
            {
                type: "other",
                name: "Direct Vendor",
                token: "test-token",
                urls: { openai: `${MOCK_SERVER_URL}/v1/chat/completions` },
                config: {},
            },
            ROOT_TOKEN,
        );

        const response = await requestHelper.post(
            `/vendor/${vendor.body.id}/test.json`,
            { format: "openai", model: "gpt-4" },
            ROOT_TOKEN,
        );

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        // 验证请求没有经过 mock proxy
        const requests = await getProxyRequests();
        expect(requests.length).toBe(0);
    });

    it("should return failure when proxy is unreachable", async () => {
        // 创建走不存在代理的供应商
        const vendor = await requestHelper.post(
            "/vendor/create.json",
            {
                type: "other",
                name: "Bad Proxy Vendor",
                token: "test-token",
                urls: { openai: `${MOCK_SERVER_URL}/v1/chat/completions` },
                config: {
                    proxy: { type: "http", url: "http://localhost:19999" },
                },
            },
            ROOT_TOKEN,
        );

        const response = await requestHelper.post(
            `/vendor/${vendor.body.id}/test.json`,
            { format: "openai", model: "gpt-4" },
            ROOT_TOKEN,
        );

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
    });

    it("should update vendor proxy config", async () => {
        // 创建不走代理的供应商
        const vendor = await requestHelper.post(
            "/vendor/create.json",
            {
                type: "other",
                name: "Update Proxy Vendor",
                token: "test-token",
                urls: { openai: `${MOCK_SERVER_URL}/v1/chat/completions` },
                config: {},
            },
            ROOT_TOKEN,
        );

        // 更新为走代理
        await requestHelper.put(
            `/vendor/${vendor.body.id}`,
            {
                config: {
                    proxy: { type: "http", url: MOCK_PROXY_URL },
                },
            },
            ROOT_TOKEN,
        );

        // 测试连通性应该走代理
        const response = await requestHelper.post(
            `/vendor/${vendor.body.id}/test.json`,
            { format: "openai", model: "gpt-4" },
            ROOT_TOKEN,
        );

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        const requests = await getProxyRequests();
        expect(requests.length).toBeGreaterThanOrEqual(1);
    });
});
