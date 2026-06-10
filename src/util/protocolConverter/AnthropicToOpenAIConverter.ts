import { BaseConverter } from "./BaseConverter";
import type {
    AnthropicRequest,
    OpenAIRequest,
    AnthropicResponse,
    OpenAIResponse,
    OpenAIMessage,
    OpenAITool,
    OpenAIChunk,
    ProtocolStreamEvent,
} from "./protocolTypes";

const ANTHROPIC_TO_OPENAI_STOP_REASON: Record<string, string> = {
    end_turn: "stop",
    max_tokens: "length",
    tool_use: "tool_calls",
    stop_sequence: "stop",
};

export class AnthropicToOpenAIConverter extends BaseConverter {
    private currentToolCallIndex = -1;
    private inputTokens = 0;

    public convertRequest(clientReq: AnthropicRequest): OpenAIRequest {
        const messages: OpenAIRequest["messages"] = [];

        if (clientReq.system) {
            let systemContent = "";
            if (typeof clientReq.system === "string") {
                systemContent = clientReq.system;
            } else if (Array.isArray(clientReq.system)) {
                systemContent = clientReq.system.map((s) => s.text).join("\n\n");
            }
            messages.push({ role: "system", content: systemContent });
        }

        for (const msg of clientReq.messages) {
            if (msg.role === "user") {
                if (typeof msg.content === "string") {
                    messages.push({ role: "user", content: msg.content });
                } else if (Array.isArray(msg.content)) {
                    const toolResults = msg.content.filter((b) => b.type === "tool_result");
                    const normalBlocks = msg.content.filter((b) => b.type !== "tool_result");

                    if (normalBlocks.length > 0) {
                        const texts = normalBlocks.map((b) => b.text || "").join("\n");
                        messages.push({ role: "user", content: texts });
                    }

                    for (const tr of toolResults) {
                        messages.push({
                            role: "tool",
                            tool_call_id: tr.tool_use_id,
                            content: typeof tr.content === "string" ? tr.content : JSON.stringify(tr.content),
                        });
                    }
                }
            } else if (msg.role === "assistant") {
                if (typeof msg.content === "string") {
                    messages.push({ role: "assistant", content: msg.content });
                } else if (Array.isArray(msg.content)) {
                    const textBlocks = msg.content.filter((b) => b.type === "text" || b.type === "thinking");
                    const toolUseBlocks = msg.content.filter((b) => b.type === "tool_use");

                    const combinedText = textBlocks
                        .map((b) => {
                            if (b.type === "thinking") return `<thinking>\n${b.thinking}\n</thinking>`;
                            return b.text;
                        })
                        .join("\n");

                    const assistantMsg: OpenAIMessage = {
                        role: "assistant",
                        content: combinedText || null,
                    };

                    if (toolUseBlocks.length > 0) {
                        assistantMsg.tool_calls = toolUseBlocks.map((tu) => ({
                            id: tu.id || `call_${Date.now()}`,
                            type: "function",
                            function: {
                                name: tu.name || "",
                                arguments: JSON.stringify(tu.input || {}),
                            },
                        }));
                    }
                    messages.push(assistantMsg);
                }
            }
        }

        const openaiTools: OpenAITool[] | undefined = clientReq.tools?.map((tool) => ({
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.input_schema,
            },
        }));

        let openaiToolChoice: OpenAIRequest["tool_choice"] = undefined;
        if (clientReq.tool_choice) {
            switch (clientReq.tool_choice.type) {
                case "auto":
                    openaiToolChoice = "auto";
                    break;
                case "any":
                    openaiToolChoice = "required";
                    break;
                case "tool":
                    openaiToolChoice = {
                        type: "function",
                        function: { name: clientReq.tool_choice.name || "" },
                    };
                    break;
            }
        }

        const openaiReq: OpenAIRequest = {
            model: clientReq.model,
            messages,
            max_tokens: clientReq.max_tokens,
            stream: clientReq.stream,
            temperature: clientReq.temperature,
            top_p: clientReq.top_p,
            stop: clientReq.stop_sequences,
        };

        if (openaiTools) {
            openaiReq.tools = openaiTools;
        }
        if (openaiToolChoice) {
            openaiReq.tool_choice = openaiToolChoice;
        }

