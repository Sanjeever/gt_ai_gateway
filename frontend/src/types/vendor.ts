import type { BaseEntity, TableQuery } from './index';

export type VendorType = 'openai' | 'anthropic' | 'google' | 'aliyun' | 'aliyun_coding' | 'volcengine_coding' | 'deepseek' | 'mimo' | 'mimo_token_plan' | 'other';

export interface VendorUrls {
    [key: string]: string;
}

export interface Vendor extends BaseEntity {
    type: VendorType;
    name: string;
    token: string;
    urls: VendorUrls;
}

export interface CreateVendorRequest {
    type: VendorType;
    name: string;
    token: string;
    urls?: VendorUrls;
}

export interface UpdateVendorRequest {
    type?: VendorType;
    name?: string;
    token?: string;
    urls?: VendorUrls;
}

export interface VendorQuery extends TableQuery {
    type?: VendorType;
}
