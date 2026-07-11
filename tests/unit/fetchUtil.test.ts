import { describe, it, expect } from "vitest";
import fetchUtil from "../../src/util/fetchUtil";

describe("fetchUtil.getDispatcher", () => {
    it("returns undefined when no config provided", async () => {
        const dispatcher = await fetchUtil.getDispatcher();
        expect(dispatcher).toBeUndefined();
    });

    it("returns undefined when skip_tls_verify is false and no proxy", async () => {
        const dispatcher = await fetchUtil.getDispatcher({ skip_tls_verify: false });
        expect(dispatcher).toBeUndefined();
    });

    it("returns an Agent when skip_tls_verify is true", async () => {
        const dispatcher = await fetchUtil.getDispatcher({ skip_tls_verify: true });
        expect(dispatcher).toBeDefined();
        // undici Agent 实例特征：有 dispatch / close / destroy 等方法
        expect(typeof (dispatcher as any).dispatch).toBe("function");
    });

    it("reuses the same Agent instance on multiple calls", async () => {
        const d1 = await fetchUtil.getDispatcher({ skip_tls_verify: true });
        const d2 = await fetchUtil.getDispatcher({ skip_tls_verify: true });
        expect(d1).toBe(d2);
    });
});
