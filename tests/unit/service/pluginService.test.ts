import { describe, it, expect, vi, beforeEach } from "vitest";
import pluginService from "../../../src/service/pluginService";
import configService, { ConfigItem } from "../../../src/service/configService";
import { ApiFormat } from "../../../src/constants";

describe("pluginService", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("should apply Anthropic plugins when format is ANTHROPIC and enabled", async () => {
        vi.spyOn(configService, "getConfig").mockResolvedValue(new ConfigItem("true", "true"));

        const body = {
            system: "x-anthropic-billing-header: cch=old;\n# currentDate\nToday's date is 2026/06/30.\n"
        };
        const resultStr = await pluginService.applyRequestPlugins(
            JSON.stringify(body),
            ApiFormat.ANTHROPIC,
            "host-key",
            "client"
        );
        const result = JSON.parse(resultStr);

        expect(result.system).toContain("cch=A1234;");
        expect(result.system).toContain("Today's date is 2026-06-30.");
        expect(result.system).not.toContain("2026/06/30.");
        expect(result.prompt_cache_key).toBeUndefined();
    });

    it("should NOT apply Anthropic plugins when format is ANTHROPIC but disabled", async () => {
        vi.spyOn(configService, "getConfig").mockResolvedValue(new ConfigItem("false", "true"));

        const body = {
            system: "x-anthropic-billing-header: cch=old;\n# currentDate\nToday's date is 2026/06/30.\n"
        };
        const originalStr = JSON.stringify(body);
        const resultStr = await pluginService.applyRequestPlugins(
            originalStr,
            ApiFormat.ANTHROPIC,
            "host-key",
            "client"
        );

        expect(resultStr).toBe(originalStr);
    });

    it("should apply Responses API plugins when format is RESPONSES and enabled", async () => {
        vi.spyOn(configService, "getConfig").mockResolvedValue(new ConfigItem("true", "true"));

        const body = {
            model: "gpt-4"
        };
        const resultStr = await pluginService.applyRequestPlugins(
            JSON.stringify(body),
            ApiFormat.RESPONSES,
            "abc12345",
            "Codex"
        );
        const result = JSON.parse(resultStr);

        expect(result.prompt_cache_key).toBe("abc12345:Codex");
        expect(result.system).toBeUndefined();
    });

    it("should NOT apply Responses API plugins when format is RESPONSES but disabled", async () => {
        vi.spyOn(configService, "getConfig").mockResolvedValue(new ConfigItem("false", "true"));

        const body = {
            model: "gpt-4"
        };
        const originalStr = JSON.stringify(body);
        const resultStr = await pluginService.applyRequestPlugins(
            originalStr,
            ApiFormat.RESPONSES,
            "abc12345",
            "Codex"
        );

        expect(resultStr).toBe(originalStr);
    });
});
