import { BaseConverter } from "./BaseConverter";
import type { ProtocolStreamEvent } from "./protocolTypes";

export class ProtocolPairConverter extends BaseConverter {
    constructor(
        private requestConverter: BaseConverter,
        private responseConverter: BaseConverter,
    ) {
        super();
    }

    public updateModel(model: string) {
        super.updateModel(model);
        this.requestConverter.updateModel(model);
        this.responseConverter.updateModel(model);
    }

    public updateResponseId(id: string) {
        super.updateResponseId(id);
        this.requestConverter.updateResponseId(id);
        this.responseConverter.updateResponseId(id);
    }

    public convertRequest(clientReq: any): any {
        return this.requestConverter.convertRequest(clientReq);
    }

    public convertResponse(upstreamRes: any, requestId?: string): any {
        return this.responseConverter.convertResponse(upstreamRes, requestId);
    }

    public convertStreamEvent(dataStr: string, event?: string, id?: string): ProtocolStreamEvent[] {
        return this.responseConverter.convertStreamEvent(dataStr, event, id);
    }

    protected doConvertStreamEvent(_data: Record<string, unknown>, _rawDataStr: string): ProtocolStreamEvent[] {
        return [];
    }
}
