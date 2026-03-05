/**
 * SSE 消息累加器
 * 用于累积流式 AI 响应，生成完整的响应对象
 */

interface SSEMessage {
    id?: string;
    object?: string;
    created?: number;
    model?: string;
    choices?: Array<{
        index?: number;
        delta?: {
            role?: string;
            content?: string;
        };
        finish_reason?: string | null;
    }>;
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
    };
}

/**
 * Anthropic 格式的 SSE 消息
 */
interface AnthropicSSEMessage {
    type?: string;
    message?: {
        id?: string;
        type?: string;
        role?: string;
        content?: any[];
        model?: string;
        stop_reason?: string | null;
        usage?: {
            input_tokens?: number;
            output_tokens?: number;
        };
    };
    usage?: {
        input_tokens?: number;
        output_tokens?: number;
    };
    delta?: {
        text?: string;
    };
    index?: number;
}

interface AccumulatedResponse {
    id?: string;
    object?: string;
    created?: number;
    model?: string;
    choices: Array<{
        index: number;
        message: {
            role?: string;
            content: string;
        };
        finish_reason: string | null;
    }>;
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
    };
}

type SSEFormat = 'openai' | 'anthropic';

class SSEAccumulator {
    private format: SSEFormat;
    private response: AccumulatedResponse = {
        choices: [{ index: 0, message: { content: "" }, finish_reason: null }],
    };

    constructor(format: SSEFormat = 'openai') {
        this.format = format;
    }

    /**
     * 添加一条 SSE 消息
     * @param msg - SSE 消息对象
     */
    addMessage(msg: SSEMessage | AnthropicSSEMessage): void {
        if (this.format === 'anthropic') {
            this.handleAnthropicMessage(msg as AnthropicSSEMessage);
        } else {
            this.handleOpenAIMessage(msg as SSEMessage);
        }
    }

    /**
     * 处理 OpenAI 格式的消息
     */
    private handleOpenAIMessage(msg: SSEMessage): void {
        // 保存基本信息（只保存一次）
        if (msg.id) this.response.id = msg.id;
        if (msg.object) this.response.object = msg.object;
        if (msg.created) this.response.created = msg.created;
        if (msg.model) this.response.model = msg.model;

        // 处理 choices
        if (msg.choices) {
            for (const choice of msg.choices) {
                const index = choice.index ?? 0;

                // 确保 choices 数组足够大
                while (this.response.choices.length <= index) {
                    this.response.choices.push({
                        index: this.response.choices.length,
                        message: { content: "" },
                        finish_reason: null,
                    });
                }

                // 累积内容
                if (choice.delta?.content) {
                    this.response.choices[index].message.content +=
                        choice.delta.content;
                }

                // 保存 role
                if (choice.delta?.role) {
                    this.response.choices[index].message.role =
                        choice.delta.role;
                }

                // 更新 finish_reason
                if (choice.finish_reason !== undefined) {
                    this.response.choices[index].finish_reason =
                        choice.finish_reason;
                }
            }
        }

        // 保存 usage 信息（最后一个消息中才包含）
        if (msg.usage) {
            this.response.usage = msg.usage;
        }
    }

    /**
     * 处理 Anthropic 格式的消息
     */
    private handleAnthropicMessage(msg: AnthropicSSEMessage): void {
        // 保存基本信息
        if (msg.message?.id) this.response.id = msg.message.id;
        if (msg.message?.model) this.response.model = msg.message.model;
        if (msg.message?.role) this.response.choices[0].message.role = msg.message.role;
        if (msg.message?.stop_reason !== undefined) {
            this.response.choices[0].finish_reason = msg.message.stop_reason;
        }
        // Handle usage from message_start or message_stop events
        if (msg.message?.usage || msg.usage) {
            const usage = msg.usage || msg.message?.usage;
            this.response.usage = {
                prompt_tokens: usage.input_tokens,
                completion_tokens: usage.output_tokens,
                total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
            };
        }
        // 累积文本内容
        if (msg.delta?.text) {
            this.response.choices[0].message.content += msg.delta.text;
        }
    }

    /**
     * 获取累积的完整响应
     * @returns 完整的响应对象
     */
    getResponse(): AccumulatedResponse {
        return this.response;
    }

    /**
     * 获取累积的文本内容
     * @returns 文本内容
     */
    getText(): string {
        return this.response.choices[0]?.message.content ?? "";
    }

    /**
     * 重置累加器
     */
    reset(): void {
        this.response = {
            choices: [
                { index: 0, message: { content: "" }, finish_reason: null },
            ],
        };
    }
}

export default {
    SSEAccumulator,
};
