import ormService from "../ormService";
import SgClientConfig from "../../model/sgClientConfig";
import { SgVendor } from "../../model/sgVendor";
import { SgUser } from "../../model/sgUser";
import vendorService from "../vendorService";
import { ClientName, ConnectionMode } from "../../constants";
import type {
    ApplyClientConfigParams,
    ClientConfigBackupInfo,
    ClientConfigStatus,
    ClientConfigStatusResponse,
    ConfigAdapter,
    CreateClientConfigBackupParams,
    CreateClientConfigParams,
    DeleteClientConfigBackupParams,
    FileSystemApi,
    PathApi,
    RenameClientConfigBackupParams,
    UpdateClientConfigBackupParams,
    AdapterConfigStatus,
    ClientConfigContent,
    CurrentClientConfigWithUser,
} from "./types";
import ClaudeCodeConfigAdapter from "./claudeCodeConfigAdapter";
import CodexConfigAdapter from "./codexConfigAdapter";
import configAdapterUtils from "./configAdapterUtils";


function getHomeDir(): string {
    return process.env.HOME || process.env.USERPROFILE || "";
}


async function loadNodeApis(): Promise<{ fs: FileSystemApi; path: PathApi }> {
    const fs = await import("fs/promises");
    const path = await import("path");
    return { fs, path };
}


async function getAdapters(): Promise<ConfigAdapter[]> {
    const homeDir = getHomeDir();
    if (!homeDir) {
        throw new Error("Cannot determine user home directory");
    }

    const { fs, path } = await loadNodeApis();
    return [
        new ClaudeCodeConfigAdapter(fs, path, homeDir),
        new CodexConfigAdapter(fs, path, homeDir),
    ];
}


async function getAdapter(client: ClientName): Promise<ConfigAdapter> {
    const adapters = await getAdapters();
    const adapter = adapters.find(item => item.client === client);
    if (!adapter) {
        throw new Error(`Unsupported client: ${client}`);
    }

    return adapter;
}


async function formatUniqueBackupName(client: ClientName, baseName: string): Promise<string> {
    const records = await SgClientConfig.query()
        .where("client", client)
        .get();
    const existingNames = new Set(normalizeBackupRecords(records).map(record => String(record.name)));
    if (!existingNames.has(baseName)) {
        return baseName;
    }

    let index = 1;
    while (existingNames.has(`${baseName}${index}`)) {
        index += 1;
    }

    return `${baseName}${index}`;
}



function isEnabled(value: unknown): boolean {
    return value === true || value === 1 || value === "1";
}


async function enrichGatewayUser(config: ClientConfigContent | null): Promise<CurrentClientConfigWithUser | null> {
    if (!config) {
        return null;
    }
    const gatewayUser = await configAdapterUtils.findGatewayUserByToken(config.apiKey);
    return {
        ...config,
        configPaths: [],
        gatewayUser,
    };
}


function extractFieldsFromBackup(backupContent: any, adapter: ConfigAdapter): ClientConfigContent | null {
    if (!backupContent || typeof backupContent !== "object") return null;

    // New format: backup contains gatewayUrl or connectionMode fields
    if ("gatewayUrl" in backupContent || "connectionMode" in backupContent) {
        const config = backupContent as ClientConfigContent;

        // Verify backup content using adapter-specific validation
        if (adapter.verifyClientConfigContent && !adapter.verifyClientConfigContent(config)) {
            return null;
        }

        return config;
    }

    // Legacy format: backup contains raw config file content
    return adapter.parseConfigFileContent(backupContent);
}

async function toBackupInfo(record: SgClientConfig, adapter: ConfigAdapter): Promise<ClientConfigBackupInfo> {
    const rawContent = record.configContent || {};
    const parsedConfig = extractFieldsFromBackup(rawContent, adapter);

    if (parsedConfig?.connectionMode === ConnectionMode.VENDOR && parsedConfig.gatewayUrl) {
        (parsedConfig as any).matchedVendorId = await vendorService.findVendorByUrl(parsedConfig.gatewayUrl, adapter.protocol);
    }

    return {
        id: Number(record.id),
        client: record.client as ClientName,
        name: record.name,
        fileCount: 1, // simplified since we just store fields now
        createdAt: String(record.created_at || ""),
        enabled: isEnabled(record.enabled),
        config: await enrichGatewayUser(parsedConfig),
        matchedVendorId: (parsedConfig as any).matchedVendorId ?? null,
    };
}


