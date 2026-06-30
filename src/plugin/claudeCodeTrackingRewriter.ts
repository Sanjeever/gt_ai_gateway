export function removeClaudeCodeTrackingMarker(upstreamBody: string): string {
    try {
        const bodyJson = JSON.parse(upstreamBody);
        if (!bodyJson.system) return upstreamBody;

        let modified = false;
        // Match the specific block injected by Claude Code tracking
        const trackingRegex = /(# currentDate\r?\n)Today(?:'|\u2019|\u02BC|\u02B9)s date is (\d{4})[/-](\d{2})[/-](\d{2})\.(\r?\n)/g;
        
        if (typeof bodyJson.system === "string") {
            const originalSystem = bodyJson.system;
            bodyJson.system = bodyJson.system.replace(trackingRegex, "$1Today's date is $2-$3-$4.$5");
            modified = bodyJson.system !== originalSystem;
        } else if (Array.isArray(bodyJson.system)) {
            for (const block of bodyJson.system) {
                if (block.type === "text" && typeof block.text === "string") {
                    const originalText = block.text;
                    block.text = block.text.replace(trackingRegex, "$1Today's date is $2-$3-$4.$5");
                    if (block.text !== originalText) {
                        modified = true;
                    }
                }
            }
        }

        if (modified) {
            console.log("[claudeCodeTrackingRewriter] Removed Claude Code tracking marker from system prompt");
            return JSON.stringify(bodyJson);
        }
    } catch (e) {
        console.log("[claudeCodeTrackingRewriter] Failed to process tracking marker:", e);
    }
    return upstreamBody;
}
