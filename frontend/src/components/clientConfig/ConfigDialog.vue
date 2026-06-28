<template>
    <a-modal
        v-model:open="visible"
        :title="dialogTitle"
        :confirm-loading="saving"
        ok-text="保存"
        cancel-text="取消"
        :footer="dialogFooter"
        width="560px"
        @ok="handleSubmit"
    >
        <a-form layout="vertical" class="config-form">
            <a-tabs
                :activeKey="form.connectionMode"
                class="connection-tabs"
                @change="onConnectionModeChange"
            >
                <a-tab-pane :key="ClientConnectionMode.GATEWAY">
                    <template #tab>
                        <span>
                            通过 GT AI Gateway
                            <a-tooltip>
                                <template #title>
                                    <div>代理模式：客户端通过 GtAIGateway 连接上游。</div>
                                    <div>支持高级功能，如抓取请求流量进行分析、自动协议转换、提升缓存命中率等。</div>
                                </template>
                                <InfoCircleOutlined class="label-help-icon" style="margin-left: 4px;" />
                            </a-tooltip>
                        </span>
                    </template>
                    <a-form-item label="协议">
                        <a-input :value="protocolLabel" disabled />
                    </a-form-item>
                    <a-form-item label="服务端地址" required>
                        <a-input v-model:value="form.gatewayUrl" :disabled="isDetail" />
                    </a-form-item>
                    <a-form-item required>
                        <template #label>
                            <span class="form-label-with-help">
                                用户
                                <a-tooltip title="选择一个网关用户，系统会把该用户的 Token 写入客户端配置，用于客户端访问当前网关。">
                                    <InfoCircleOutlined class="label-help-icon" />
                                </a-tooltip>
                            </span>
                        </template>
                        <a-select
                            v-model:value="form.userId"
                            show-search
                            placeholder="选择用于写入客户端的用户 Token"
                            :filter-option="filterSelectOption"
                            :disabled="isDetail"
                        >
                            <a-select-option
                                v-for="user in users"
                                :key="user.id"
                                :value="user.id"
                                :label="`${user.name} ${getUserTypeLabel(user.type)} ${user.status}`"
                            >
                                <div class="select-option-row">
                                    <a-tag class="select-tag" :color="getUserTypeColor(user.type)">
                                        {{ getUserTypeLabel(user.type) }}
                                    </a-tag>
                                    <span class="select-option-name">{{ user.name }}</span>
                                    <a-tag v-if="user.status !== 'active'" class="select-tag" color="red">
                                        已禁用
                                    </a-tag>
                                </div>
                            </a-select-option>
                            <template #labelRender="{ value }">
                                <div v-if="findUser(Number(value))" class="select-option-row selected-option">
                                    <a-tag class="select-tag" :color="getUserTypeColor(findUser(Number(value))?.type)">
                                        {{ getUserTypeLabel(findUser(Number(value))?.type) }}
                                    </a-tag>
                                    <span class="select-option-name">{{ findUser(Number(value))?.name }}</span>
                                    <a-tag v-if="findUser(Number(value))?.status !== 'active'" class="select-tag" color="red">
                                        已禁用
                                    </a-tag>
                                </div>
                            </template>
                        </a-select>
                    </a-form-item>
                    <a-form-item label="模型" required>
                        <a-select
                            v-model:value="form.model"
                            show-search
                            placeholder="选择网关模型"
                            :filter-option="filterSelectOption"
                            :disabled="isDetail"
                        >
                            <a-select-option
                                v-for="m in enabledModels"
                                :key="m.id"
                                :value="m.name"
                                :label="m.name"
                            >
                                {{ m.name }}
                            </a-select-option>
                        </a-select>
                    </a-form-item>
                </a-tab-pane>

                <a-tab-pane :key="ClientConnectionMode.VENDOR">
                    <template #tab>
                        <span>
                            直连上游供应商
                            <a-tooltip title="直连模式：客户端直接连接上游供应商，不经过 GtAIGateway 代理。">
                                <InfoCircleOutlined class="label-help-icon" style="margin-left: 4px;" />
                            </a-tooltip>
                        </span>
                    </template>
                    <a-form-item label="协议">
                        <a-input :value="protocolLabel" disabled />
                    </a-form-item>
                    <a-form-item label="供应商" required>
                        <a-select
                            v-model:value="form.vendorId"
                            show-search
                            placeholder="选择上游供应商"
                            :filter-option="filterSelectOption"
                            :disabled="isDetail"
                            @change="onVendorChange"
                        >
                            <a-select-option
                                v-for="vendor in vendors"
                                :key="vendor.id"
                                :value="vendor.id"
                                :label="`${vendor.name} ${getVendorTypeLabel(vendor.type)}`"
                            >
                                <div class="select-option-row">
                                    <a-tag
                                        class="select-tag"
                                        :color="getVendorTypeColor(vendor.type)"
                                        :style="getVendorTypeTagStyle(vendor.type)"
                                    >
                                        {{ getVendorTypeLabel(vendor.type) }}
                                    </a-tag>
                                    <span class="select-option-name">{{ vendor.name }}</span>
                                </div>
                            </a-select-option>
                            <template #labelRender="{ value }">
                                <div v-if="findVendor(Number(value))" class="select-option-row selected-option">
                                    <a-tag
                                        class="select-tag"
                                        :color="getVendorTypeColor(findVendor(Number(value))?.type)"
                                        :style="getVendorTypeTagStyle(findVendor(Number(value))?.type)"
                                    >
                                        {{ getVendorTypeLabel(findVendor(Number(value))?.type) }}
                                    </a-tag>
                                    <span class="select-option-name">{{ findVendor(Number(value))?.name }}</span>
                                </div>
                            </template>
                        </a-select>
                    </a-form-item>
                    <a-form-item label="模型" required>
                        <a-select
                            v-model:value="form.upstreamModel"
                            show-search
                            placeholder="选择供应商模型"
                            :filter-option="filterSelectOption"
                            :disabled="isDetail"
                        >
                            <a-select-option
                                v-for="m in vendorModels"
                                :key="m.id"
                                :value="m.model_id"
                                :label="m.model_id"
                            >
                                {{ m.model_id }}
                            </a-select-option>
                        </a-select>
                    </a-form-item>
                </a-tab-pane>

                <a-tab-pane :key="ClientConnectionMode.OFFICIAL">
                    <template #tab>
                        <span>
                            直连官方
                            <a-tooltip title="直连官方：客户端直接连接官方服务">
                                <InfoCircleOutlined class="label-help-icon" style="margin-left: 4px;" />
                            </a-tooltip>
                        </span>
                    </template>
                    <a-alert
                        v-if="isDetail"
                        message="只读配置"
                        description="直连官方的配置不可在网关侧进行编辑，如需更新配置请在客户端本地重新登录，然后使用「从本地配置新建」功能进行更新。"
                        type="warning"
                        show-icon
                        style="margin-bottom: 24px;"
                    />
                    <a-alert
                        v-else
                        message="只读配置"
                        description="创建后请通过客户端登录。登录完成后，可使用「从本地配置新建」功能导入已登录的配置。"
                        type="info"
                        show-icon
                        style="margin-bottom: 24px;"
                    />
                </a-tab-pane>
            </a-tabs>
            <a-form-item
                v-if="form.client === ClientName.CLAUDE_CODE"
                label="思考强度"
            >
                <a-select
                    v-model:value="form.effortLevel"
                    placeholder="选择思考强度"
                    allow-clear
                    :disabled="isDetail"
                >
                    <a-select-option value="low">低 (low)</a-select-option>
                    <a-select-option value="medium">中 (medium)</a-select-option>
                    <a-select-option value="high">高 (high)</a-select-option>
                </a-select>
            </a-form-item>
        </a-form>
    </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue';