function normalizeBackupRecords(records: any): any[] {
    if (Array.isArray(records)) {
        return records;
    }

    if (Array.isArray(records?.items)) {
        return records.items;
    }

    if (typeof records?.toData === "function") {
        const data = records.toData();
        return Array.isArray(data) ? data : [];
    }

    return [];
}


async function getBackups(client: ClientName, adapter: ConfigAdapter): Promise<ClientConfigBackupInfo[]> {
    const records = await SgClientConfig.query()
        .where("client", client)
        .orderBy("id", "desc")
        .get();

    return await Promise.all(normalizeBackupRecords(records).map(record => toBackupInfo(record, adapter)));
}


async function enrichStatus(adapterStatus: AdapterConfigStatus, adapter: ConfigAdapter): Promise<ClientConfigStatus> {
    const records = await SgClientConfig.query()
        .where("client", adapterStatus.client)
        .orderBy("id", "desc")
        .get();

    const backupRecords = normalizeBackupRecords(records);
    const backups = await Promise.all(backupRecords.map(record => toBackupInfo(record, adapter)));
    const activeRecord = backupRecords.find(record => isEnabled(record.enabled));
    const activeBackupId = activeRecord ? Number(activeRecord.id) : undefined;

    let activeBackupInvalid = false;
    let activeConfigModified = false;
    if (activeRecord) {
        const currentContent = await adapter.readConfig();
        const activeConfig = extractFieldsFromBackup(activeRecord.configContent, adapter);
        const currentConfig = adapter.parseConfigFileContent(currentContent);

        // Check if config file is corrupted (e.g., duplicate fields, reserved provider ID conflict)
        const isCorrupted = adapter.isConfigCorrupted && adapter.isConfigCorrupted(currentContent);

        if (!activeConfig) {
            // Backup is invalid (cannot be parsed)
            activeBackupInvalid = true;
        } else if (!currentConfig) {
            // Backup is valid but local config cannot be parsed
            // Only mark as modified if the config is actually corrupted
            if (isCorrupted) {
                activeConfigModified = true;
            }
        } else if (isCorrupted) {
            // Both are valid but config is corrupted
            activeConfigModified = true;
        } else {
            // Both are valid, compare the fields
            const serializeRelevant = (c: ClientConfigContent) => JSON.stringify({
                connectionMode: c.connectionMode,
                gatewayUrl: c.gatewayUrl,
                apiKey: c.apiKey,
                model: c.model,
            });
            activeConfigModified = serializeRelevant(activeConfig) !== serializeRelevant(currentConfig);
        }
    }

    const currentConfigWithUser = await enrichGatewayUser(adapterStatus.currentConfig);

    return {
        ...adapterStatus,
        currentConfig: currentConfigWithUser,
        backupExists: backups.length > 0,
        backupCount: backups.length,
        backups,
        activeBackupId,
        activeBackupInvalid,
        activeConfigModified,
    };
}


async function getStatus(): Promise<ClientConfigStatusResponse> {
    if (ormService.isWorker) {
        return {
            available: false,
            reason: "客户端管理需要读写本机配置文件，请本地安装后使用。",
            clients: [],
        };
    }

    const adapters = await getAdapters();
    const { fs } = await loadNodeApis();
    const clients = await Promise.all(adapters.map(async (adapter) => {
        const adapterStatus = await configAdapterUtils.buildClientStatus(adapter, fs);
        return await enrichStatus(adapterStatus, adapter);
    }));
    return {
        available: true,
        clients,
    };
}


async function resolveApiKey(connectionMode?: ConnectionMode, vendorId?: number, userId?: number): Promise<string> {
    if (connectionMode === ConnectionMode.VENDOR && vendorId) {
        const vendor = await SgVendor.query().where('id', vendorId).first();
        if (vendor?.token) return vendor.token;
    }
    if (connectionMode === ConnectionMode.GATEWAY && userId) {
        const user = await SgUser.query().where('id', userId).first();
        if (user?.token) return user.token;
    }
    return '';
}


