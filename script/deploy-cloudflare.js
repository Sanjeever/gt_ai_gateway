const { execFileSync, spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const WRANGLER_CONFIG_PATH = "wrangler.toml";
const DEFAULT_DATABASE_NAME = "gt_ai_gateway";
const DEFAULT_R2_BUCKET_NAME = "gt-ai-gateway-objects";
const DEFAULT_KV_NAMESPACE_NAME = "gt_ai_gateway_cache";
const DEFAULT_D1_BINDING = "DB";
const DEPLOY_SETUP_FLAGS = new Set(["--auto-create-db", "--auto-migrate", "--auto-create-root-token", "--auto-create-r2"]);

const options = {
    autoCreateDb: false,
    migrate: false,
    autoRootToken: false,
    autoCreateR2: false,
};
const wranglerArgs = [];
let skipR2Binding = false;
let skipR2BindingReason = "";
let generatedWranglerConfigPath = "";

function printHelp() {
    console.log("Usage:");
    console.log("  npm run deploy");
    console.log("  npm run deploy -- --auto-create-db");
    console.log("  npm run deploy:cloudflare");
    console.log("  npm run deploy:cloudflare -- --auto-create-db --auto-migrate --auto-create-root-token");
    console.log("");
    console.log("Options:");
    console.log("  --auto-create-db  Create the configured D1 database if it does not exist.");
    console.log("  --auto-create-r2  Create the configured R2 bucket if it does not exist.");
    console.log("  --auto-migrate    Apply D1 migrations before deploy.");
    console.log("  --auto-create-root-token Set ROOT_TOKEN from the ROOT_TOKEN environment variable.");
    console.log("  --help, -h        Show this help message.");
    console.log("");
    console.log("Environment variables (override wrangler.toml names):");
    console.log("  CLOUDFLARE_D1_NAME   D1 database name (default: from wrangler.toml)");
    console.log("  CLOUDFLARE_R2_NAME   R2 bucket name (default: from wrangler.toml)");
    console.log("  CLOUDFLARE_KV_NAME   KV namespace name (default: from wrangler.toml)");
    console.log("");
    console.log("Unknown options are forwarded to `wrangler deploy`.");
}

for (const arg of process.argv.slice(2)) {
    if (arg === "--help" || arg === "-h") {
        printHelp();
        process.exit(0);
    }

    if (DEPLOY_SETUP_FLAGS.has(arg)) {
        if (arg === "--auto-create-db") {
            options.autoCreateDb = true;
        } else if (arg === "--auto-migrate") {
            options.migrate = true;
        } else if (arg === "--auto-create-root-token") {
            options.autoRootToken = true;
        } else if (arg === "--auto-create-r2") {
            options.autoCreateR2 = true;
        }
        continue;
    }

    wranglerArgs.push(arg);
}

function run(command, commandArgs, options = {}) {
    console.log(`> ${[command, ...commandArgs].join(" ")}`);
    const result = spawnSync(command, commandArgs, {
        env: {
            ...process.env,
            ...(options.env || {}),
        },
        input: options.input,
        stdio: options.stdio || "inherit",
        shell: process.platform === "win32",
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error(`${command} ${commandArgs.join(" ")} failed with exit code ${result.status || 1}`);
    }

    return result.stdout ? String(result.stdout) : "";
}

function runAndCapture(command, commandArgs) {
    return execFileSync(command, commandArgs, {
        encoding: "utf8",
        stdio: "pipe",
    });
}

function getCommandErrorText(error) {
    return [
        error?.message,
        error?.stdout,
        error?.stderr,
    ].filter(Boolean).map(String).join("\n");
}

function isPermissionError(error) {
    const text = getCommandErrorText(error).toLowerCase();
    return text.includes("permission")
        || text.includes("unauthorized")
        || text.includes("not authorized")
        || text.includes("forbidden")
        || text.includes("authentication error");
}

function markR2BindingSkipped(reason) {
    skipR2Binding = true;
    skipR2BindingReason = reason;
    console.warn(`⚠️  ${reason}`);
    console.warn("⚠️  R2 binding will be skipped for this deployment. Request/response payloads can fall back to database storage.");
}

function hasDeploySetupFlags() {
    return options.autoCreateDb || options.migrate || options.autoRootToken || options.autoCreateR2;
}

function readWranglerConfig() {
    return fs.readFileSync(WRANGLER_CONFIG_PATH, "utf8");
}

function getConfiguredDatabaseName() {
    return process.env.CLOUDFLARE_D1_NAME || DEFAULT_DATABASE_NAME;
}

function getConfiguredWorkerName() {
    const toml = readWranglerConfig();
    const match = toml.match(/^name\s*=\s*"([^"]+)"/m);
    return match?.[1];
}

function getConfiguredD1Binding() {
    const toml = readWranglerConfig();
    const d1Block = toml.match(/\[\[d1_databases\]\]([\s\S]*?)(?:\n\[|$)/);
    const bindingMatch = d1Block?.[1]?.match(/binding\s*=\s*"([^"]+)"/);
    return bindingMatch?.[1] || DEFAULT_D1_BINDING;
}

function listDatabases() {
    const dbListStr = runAndCapture("npx", ["wrangler", "d1", "list", "--json"]);
    return JSON.parse(dbListStr);
}

function findDatabaseByName(databaseName) {
    return listDatabases().find((database) => database.name === databaseName);
}

function resolveConfiguredDatabase(databaseName) {
    let database = findDatabaseByName(databaseName);

    if (database) {
        return database;
    }

    if (!options.autoCreateDb) {
        throw new Error(
            `D1 database ${databaseName} was not found. ` +
            "Pass --auto-create-db to create it automatically, or create/link a D1 database manually.",
        );
    }

    console.log(`Database ${databaseName} not found. Creating new D1 database...`);
    run("npx", ["wrangler", "d1", "create", databaseName]);

    database = findDatabaseByName(databaseName);
    if (!database) {
        throw new Error(`Failed to create or find D1 database: ${databaseName}`);
    }

    return database;
}

function runMigrations(bindingName) {
    if (!options.migrate) {
        console.log("Skipping D1 migrations. Pass --auto-migrate to apply them.");
        return;
    }

    console.log(`Applying D1 migrations to binding ${bindingName}...`);
    const migrateArgs = ["run", "db:migrate:worker-cloud"];
    if (bindingName !== DEFAULT_D1_BINDING) {
        migrateArgs.push("--", "--db-name", bindingName);
    }
    run("npm", migrateArgs);
}

function getConfiguredR2Binding() {
    const toml = readWranglerConfig();
    const r2Block = toml.match(/\[\[r2_buckets\]\]([\s\S]*?)(?:\n\[|$)/);
    const bindingMatch = r2Block?.[1]?.match(/binding\s*=\s*"([^"]+)"/);
    return bindingMatch?.[1] || null;
}

function getConfiguredR2BucketName() {
    return process.env.CLOUDFLARE_R2_NAME || DEFAULT_R2_BUCKET_NAME;
}

function findR2BucketByName(bucketName) {
    const list = runAndCapture("npx", ["wrangler", "r2", "bucket", "list"]);
    return list.includes(bucketName);
}

function stripR2BucketBindings(tomlContent) {
    return tomlContent
        .replace(/(^|\n)\[\[r2_buckets\]\][\s\S]*?(?=\n\[|$)/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trimEnd() + "\n";
}

function setupR2Bucket() {
    const binding = getConfiguredR2Binding();
    if (!binding) {
        console.log("No R2 bucket binding configured in wrangler.toml; skipping R2 setup.");
        return;
    }

    const bucketName = getConfiguredR2BucketName();
    let bucketExists = false;
    try {
        bucketExists = findR2BucketByName(bucketName);
    } catch (err) {
        if (isPermissionError(err)) {
            markR2BindingSkipped(
                `No permission to access Cloudflare R2 while checking bucket ${bucketName}.`,
            );
            return;
        }
        throw err;
    }

    if (bucketExists) {
        console.log(`R2 bucket ${bucketName} already exists.`);
        return;
    }

    if (!options.autoCreateR2) {
        markR2BindingSkipped(
            `R2 bucket ${bucketName} was not found and --auto-create-r2 was not provided.`,
        );
        return;
    }

    console.log(`Creating R2 bucket ${bucketName}...`);
    try {
        const output = runAndCapture("npx", ["wrangler", "r2", "bucket", "create", bucketName]);
        if (output.trim()) {
            console.log(output.trim());
        }
    } catch (err) {
        if (isPermissionError(err)) {
            markR2BindingSkipped(
                `No permission to create Cloudflare R2 bucket ${bucketName}.`,
            );
            return;
        }
        throw err;
    }
}

function getConfiguredKVBinding() {
    const toml = readWranglerConfig();
    const kvBlock = toml.match(/\[\[kv_namespaces\]\]([\s\S]*?)(?:\n\[|$)/);
    const bindingMatch = kvBlock?.[1]?.match(/binding\s*=\s*"([^"]+)"/);
    return bindingMatch?.[1] || null;
}

function getConfiguredKVNamespaceName() {
    return process.env.CLOUDFLARE_KV_NAME || DEFAULT_KV_NAMESPACE_NAME;
}

function setupKVNamespace() {
    const binding = getConfiguredKVBinding();
    if (!binding) {
        console.log("No KV namespace binding configured in wrangler.toml; skipping KV setup.");
        return;
    }

    const namespaceId = getConfiguredKVNamespaceName();
    if (namespaceId) {
        console.log(`Using KV namespace for binding ${binding}: ${namespaceId}`);
        return;
    }

    console.log(
        `KV namespace binding ${binding} is configured but has no id. ` +
        "Please create it manually with: npx wrangler kv namespace create <NAME>",
    );
}

function updateWranglerTomlDatabaseId(databaseId) {
    let tomlContent = readWranglerConfig();
    if (tomlContent.includes("replace-with-your-d1-database-id")) {
        console.log("Updating wrangler.toml with the new database_id...");
        tomlContent = tomlContent.replace(/database_id\s*=\s*"[^"]+"/, `database_id = "${databaseId}"`);
        fs.writeFileSync(WRANGLER_CONFIG_PATH, tomlContent, "utf8");
    }
}

function setupDatabase() {
    const bindingName = getConfiguredD1Binding();
    const databaseName = getConfiguredDatabaseName();

    console.log(`Checking D1 database: ${databaseName}`);
    const database = resolveConfiguredDatabase(databaseName);
    const databaseId = database.uuid || database.id;

    if (!databaseId) {
        throw new Error(`D1 database ${databaseName} does not include an id`);
    }

    console.log(`Using D1 database ${databaseName}: ${databaseId}`);

    updateWranglerTomlDatabaseId(databaseId);
    runMigrations(bindingName);
}

function setupRootToken() {
    if (!options.autoRootToken) {
        console.log("Skipping ROOT_TOKEN setup. Pass --auto-create-root-token to create it automatically.");
        return;
    }

    const providedToken = process.env.ROOT_TOKEN;

    if (!providedToken) {
        console.error("\n==========================================");
        console.error(" ❌ [SECURITY ERROR] ROOT_TOKEN MISSING ❌");
        console.error("==========================================");
        console.error("For security reasons, we do not auto-generate the ROOT_TOKEN");
        console.error("in the deployment logs, because GitHub Actions logs for public forks are PUBLIC!");
        console.error("\n👉 HOW TO FIX: Go to your GitHub repository Settings -> Secrets and variables -> Actions,");
        console.error("and add a new secret named 'ROOT_TOKEN' with your own custom password.");
        console.error("Then re-run this deployment workflow.");
        console.error("==========================================\n");
        throw new Error("ROOT_TOKEN is required to set the Cloudflare Worker secret");
    }

    console.log("Setting ROOT_TOKEN secret from environment...");

    run("npx", ["wrangler", "secret", "put", "ROOT_TOKEN", ...prepareSecretWranglerArgs()], {
        input: `${providedToken}\n`,
        stdio: ["pipe", "inherit", "inherit"],
    });

    console.log("✅ ROOT_TOKEN has been securely set.");
}

function runDeploySetup() {
    if (hasDeploySetupFlags()) {
        console.log("Running Cloudflare deploy setup...");
        setupDatabase();
        setupKVNamespace();
    }

    setupR2Bucket();
}

function removeWranglerConfigArgs(args) {
    const result = [];
    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        if (arg === "--config" || arg === "-c") {
            i += 1;
            continue;
        }
        if (arg.startsWith("--config=")) {
            continue;
        }
        result.push(arg);
    }
    return result;
}

function prepareDeployWranglerArgs() {
    if (!skipR2Binding) {
        return wranglerArgs;
    }

    const args = removeWranglerConfigArgs(wranglerArgs);
    generatedWranglerConfigPath = path.resolve(
        path.dirname(WRANGLER_CONFIG_PATH),
        `.wrangler.no-r2.${process.pid}.toml`,
    );
    fs.writeFileSync(
        generatedWranglerConfigPath,
        stripR2BucketBindings(readWranglerConfig()),
        "utf8",
    );

    console.log(`Using temporary wrangler config without R2 binding: ${generatedWranglerConfigPath}`);
    if (skipR2BindingReason) {
        console.log(`R2 skip reason: ${skipR2BindingReason}`);
    }

    return ["--config", generatedWranglerConfigPath, ...args];
}

function cleanupGeneratedWranglerConfig() {
    if (!generatedWranglerConfigPath) {
        return;
    }

    fs.rmSync(generatedWranglerConfigPath, { force: true });
}

function prepareSecretWranglerArgs() {
    if (!generatedWranglerConfigPath) {
        return [];
    }

    return ["--config", generatedWranglerConfigPath];
}

function syncSubmodules() {
    if (!fs.existsSync(".gitmodules")) {
        return;
    }

    const gitHttpsRewriteEnv = {
        GIT_CONFIG_COUNT: "2",
        GIT_CONFIG_KEY_0: "url.https://github.com/.insteadOf",
        GIT_CONFIG_VALUE_0: "git@github.com:",
        GIT_CONFIG_KEY_1: "url.https://github.com/.insteadOf",
        GIT_CONFIG_VALUE_1: "ssh://git@github.com/",
    };

    console.log("Initializing git submodules...");
    run("git", ["submodule", "sync", "--recursive"], { env: gitHttpsRewriteEnv });
    run("git", ["submodule", "update", "--init", "--recursive"], { env: gitHttpsRewriteEnv });
}

function checkEnvironmentVariables() {
    console.log("Verifying environment variables...");
    const missing = [];
    if (!process.env.CLOUDFLARE_API_TOKEN) missing.push("CLOUDFLARE_API_TOKEN");
    if (!process.env.CLOUDFLARE_ACCOUNT_ID) missing.push("CLOUDFLARE_ACCOUNT_ID");
    if (!process.env.ROOT_TOKEN) missing.push("ROOT_TOKEN");

    if (missing.length > 0) {
        console.error("\n==========================================");
        console.error(" ❌ [ERROR] MISSING ENVIRONMENT VARIABLES ❌");
        console.error("==========================================");
        console.error(`The following required variables are missing: ${missing.join(", ")}`);
        console.error("Please configure them in GitHub Secrets and re-run the pipeline.");
        console.error("==========================================\n");
        process.exit(1);
    }
    console.log("✅ All required environment variables are present.");
}

let exitCode = 0;

try {
    checkEnvironmentVariables();
    runDeploySetup();
    syncSubmodules();
    run("npm", ["ci", "--prefix", "frontend", "--progress=false"]);
    run("npm", ["run", "frontend:build"]);
    run("npx", ["wrangler", "deploy", "--minify", ...prepareDeployWranglerArgs()]);
    setupRootToken();

    console.log("\n==========================================");
    console.log("    ✅ DEPLOYMENT SUCCESSFUL ✅");
    console.log("==========================================");
    console.log("ℹ️  Your ROOT_TOKEN is the value you configured in GitHub Secrets.");
    console.log("⚠️  If you modify the secret, please re-run this pipeline to apply the new value.");
    console.log("==========================================\n");

} catch (error) {
    console.error("Cloudflare deploy failed:", error.message);
    exitCode = 1;
} finally {
    cleanupGeneratedWranglerConfig();
}

if (exitCode !== 0) {
    process.exit(exitCode);
}