        return openaiReq;
    }

    public convertResponse(upstreamRes: AnthropicResponse, requestId?: string): OpenAIResponse {
        let textContent = "";
        let reasoningContent: string | undefined = undefined;
        let toolCalls: OpenAIMessage["tool_calls"] = undefined;

        for (const block of upstreamRes.content) {
            if (block.type === "text") {
                textContent += block.text;
            } else if (block.type === "thinking") {
                reasoningContent = (reasoningContent || "") + block.thinking;
            } else if (block.type === "tool_use") {
                if (!toolCalls) toolCalls = [];
                toolCalls.push({
                    id: block.id || `call_${Date.now()}`,
                    type: "function",
                    function: {
                        name: block.name || "",
                        arguments: JSON.stringify(block.input || {}),
                    },
                });
            }
        }

        const finishReason = ANTHROPIC_TO_OPENAI_STOP_REASON[upstreamRes.stop_reason || "end_turn"] || "stop";
        const finalId = requestId || upstreamRes.id;

        return {
            id: finalId.startsWith("chatcmpl-") ? finalId : `chatcmpl-${finalId.replace("msg_", "")}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: upstreamRes.model,
            choices: [
                {
                    index: 0,
                    message: {
                        role: "assistant",
                        content: textContent || null,
                        reasoning_content: reasoningContent,
                        tool_calls: toolCalls,
                    },
                    finish_reason: finishReason as "stop" | "length" | "tool_calls" | "content_filter" | null,
                },
            ],
            usage: {
                prompt_tokens: upstreamRes.usage?.input_tokens || 0,
                completion_tokens: upstreamRes.usage?.output_tokens || 0,
                total_tokens: (upstreamRes.usage?.input_tokens || 0) + (upstreamRes.usage?.output_tokens || 0),
            },
        };
    }

    protected doConvertStreamEvent(data: Record<string, unknown>, rawDataStr: string): ProtocolStreamEvent[] {

        const eventType = data.type as string || "";

        if (eventType === "message_start") {
            const msgStart = data as any;
            const message = msgStart.message;
            if (message?.model) this.updateModel(message.model);
            if (message?.id) {
                this.updateResponseId(message.id.startsWith("chatcmpl-") ? message.id : `chatcmpl-${message.id.replace("msg_", "")}`);
            }
            this.inputTokens = message?.usage?.input_tokens ?? this.inputTokens;

            const chunk: OpenAIChunk = {
                id: this.responseId,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model: this.requestModel,
                choices: [
                    {
                        index: 0,
                        delta: { role: "assistant", content: "" },
                        finish_reason: null,
                    },
                ],
            };
            return [{ data: JSON.stringify(chunk) }];
        }

        if (eventType === "content_block_start") {
            const blockStart = data as any;
            const block = blockStart.content_block;
            if (block.type === "tool_use") {
                this.currentToolCallIndex++;
                const chunk: OpenAIChunk = {
                    id: this.responseId,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: this.requestModel,
                    choices: [
                        {
                            index: 0,
                            delta: {
                                tool_calls: [
                                    {
                                        index: this.currentToolCallIndex,
                                        id: block.id,
                                        type: "function",
                                        function: { name: block.name, arguments: "" },
                                    },
                                ],
                            },
                            finish_reason: null,
                        },
                    ],
                };
                return [{ data: JSON.stringify(chunk) }];
            }
            if (block.type === "thinking") {
                const chunk: OpenAIChunk = {
                    id: this.responseId,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: this.requestModel,
                    choices: [
                        {
                            index: 0,
                            delta: { reasoning_content: "" },
                            finish_reason: null,
                        },
                    ],
                };
                return [{ data: JSON.stringify(chunk) }];
            }
        }

        if (eventType === "content_block_delta") {
            const blockDelta = data as any;
            const delta = blockDelta.delta;

            if (delta.type === "text_delta") {
                const chunk: OpenAIChunk = {
                    id: this.responseId,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: this.requestModel,
                    choices: [
                        {
                            index: 0,
                            delta: { content: delta.text },
                            finish_reason: null,
                        },
                    ],
                };
                return [{ data: JSON.stringify(chunk) }];
            }

            if (delta.type === "thinking_delta") {
                const chunk: OpenAIChunk = {
                    id: this.responseId,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: this.requestModel,
                    choices: [
                        {
                            index: 0,
                            delta: { reasoning_content: delta.thinking },
                            finish_reason: null,
                        },
                    ],
                };
                return [{ data: JSON.stringify(chunk) }];
            }

            if (delta.type === "input_json_delta") {
                const chunk: OpenAIChunk = {
                    id: this.responseId,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: this.requestModel,
                    choices: [
                        {
                            index: 0,
                            delta: {
                                tool_calls: [
                                    {
                                        index: this.currentToolCallIndex,
                                        function: { arguments: delta.partial_json },
                                    },
                                ],
                            },
                            finish_reason: null,
                        },
                    ],
                };
                return [{ data: JSON.stringify(chunk) }];
            }
        }

        if (eventType === "message_delta") {
            const msgDelta = data as any;
            const finishReason = msgDelta.delta?.stop_reason
                ? ANTHROPIC_TO_OPENAI_STOP_REASON[msgDelta.delta.stop_reason] || "stop"
                : null;

            const chunk: OpenAIChunk = {
                id: this.responseId,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model: this.requestModel,
                choices: [
                    {
                        index: 0,
                        delta: {},
                        finish_reason: finishReason,
                    },
                ],
            };

            if (msgDelta.usage) {
                const promptTokens = msgDelta.usage.input_tokens ?? this.inputTokens;
                const completionTokens = msgDelta.usage.output_tokens || 0;
                chunk.usage = {
                    prompt_tokens: promptTokens,
                    completion_tokens: completionTokens,
                    total_tokens: promptTokens + completionTokens,
                };
            }
            return [{ data: JSON.stringify(chunk) }];
        }

        if (eventType === "message_stop") {
            return [{ data: "[DONE]" }];
        }

        return [];
    }
}
