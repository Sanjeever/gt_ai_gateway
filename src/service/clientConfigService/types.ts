import { ClientName, ConnectionMode, ApiFormat } from "../../constants";
import type { ClientConfigContent } from "../../model/sgClientConfig";

interface CreateClientConfigParams extends ClientConfigContent {
    client: ClientName;
    vendorId?: number;
    userId?: number;
}

interface ApplyClientConfigParams {
    client: ClientName;
    backupId: number;
}

interface DeleteClientConfigBackupParams {
    client: ClientName;
    backupId: number;
}

interface UpdateClientConfigBackupParams extends CreateClientConfigParams {
    backupId: number;
}

interface RenameClientConfigBackupParams {
    client: ClientName;
    backupId: number;
    name: string;
}

interface CreateClientConfigBackupParams {
    client: ClientName;
    name?: string;
    enabled?: boolean;
}

interface ClientConfigStatusResponse {
    available: boolean;
    reason?: string;
    clients: ClientConfigStatus[];
}

interface AdapterConfigStatus {
    client: ClientName;
    displayName: string;
    protocol: ApiFormat;
    installed: boolean;
    configured: boolean;
    currentConfig: ClientConfigContent | null;
    defaultGatewaySuffix: string;
    configPaths: string[];
    message?: string;
}

interface ClientConfigStatus extends AdapterConfigStatus {
    backupExists: boolean;
    backupCount: number;
    backups: ClientConfigBackupInfo[];
    activeBackupId?: number;
    activeBackupInvalid: boolean;
    activeConfigModified: boolean;
    currentConfig: CurrentClientConfigWithUser | null;
}

interface CurrentClientConfig extends ClientConfigContent {
    configPaths: string[];
}

interface CurrentClientConfigWithUser extends CurrentClientConfig {
    gatewayUser: GatewayUserInfo | null;
}

interface GatewayUserInfo {
    id: number;
    name: string;
    type: string;
    status: string;
}

interface ClientConfigBackupInfo {
    id: number;
    client: ClientName;
    name: string;
    fileCount: number;
    createdAt: string;
    enabled: boolean;
    config: CurrentClientConfig | null;
    matchedVendorId: number | null;
}

interface FileSystemApi {
    access(path: string): Promise<void>;
    mkdir(path: string, options: { recursive: boolean }): Promise<string | undefined>;
    readFile(path: string, encoding: "utf-8"): Promise<string>;
    writeFile(path: string, content: string, encoding: "utf-8"): Promise<void>;
    unlink(path: string): Promise<void>;
}

interface PathApi {
    dirname(path: string): string;
    join(...paths: string[]): string;
}

type ClientConfigFileContent = Record<string, string>;

interface ConfigAdapter {
    readonly client: ClientName;
    readonly displayName: string;
    readonly protocol: ApiFormat;
    readonly defaultGatewaySuffix: string;

    readonly configPaths: string[];

    isInstalled(): Promise<boolean>;
    readConfig(): Promise<ClientConfigFileContent>;
    writeConfig(content: ClientConfigFileContent): Promise<void>;
    parseConfigFileContent(configContent: ClientConfigFileContent, connectionMode?: ConnectionMode): ClientConfigContent | null;
    patchConfigFileContent(content: ClientConfigFileContent, fields: ClientConfigContent, connectionMode?: ConnectionMode): ClientConfigFileContent;
    isConfigCorrupted?(configContent: ClientConfigFileContent): boolean;
    verifyClientConfigContent?(config: ClientConfigContent): boolean;
}

export type {
    AdapterConfigStatus,
    ApplyClientConfigParams,
    ClientConfigBackupInfo,
    ClientConfigContent,
    ClientConfigStatus,
    ClientConfigStatusResponse,
    ClientConfigFileContent,
    ApiFormat,
    ConfigAdapter,
    ConnectionMode,
    CreateClientConfigBackupParams,
    CreateClientConfigParams,
    CurrentClientConfig,
    CurrentClientConfigWithUser,
    DeleteClientConfigBackupParams,
    FileSystemApi,
    GatewayUserInfo,
    PathApi,
    RenameClientConfigBackupParams,
    UpdateClientConfigBackupParams,
};

export { ClientName };