import { InfoCircleOutlined } from '@ant-design/icons-vue';
import { ClientName, ClientConnectionMode } from '@/types/clientConfig';
import { ApiFormat } from '@/types/gateway';
import type { ClientConfigStatus, ClientConfigBackupInfo, CurrentClientConfig } from '@/types/clientConfig';
import type { User } from '@/types/user';
import type { Model } from '@/types/model';
import type { Vendor, VendorModel } from '@/types/vendor';
import { listVendorModels } from '@/api/vendor';
import {
    clientProtocolLabels,
    filterSelectOption,
    getUserTypeLabel,
    getUserTypeColor,
    getVendorTypeLabel,
    getVendorTypeColor,
    getVendorTypeTagStyle,
    getVendorUrl,
} from '@/utils/clientManagerUtils';

const props = defineProps<{
    open: boolean;
    mode: 'create' | 'edit' | 'detail';
    selectedClient: ClientConfigStatus | null;
    backup: ClientConfigBackupInfo | null;
    users: User[];
    models: Model[];
    vendors: Vendor[];
    vendorPresetUrls: Record<string, Record<string, string>>;
    defaultGatewayUrl: string;
}>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
    (e: 'save', request: any): void;
}>();

const saving = ref(false);
const vendorModels = ref<VendorModel[]>([]);

const visible = computed({
    get: () => props.open,
    set: (val) => emit('update:open', val),
});

const isDetail = computed(() => props.mode === 'detail');

const protocolLabel = computed(() => props.selectedClient ? clientProtocolLabels[props.selectedClient.client] : '');

const enabledModels = computed(() => props.models.filter(m => m.enable));

const dialogTitle = computed(() => {
    if (!props.selectedClient) return '配置客户端';
    if (props.mode === 'detail') return `配置详情：${props.backup?.name || ''}`;
    if (props.mode === 'edit') return `修改配置：${props.backup?.name || ''}`;
    return `配置 ${props.selectedClient.displayName}`;
});