async function createConfig(params: CreateClientConfigParams): Promise<ClientConfigStatus> {
    if (ormService.isWorker) {
        throw new Error("客户端管理需要读写本机配置文件，请本地安装后使用。");
    }

    // Skip validation for OFFICIAL mode (no gatewayUrl or apiKey required)
    if (params.connectionMode !== ConnectionMode.OFFICIAL) {
        if (!params.gatewayUrl?.trim()) {
            throw new Error("Gateway URL is required");
        }

        if (params.connectionMode === ConnectionMode.VENDOR) {
            if (!params.vendorId) {
                throw new Error("Vendor is required");
            }
        } else if (params.connectionMode === ConnectionMode.GATEWAY) {
            if (!params.userId) {
                throw new Error("User is required");
            }
        }
    }

    const adapter = await getAdapter(params.client);
    const existingContent = await adapter.readConfig();

    const apiKey = await resolveApiKey(params.connectionMode, params.vendorId, params.userId);

    // For Codex OFFICIAL mode, read authJson from local config and update access_token
    let authJson: Record<string, any> | undefined;
    if (params.client === ClientName.CODEX && (params.connectionMode || ConnectionMode.GATEWAY) === ConnectionMode.OFFICIAL) {
        const authContent = existingContent[adapter.configPaths[1]];
        if (authContent) {
            try {
                const parsed = JSON.parse(authContent);
                // Only use authJson if it has tokens with id_token
                if (parsed?.tokens?.id_token) {
                    authJson = parsed;
                    authJson.tokens.access_token = apiKey;
                }
            } catch (e) {
                // Ignore parsing errors
            }
        }
    }

    const fields: ClientConfigContent = {
        version: "v1",
        connectionMode: params.connectionMode || ConnectionMode.GATEWAY,
        gatewayUrl: params.gatewayUrl.trim(),
        apiKey,
        model: params.model?.trim() || "",
        effortLevel: params.effortLevel?.trim(),
        authJson,
    };
    
    await SgClientConfig.query().create({
        client: params.client,
        name: await formatUniqueBackupName(params.client, "未命名配置"),
        configContent: fields,
        enabled: false,
    });

    const { fs } = await loadNodeApis();
    const adapterStatus = await configAdapterUtils.buildClientStatus(adapter, fs);
    return await enrichStatus(adapterStatus, adapter);
}


async function createBackup(params: CreateClientConfigBackupParams): Promise<ClientConfigBackupInfo> {
    if (ormService.isWorker) {
        throw new Error("客户端管理需要读写本机配置文件，请本地安装后使用。");
    }

    const adapter = await getAdapter(params.client);
    const configContent = await adapter.readConfig();
    const fields = adapter.parseConfigFileContent(configContent) || { version: "v1", connectionMode: ConnectionMode.OFFICIAL, gatewayUrl: "", apiKey: "", model: "" };
    const record = await SgClientConfig.query().create({
        client: params.client,
        name: params.name?.trim() || await formatUniqueBackupName(params.client, "未命名配置"),
        configContent: fields,
        enabled: false,
    });

    if (params.enabled) {
        await enableBackup(params.client, record);
    }

    return await toBackupInfo(record, adapter);
}


async function renameBackup(params: RenameClientConfigBackupParams): Promise<ClientConfigBackupInfo> {
    if (ormService.isWorker) {
        throw new Error("客户端管理需要读写本机配置文件，请本地安装后使用。");
    }

    const name = params.name?.trim();
    if (!name) {
        throw new Error("Backup name is required");
    }

    const backup = await SgClientConfig.query()
        .where("id", params.backupId)
        .where("client", params.client)
        .first();

    if (!backup) {
        throw new Error("Backup not found");
    }

    await backup.update({ name });
    backup.name = name;
    return await toBackupInfo(backup, await getAdapter(params.client));
}


