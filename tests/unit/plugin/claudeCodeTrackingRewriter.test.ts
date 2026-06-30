import { describe, it, expect } from "vitest";
import { removeClaudeCodeTrackingMarker } from "../../../src/plugin/claudeCodeTrackingRewriter";

describe("claudeCodeTrackingRewriter", () => {
    it("should rewrite slashed dates and standard apostrophe within # currentDate block in string system", () => {
        const body = {
            system: "# currentDate\nToday's date is 2026/06/30.\n\nSome other instructions."
        };
        const result = JSON.parse(removeClaudeCodeTrackingMarker(JSON.stringify(body)));
        expect(result.system).toContain("Today's date is 2026-06-30.");
        expect(result.system).not.toContain("2026/06/30");
    });

    it("should rewrite \u2019 (right single quote) apostrophe variant", () => {
        const body = {
            system: "# currentDate\nToday\u2019s date is 2026/06/30.\n"
        };
        const result = JSON.parse(removeClaudeCodeTrackingMarker(JSON.stringify(body)));
        expect(result.system).toBe("# currentDate\nToday's date is 2026-06-30.\n");
    });

    it("should rewrite \u02BC (modifier apostrophe) variant", () => {
        const body = {
            system: "# currentDate\nToday\u02BCs date is 2026/06/30.\n"
        };
        const result = JSON.parse(removeClaudeCodeTrackingMarker(JSON.stringify(body)));
        expect(result.system).toBe("# currentDate\nToday's date is 2026-06-30.\n");
    });

    it("should rewrite \u02B9 (modifier prime) variant", () => {
        const body = {
            system: "# currentDate\r\nToday\u02B9s date is 2026/06/30.\r\n"
        };
        const result = JSON.parse(removeClaudeCodeTrackingMarker(JSON.stringify(body)));
        expect(result.system).toBe("# currentDate\r\nToday's date is 2026-06-30.\r\n");
    });

    it("should rewrite in array system format", () => {
        const body = {
            system: [
                { type: "text", text: "Instruction 1" },
                { type: "text", text: "Some prefix...\n# currentDate\nToday\u2019s date is 2026/06/30.\nMore text..." }
            ]
        };
        const result = JSON.parse(removeClaudeCodeTrackingMarker(JSON.stringify(body)));
        expect(result.system[1].text).toContain("Today's date is 2026-06-30.");
        expect(result.system[1].text).not.toContain("Today\u2019s date is 2026/06/30.");
    });

    it("should NOT rewrite when the marker appears outside of the # currentDate block", () => {
        const body = {
            system: "The user said: Today\u2019s date is 2026/06/30. What do you think?"
        };
        const originalStr = JSON.stringify(body);
        const result = removeClaudeCodeTrackingMarker(originalStr);
        expect(result).toBe(originalStr);
    });

    it("should NOT rewrite when system is an array and marker appears outside the block", () => {
        const body = {
            system: [
                { type: "text", text: "Today's date is 2026/06/30." }
            ]
        };
        const originalStr = JSON.stringify(body);
        const result = removeClaudeCodeTrackingMarker(originalStr);
        expect(result).toBe(originalStr);
    });

    it("should ignore invalid JSON", () => {
        const invalidJson = "{ invalid }";
        const result = removeClaudeCodeTrackingMarker(invalidJson);
        expect(result).toBe(invalidJson);
    });

    it("should ignore requests without a system field", () => {
        const body = { messages: [{ role: "user", content: "Today\u2019s date is 2026/06/30." }] };
        const originalStr = JSON.stringify(body);
        const result = removeClaudeCodeTrackingMarker(originalStr);
        expect(result).toBe(originalStr);
    });
});