const dialogFooter = computed(() => isDetail.value ? null : undefined);

const form = reactive({
    client: '' as ClientName | '',
    connectionMode: ClientConnectionMode.GATEWAY as ClientConnectionMode,
    protocol: ApiFormat.ANTHROPIC as ApiFormat,
    gatewayUrl: '',
    upstreamUrl: '',
    userId: null as number | null,
    vendorId: null as number | null,
    model: '',
    upstreamModel: '',
    effortLevel: undefined as string | undefined,
    apiKey: undefined as string | undefined,
});

watch(() => props.open, (isOpen) => {
    if (!isOpen) return;
    if (props.mode === 'create') {
        initCreateForm();
    } else if (props.backup?.config) {
        initFromBackup(props.backup.config);
    }
});

function initCreateForm(): void {
    form.client = props.selectedClient?.client || '';
    form.connectionMode = ClientConnectionMode.GATEWAY;
    form.protocol = props.selectedClient?.protocol || ApiFormat.ANTHROPIC;
    form.gatewayUrl = props.defaultGatewayUrl;
    form.upstreamUrl = '';
    form.userId = null;
    form.vendorId = null;
    form.model = '';
    form.upstreamModel = '';
    form.effortLevel = undefined;
    form.apiKey = undefined;

    const activeUser = props.users.find(u => u.status === 'active');
    if (activeUser) form.userId = activeUser.id;

    const firstModel = enabledModels.value[0];
    if (firstModel) form.model = firstModel.name;

    if (props.vendors.length > 0) {
        form.vendorId = props.vendors[0]!.id;
        onVendorChange();
    }
}

function initFromBackup(config: CurrentClientConfig): void {
    form.client = props.selectedClient?.client || '';
    form.connectionMode = config.connectionMode;
    form.protocol = props.selectedClient?.protocol || ApiFormat.ANTHROPIC;
    form.effortLevel = config.effortLevel;
    form.apiKey = config.apiKey;

    if (config.connectionMode === ClientConnectionMode.GATEWAY) {
        form.gatewayUrl = config.gatewayUrl;
        form.model = config.model;
        form.userId = config.gatewayUser?.id || null;
        form.upstreamUrl = '';
        form.upstreamModel = '';
        form.vendorId = null;
    } else if (config.connectionMode === ClientConnectionMode.VENDOR) {
        form.upstreamUrl = config.gatewayUrl;
        form.upstreamModel = config.model;
        form.vendorId = config.matchedVendorId ?? null;
        form.gatewayUrl = '';
        form.model = '';
        form.userId = null;
    } else {
        form.gatewayUrl = '';
        form.upstreamUrl = '';
        form.model = '';
        form.upstreamModel = '';
        form.userId = null;
        form.vendorId = null;
    }
}

function findUser(id: number): User | undefined {
    return props.users.find(u => u.id === id);
}

function findVendor(id: number): Vendor | undefined {
    return props.vendors.find(v => v.id === id);
}

async function onConnectionModeChange(mode: string): Promise<void> {
    if (isDetail.value) return;
    form.connectionMode = mode as ClientConnectionMode;
    if (form.connectionMode === ClientConnectionMode.VENDOR) {
        await onVendorChange();
    }
}

async function onVendorChange(): Promise<void> {
    const vendor = props.vendors.find(v => v.id === form.vendorId);
    if (!vendor) {
        vendorModels.value = [];
        form.upstreamUrl = '';
        form.upstreamModel = '';
        return;
    }

    form.upstreamUrl = getVendorUrl(vendor, form.protocol, props.vendorPresetUrls);
    vendorModels.value = await listVendorModels(vendor.id);
    form.upstreamModel = vendorModels.value[0]?.model_id || '';
}

function buildRequest(): any {
    if (!form.client) return null;

    if (form.connectionMode === ClientConnectionMode.GATEWAY) {
        return {
            client: form.client,
            connectionMode: form.connectionMode,
            gatewayUrl: form.gatewayUrl,
            userId: form.userId,
            model: form.model,
        };
    } else if (form.connectionMode === ClientConnectionMode.VENDOR) {
        return {
            client: form.client,
            connectionMode: form.connectionMode,
            gatewayUrl: form.upstreamUrl,
            vendorId: form.vendorId,
            model: form.upstreamModel,
        };
    } else {
        return {
            client: form.client,
            connectionMode: form.connectionMode,
            gatewayUrl: '',
            apiKey: '',
            model: '',
        };
    }
}

async function handleSubmit(): Promise<void> {
    if (isDetail.value || !form.client) return;

    const request = buildRequest();
    if (!request) return;

    saving.value = true;
    try {
        emit('save', request);
    } finally {
        saving.value = false;
    }
}
</script>
