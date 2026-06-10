import { ApiFormat } from "../../constants";
import { BaseConverter } from "./BaseConverter";
import { AnthropicToOpenAIConverter } from "./AnthropicToOpenAIConverter";
import { OpenAIToAnthropicConverter } from "./OpenAIToAnthropicConverter";
import { ProtocolPairConverter } from "./ProtocolPairConverter";

export class ConverterFactory {
    /**
     * 根据客户端所需格式和上游支持格式，创建一个协议转换器。
     * 如果不需要转换，或者不支持转换，返回 null。
     * @param clientFormat 客户端发送请求的原始格式
     * @param upstreamFormat 转发给上游的格式
     * @param requestModel 模型名称（可选），如果提前知道可以传入
     */
    public static create(
        clientFormat: ApiFormat,
        upstreamFormat: ApiFormat,
        requestModel?: string
    ): BaseConverter | null {
        if (clientFormat === upstreamFormat) {
            return null;
        }

        if (clientFormat === ApiFormat.ANTHROPIC && upstreamFormat === ApiFormat.OPENAI) {
            return new AnthropicToOpenAIConverter(requestModel);
        } else if (clientFormat === ApiFormat.OPENAI && upstreamFormat === ApiFormat.ANTHROPIC) {
            return new OpenAIToAnthropicConverter(requestModel);
        }

        return null;
    }

    public static createPair(
        clientFormat: ApiFormat,
        upstreamFormat: ApiFormat,
        requestModel?: string
    ): BaseConverter | null {
        if (clientFormat === upstreamFormat) {
            return null;
        }

        const requestConverter = this.create(clientFormat, upstreamFormat, requestModel);
        const responseConverter = this.create(upstreamFormat, clientFormat, requestModel);
        if (!requestConverter || !responseConverter) {
            return null;
        }

        return new ProtocolPairConverter(requestConverter, responseConverter);
    }
}
