import configService, { ConfigKey } from "./configService";
import { rewriteCchInSystemPrompt } from "../plugin/cchRewriter";
import { injectResponsesPromptCacheKey } from "../plugin/responsesPromptCacheKeyRewriter";
import { removeClaudeCodeTrackingMarker } from "../plugin/claudeCodeTrackingRewriter";
import { ApiFormat } from "../constants";

class PluginService {
    public async applyRequestPlugins(
        upstreamBody: string,
        currentFormat: ApiFormat,
        hostKey: string,
        clientName: string | null | undefined
    ): Promise<string> {
        let body = upstreamBody;

        // Apply plugins based on format
        if (currentFormat === ApiFormat.ANTHROPIC) {
            // 1. Claude Code Tracking Marker Removal
            const trackingRewriteEnabled = (await configService.getConfig(ConfigKey.CLAUDE_CODE_TRACKING_REWRITE_ENABLED, "true")).getBoolean();
            if (trackingRewriteEnabled) {
                body = removeClaudeCodeTrackingMarker(body);
            }

            // 2. CCH Rewrite
            const cchRewriteEnabled = (await configService.getConfig(ConfigKey.CCH_REWRITE_ENABLED, "true")).getBoolean();
            if (cchRewriteEnabled) {
                body = rewriteCchInSystemPrompt(body);
            }
        }

        if (currentFormat === ApiFormat.RESPONSES) {
            // 3. Responses API Prompt Cache Key Injection
            const responsesPromptCacheKeyEnabled = (await configService.getConfig(ConfigKey.RESPONSES_PROMPT_CACHE_KEY_ENABLED, "true")).getBoolean();
            if (responsesPromptCacheKeyEnabled) {
                body = injectResponsesPromptCacheKey(body, hostKey, clientName);
            }
        }

        return body;
    }
}

export const pluginService = new PluginService();
export default pluginService;
