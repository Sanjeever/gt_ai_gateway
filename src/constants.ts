export enum SgRecordStatus {
    INIT = "init",
    PROCESSING = "processing",
    SUCCESS = "success",
    FAILED = "failed",
}

export enum VendorType {
    ALIYUN = "aliyun",
    ALIYUN_CODING = "aliyun_coding",
    DEEPSEEK = "deepseek",
    OTHER = "other",
}

export enum ApiFormat {
    OPENAI = "openai",
    ANTHROPIC = "anthropic",
    GOOGLE = "google",
}

export enum UserType {
    NORMAL = "normal",
    ADMIN = "admin",
}

export const ROOT_USER_ID = -1;
