import { describe, it, expect } from "vitest";
import requestHelper from "../../helpers/requestHelper";

const ROOT_TOKEN = "root-token-123";

describe("Config API", () => {
    it("should return advanced config with cch rewrite disabled by default", async () => {
        const response = await requestHelper.get("/config.json", ROOT_TOKEN);

        expect(response.body).toBeDefined();
        expect(response.body.cch_rewrite_enabled).toBe(false);
    });

    it("should update config values and return updated config", async () => {
        const updateResponse = await requestHelper.put(
            "/config.json",
            { 
                cch_rewrite_enabled: true,
            },
            ROOT_TOKEN,
        );

        expect(updateResponse.status).toBe(200);
        expect(updateResponse.body.cch_rewrite_enabled).toBe(true);

        // Verify it persists by getting it again
        const getResponse = await requestHelper.get("/config.json", ROOT_TOKEN);
        expect(getResponse.status).toBe(200);
        expect(getResponse.body.cch_rewrite_enabled).toBe(true);
    });
});
