import type { VendorType } from '@/types/vendor';

export const VENDOR_PRESET_URLS: Partial<Record<VendorType, Record<string, string>>> = {
    aliyun: {
        openai: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        anthropic: 'https://dashscope.aliyuncs.com/apps/anthropic',
    },
    aliyun_coding: {
        openai: 'https://coding.dashscope.aliyuncs.com/v1',
        anthropic: 'https://coding.dashscope.aliyuncs.com/apps/anthropic',
    },
    volcengine_coding: {
        openai: 'https://ark.cn-beijing.volces.com/api/coding/v3',
        anthropic: 'https://ark.cn-beijing.volces.com/api/coding',
    },
    deepseek: {
        openai: 'https://api.deepseek.com/v1/chat/completions',
        anthropic: 'https://api.deepseek.com/anthropic',
    },
    mimo: {
        openai: 'https://api.xiaomimimo.com/v1',
        anthropic: 'https://api.xiaomimimo.com/anthropic',
    },
    mimo_token_plan: {
        openai: 'https://token-plan-cn.xiaomimimo.com/v1',
        anthropic: 'https://token-plan-cn.xiaomimimo.com/anthropic',
    },
    opencode_go: {
        openai: 'https://opencode.ai/zen/go/v1',
    },
    openai: {
        openai: 'https://api.openai.com/v1/chat/completions',
    },
    anthropic: {
        anthropic: 'https://api.anthropic.com',
    },
    google: {
        openai: 'https://generativelanguage.googleapis.com/v1beta/openai',
    },
};