async function updateBackupConfig(params: UpdateClientConfigBackupParams): Promise<ClientConfigStatus> {
    if (ormService.isWorker) {
        throw new Error("客户端管理需要读写本机配置文件，请本地安装后使用。");
    }

    // Skip validation for OFFICIAL mode (no gatewayUrl or apiKey required)
    if (params.connectionMode !== ConnectionMode.OFFICIAL) {
        if (!params.gatewayUrl?.trim()) {
            throw new Error("Gateway URL is required");
        }

        if (params.connectionMode === ConnectionMode.VENDOR) {
            if (!params.vendorId) {
                throw new Error("Vendor is required");
            }
        } else if (params.connectionMode === ConnectionMode.GATEWAY) {
            if (!params.userId) {
                throw new Error("User is required");
            }
        }
    }

    const adapter = await getAdapter(params.client);
    const backup = await SgClientConfig.query()
        .where("id", params.backupId)
        .where("client", params.client)
        .first();

    if (!backup) {
        throw new Error("Backup not found");
    }

    const apiKey = await resolveApiKey(params.connectionMode, params.vendorId, params.userId);

    const fields: ClientConfigContent = {
        version: "v1",
        connectionMode: params.connectionMode || ConnectionMode.GATEWAY,
        gatewayUrl: params.gatewayUrl?.trim() || "",
        apiKey,
        model: params.model?.trim() || "",
        effortLevel: params.effortLevel?.trim(),
    };

    await backup.update({ configContent: fields });
    backup.configContent = fields as any;

    if (backup.enabled) {
        // If the backup being updated is currently enabled, apply changes to local config immediately
        // BUT we must patch the current local file to preserve any manual additions like mcpServers!
        const currentContent = await adapter.readConfig();
        const patchedContent = adapter.patchConfigFileContent(currentContent, fields);
        await adapter.writeConfig(patchedContent);
    }

    const { fs } = await loadNodeApis();
    const adapterStatus = await configAdapterUtils.buildClientStatus(adapter, fs);
    return await enrichStatus(adapterStatus, adapter);
}


async function deleteBackup(params: DeleteClientConfigBackupParams): Promise<ClientConfigStatus> {
    if (ormService.isWorker) {
        throw new Error("客户端管理需要读写本机配置文件，请本地安装后使用。");
    }

    const adapter = await getAdapter(params.client);
    const backup = await SgClientConfig.query()
        .where("id", params.backupId)
        .where("client", params.client)
        .first();

    if (!backup) {
        throw new Error("Backup not found");
    }

    await backup.delete();
    const { fs } = await loadNodeApis();
    const adapterStatus = await configAdapterUtils.buildClientStatus(adapter, fs);
    return await enrichStatus(adapterStatus, adapter);
}


async function enableBackup(client: ClientName, backup: SgClientConfig): Promise<void> {
    await SgClientConfig.query()
        .where("client", client)
        .update({ enabled: false });
    await backup.update({ enabled: true });
    backup.enabled = true;
}


async function applyConfig(params: ApplyClientConfigParams): Promise<ClientConfigStatus> {
    if (ormService.isWorker) {
        throw new Error("客户端管理需要读写本机配置文件，请本地安装后使用。");
    }

    const adapter = await getAdapter(params.client);
    const backup = await SgClientConfig.query()
        .where("id", params.backupId)
        .where("client", params.client)
        .first();

    if (!backup) {
        throw new Error("Backup not found");
    }

    const parsedBackup = extractFieldsFromBackup(backup.configContent, adapter);
    if (!parsedBackup) {
        throw new Error("无法解析保存的配置内容");
    }

    const currentContent = await adapter.readConfig();
    const patchedContent = adapter.patchConfigFileContent(currentContent, parsedBackup);

    await adapter.writeConfig(patchedContent);
    await enableBackup(params.client, backup);
    const { fs } = await loadNodeApis();
    const adapterStatus = await configAdapterUtils.buildClientStatus(adapter, fs);
    return await enrichStatus(adapterStatus, adapter);
}


export default {
    createBackup,
    createConfig,
    deleteBackup,
    getStatus,
    applyConfig,
    renameBackup,
    updateBackupConfig,
};

export type {
    ApplyClientConfigParams,
    ClientConfigBackupInfo,
    ClientConfigStatus,
    ClientConfigStatusResponse,
    DeleteClientConfigBackupParams,
    CreateClientConfigParams,
};
