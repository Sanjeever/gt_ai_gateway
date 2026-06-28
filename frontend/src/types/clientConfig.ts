import type { ApiFormat } from './gateway';

export const ClientName = {
    CLAUDE_CODE: 'claude-code',
    CODEX: 'codex',
} as const;

export type ClientName = typeof ClientName[keyof typeof ClientName];

export const ClientConnectionMode = {
    GATEWAY: 'gateway',
    VENDOR: 'vendor',
    OFFICIAL: 'official',
} as const;

export type ClientConnectionMode = typeof ClientConnectionMode[keyof typeof ClientConnectionMode];

export interface ClientConfigStatus {
    client: ClientName;
    displayName: string;
    protocol: ApiFormat;
    installed: boolean;
    configured: boolean;
    backupExists: boolean;
    backupCount: number;
    backups: ClientConfigBackupInfo[];
    activeBackupId?: number;
    activeConfigModified: boolean;
    currentConfig: CurrentClientConfig | null;
    defaultGatewaySuffix: string;
    configPaths: string[];
    message?: string;
}

export interface CurrentClientConfig {
    version?: string;
    connectionMode: ClientConnectionMode;
    gatewayUrl: string;
    apiKey: string;
    model: string;
    gatewayUser: GatewayUserInfo | null;
    effortLevel?: string;
    matchedVendorId?: number | null;
}

export interface GatewayUserInfo {
    id: number;
    name: string;
    type: string;
    status: string;
}

export interface ClientConfigBackupInfo {
    id: number;
    client: ClientName;
    name: string;
    fileCount: number;
    createdAt: string;
    enabled: boolean;
    config: CurrentClientConfig | null;
}

export interface ClientConfigStatusResponse {
    available: boolean;
    reason?: string;
    clients: ClientConfigStatus[];
}

export interface CreateClientConfigRequest {
    version?: string;
    client: ClientName;
    connectionMode?: ClientConnectionMode;
    gatewayUrl: string;
    userId?: number;
    vendorId?: number;
    model: string;
    effortLevel?: string;
}

export interface CreateClientConfigBackupRequest {
    client: ClientName;
    name?: string;
    enabled?: boolean;
}

export interface RenameClientConfigBackupRequest {
    client: ClientName;
    backupId: number;
    name: string;
}

export interface DeleteClientConfigBackupRequest {
    client: ClientName;
    backupId: number;
}

export interface UpdateClientConfigBackupRequest extends CreateClientConfigRequest {
    backupId: number;
}

export interface ApplyClientConfigRequest {
    client: ClientName;
    backupId: number;
}
