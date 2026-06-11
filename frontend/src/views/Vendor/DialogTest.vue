<template>
    <a-modal
        v-model:open="visible"
        :title="modalTitle"
        :footer="null"
        width="600px"
    >
        <div class="test-dialog">
            <div class="test-config">
                <a-form layout="vertical">
                    <!-- Model mode: read-only info block -->
                    <template v-if="modelInfo">
                        <div class="model-info">
                            <div class="info-row">
                                <span class="info-label">模型名称</span>
                                <span class="info-value">{{ modelInfo.modelName }}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">供应商</span>
                                <span class="info-value">{{ currentVendor?.name }}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">供应商模型</span>
                                <span class="info-value">{{ modelInfo.vendorModelName ?? '自动' }}</span>
                            </div>
                        </div>
                    </template>

                    <a-form-item :label="modelInfo ? '客户端请求协议' : '向服务端请求协议'">
                        <a-radio-group v-model:value="format">
                            <a-radio-button value="openai">OpenAI</a-radio-button>
                            <a-radio-button value="anthropic">Anthropic</a-radio-button>
                        </a-radio-group>
                    </a-form-item>

                    <!-- Vendor mode: editable model select -->
                    <template v-if="!modelInfo">
                        <a-form-item label="测试模型">
                            <a-select
                                v-model:value="testModel"
                                placeholder="请选择或直接输入模型名称"
                                show-search
                                allow-clear
                                :loading="modelsLoading"
                                :options="selectOptions"
                                @search="handleSearch"
                                :filter-option="false"
                                option-label-prop="value"
                            >
                                <template #option="{ value, isCustom }">
                                    <span v-if="isCustom" style="color: var(--accent-primary)">使用自定义模型: </span>
                                    {{ value }}
                                </template>
                            </a-select>
                            <div class="hint-text">您可以从下拉列表中选择，也可以直接输入新的模型名称进行测试</div>
                        </a-form-item>
                    </template>

                    <div v-if="modelInfo && (canAutoConvert || !hasDirectUrl)" class="auto-convert-row">
                        <a-checkbox
                            v-model:checked="useAutoConvert"
                            :disabled="!canAutoConvert"
                        >
                            自动转换
                            <span v-if="canAutoConvert" class="convert-hint">
                                ({{ format.toUpperCase() }} → {{ autoConvertTo!.toUpperCase() }})
                            </span>
                        </a-checkbox>
                        <span v-if="!hasDirectUrl && !canAutoConvert" class="no-url-hint">
                            该供应商未配置 {{ format.toUpperCase() }} URL，且无可用转换格式
                        </span>
                    </div>

                    <a-button
                        type="primary"
                        :loading="loading"
                        :disabled="testButtonDisabled"
                        @click="handleTest"
                        block
                    >
                        开始测试
                    </a-button>
                </a-form>
            </div>

            <div v-if="result" class="test-result">
                <a-divider>测试结果</a-divider>
                <div class="result-summary">
                    <a-space direction="vertical" style="width: 100%">
                        <a-space>
                            <a-badge :status="result.success ? 'success' : 'error'" />
                            <span :class="['status-text', result.success ? 'success' : 'error']">
                                {{ result.success ? '连接成功' : '连接失败' }}
                            </span>
                            <span v-if="result.status" class="status-code">
                                HTTP {{ result.status }}
                            </span>
                            <span v-if="result.duration" class="duration">
                                耗时: {{ result.duration }}ms
                            </span>
                        </a-space>
                        <div v-if="result.converted_from && result.converted_to" class="result-convert">
                            <span class="convert-label">协议转换:</span>
                            <code class="convert-text">{{ result.converted_from.toUpperCase() }} → {{ result.converted_to.toUpperCase() }}</code>
                        </div>
                        <div v-if="result.url" class="result-url">
                            <span class="url-label">实际 URL:</span>
                            <code class="url-text">{{ result.url }}</code>
                        </div>
                    </a-space>
                </div>

                <div class="result-detail">
                    <div class="detail-label">响应详情:</div>
                    <pre class="response-body">{{ formattedResponse }}</pre>
                </div>
            </div>
        </div>
    </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { testVendor, listVendorModels } from '@/api/vendor';
import type { VendorTestResponse } from '@/api/vendor';
import type { Vendor, VendorModel } from '@/types/vendor';
import { notifyRequestError, notifySuccess, notifyWarning } from '@/utils/requestFeedback';
import { useVendorPresets } from '@/composables/useVendorPresets';

interface ModelInfo {
    modelName: string;
    vendorModelName: string | null;
}

const { presetUrls, load: loadPresets } = useVendorPresets();

const visible = ref(false);
const loading = ref(false);
const format = ref('openai');
const result = ref<VendorTestResponse | null>(null);
const currentVendor = ref<Vendor | null>(null);
const modelInfo = ref<ModelInfo | null>(null);
const useAutoConvert = ref(false);

const mergedUrls = computed(() => {
    if (!currentVendor.value) return {};
    const preset = presetUrls.value[currentVendor.value.type] ?? {};
    const merged = { ...preset, ...currentVendor.value.urls };
    delete merged['label'];
    return merged;
});

const hasDirectUrl = computed(() => !!mergedUrls.value[format.value]);

const autoConvertTo = computed(() => {
    if (hasDirectUrl.value) return null;
    const formats = ['openai', 'anthropic'];
    return formats.find(f => f !== format.value && !!mergedUrls.value[f]) ?? null;
});

const canAutoConvert = computed(() => !!autoConvertTo.value);

const testButtonDisabled = computed(() => {
    if (!testModel.value) return true;
    if (!hasDirectUrl.value) {
        // 供应商模式：直接禁用；模型模式：可以靠自动转换解锁
        return !modelInfo.value || !useAutoConvert.value;
    }
    return false;
});

const testModel = ref<string>('');
const vendorModels = ref<VendorModel[]>([]);
const modelsLoading = ref(false);
const searchValue = ref('');

const modalTitle = computed(() => modelInfo.value ? '模型可用性测试' : '供应商连通性测试');

const selectOptions = computed(() => {
    const options = vendorModels.value.map(m => ({
        value: m.model_id,
        label: m.model_id,
        isCustom: false,
    }));

    if (searchValue.value && !options.some(o => o.value === searchValue.value)) {
        options.unshift({
            value: searchValue.value,
            label: searchValue.value,
            isCustom: true,
        });
    }

    return options;
});

const formattedResponse = computed(() => {
    const data = result.value?.response || result.value?.error;
    if (!data) return '';
    try {
        if (typeof data === 'object') {
            return JSON.stringify(data, null, 2);
        }
        return String(data);
    } catch {
        return String(data);
    }
});

function open(vendor: Vendor, defaultModel?: string, info?: ModelInfo) {
    currentVendor.value = vendor;
    modelInfo.value = info ?? null;
    visible.value = true;
    result.value = null;
    testModel.value = defaultModel ?? '';
    searchValue.value = '';
    useAutoConvert.value = false;

    if (vendor.type === 'anthropic') {
        format.value = 'anthropic';
    } else {
        format.value = 'openai';
    }

    void loadPresets();

    // Only load the model list in vendor mode
    if (!info) {
        loadVendorModels(vendor.id, defaultModel);
    }
}

async function loadVendorModels(vendorId: number, defaultModel?: string) {
    modelsLoading.value = true;
    try {
        vendorModels.value = await listVendorModels(vendorId);
        if (!defaultModel && vendorModels.value.length > 0) {
            testModel.value = vendorModels.value[0]?.model_id || '';
        }
    } catch (error) {
        notifyRequestError(error, '加载模型列表失败');
    } finally {
        modelsLoading.value = false;
    }
}

watch(format, () => {
    useAutoConvert.value = false;
    result.value = null;
});

function handleSearch(val: string) {
    searchValue.value = val;
}

async function handleTest() {
    if (!currentVendor.value || !testModel.value) return;

    loading.value = true;
    result.value = null;
    try {
        const res = await testVendor(currentVendor.value.id, format.value, testModel.value, useAutoConvert.value);
        result.value = res;
        if (res.success) {
            notifySuccess('测试完成，连接正常');
        } else {
            notifyWarning(`测试完成，但上游返回错误 (HTTP ${res.status})`);
        }
    } catch (error) {
        const requestError = notifyRequestError(error, '测试请求发送失败');
        result.value = {
            success: false,
            error: requestError.message,
        };
    } finally {
        loading.value = false;
    }
}

defineExpose({ open });
</script>

<style scoped>
.test-dialog {
    padding: 8px 0;
}

.test-config {
    margin-bottom: 16px;
}

.hint-text {
    font-size: 12px;
    color: #8c8c8c;
    margin-top: 4px;
}

.model-info {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;
    padding: 10px 12px;
    background: #f5f5f5;
    border-radius: 6px;
}

.info-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 13px;
}

.info-label {
    color: #8c8c8c;
    white-space: nowrap;
    flex-shrink: 0;
}

.info-label::after {
    content: '：';
}

.info-value {
    color: #262626;
    word-break: break-all;
}

.test-result {
    margin-top: 24px;
}

.result-summary {
    margin-bottom: 16px;
    padding: 12px;
    background: #f6f8fa;
    border-radius: 4px;
}

.status-text {
    font-weight: bold;
}

.status-text.success {
    color: #52c41a;
}

.status-text.error {
    color: #ff4d4f;
}

.status-code, .duration {
    color: #8c8c8c;
    font-size: 13px;
    margin-left: 8px;
}

.auto-convert-row {
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.convert-hint {
    color: #8c8c8c;
    font-size: 12px;
}

.no-url-hint {
    color: #ff4d4f;
    font-size: 12px;
}

.result-convert {
    margin-top: 8px;
    font-size: 12px;
    background: #f0f2f5;
    padding: 4px 8px;
    border-radius: 4px;
}

.convert-label {
    color: #8c8c8c;
    margin-right: 8px;
    font-weight: 500;
}

.convert-text {
    color: #1677ff;
    font-family: monospace;
}

.result-url {
    margin-top: 8px;
    font-size: 12px;
    word-break: break-all;
    background: #f0f2f5;
    padding: 4px 8px;
    border-radius: 4px;
}

.url-label {
    color: #8c8c8c;
    margin-right: 8px;
    font-weight: 500;
}

.url-text {
    color: #595959;
    font-family: monospace;
}

.result-detail {
    margin-top: 16px;
}

.detail-label {
    font-size: 13px;
    color: #8c8c8c;
    margin-bottom: 8px;
}

.response-body {
    background: #282c34;
    color: #abb2bf;
    padding: 12px;
    border-radius: 4px;
    font-size: 12px;
    max-height: 300px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;
}
</style>
