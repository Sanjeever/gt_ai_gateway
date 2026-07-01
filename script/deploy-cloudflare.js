const { execFileSync, spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");

const WRANGLER_CONFIG_PATH = "wrangler.toml";
const DEFAULT_DATABASE_NAME = "gt_ai_gateway";
const DEFAULT_D1_BINDING = "DB";
const DEPLOY_SETUP_FLAGS = new Set(["--auto-create-db", "--auto-migrate", "--auto-create-root-token"]);

const options = {
    autoCreateDb: false,
    migrate: false,
    autoRootToken: false,
};
const wranglerArgs = [];

function printHelp() {
    console.log("Usage:");
    console.log("  npm run deploy");
    console.log("  npm run deploy -- --auto-create-db");
    console.log("  npm run deploy:cloudflare");
    console.log("  npm run deploy:cloudflare -- --auto-create-db --auto-migrate --auto-create-root-token");
    console.log("");
    console.log("Options:");
    console.log("  --auto-create-db  Create the configured D1 database if no existing database can be resolved.");
    console.log("  --auto-migrate    Apply D1 migrations before deploy.");
    console.log("  --auto-create-root-token Create ROOT_TOKEN if it does not already exist.");
    console.log("  --help, -h        Show this help message.");
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
        console.error(result.error.message);
        process.exit(1);
    }

    if (result.status !== 0) {
        process.exit(result.status || 1);
    }

    return result.stdout ? String(result.stdout) : "";
}

function runAndCapture(command, commandArgs) {
    return execFileSync(command, commandArgs, {
        encoding: "utf8",
        stdio: "pipe",
    });
}

function hasDeploySetupFlags() {
    return options.autoCreateDb || options.migrate || options.autoRootToken;
}

function readWranglerConfig() {
    return fs.readFileSync(WRANGLER_CONFIG_PATH, "utf8");
}

function getConfiguredDatabaseName() {
    const toml = readWranglerConfig();
    const match = toml.match(/database_name\s*=\s*"([^"]+)"/);
    return match?.[1] || DEFAULT_DATABASE_NAME;
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

function findDatabaseById(databaseId) {
    try {
        return listDatabases().find((database) =>
            database.uuid === databaseId || database.id === databaseId
        );
    } catch (err) {
        return null;
    }
}

function getCurrentProductionVersionId(workerName) {
    const args = ["wrangler", "deployments", "status", "--json"];
    if (workerName) {
        args.push("--name", workerName);
    }

    const status = JSON.parse(runAndCapture("npx", args));
    const productionVersion = status.versions?.find((version) => version.percentage === 100) ||
        status.versions?.[0];

    return productionVersion?.version_id;
}

function getVersionBindings(workerName, versionId) {
    const args = ["wrangler", "versions", "view", versionId, "--json"];
    if (workerName) {
        args.push("--name", workerName);
    }

    const version = JSON.parse(runAndCapture("npx", args));
    return version.resources?.bindings || [];
}

function findDeployedD1Binding(bindingName) {
    try {
        const workerName = getConfiguredWorkerName();
        const versionId = getCurrentProductionVersionId(workerName);

        if (!versionId) {
            return null;
        }

        const bindings = getVersionBindings(workerName, versionId);
        return bindings.find((binding) =>
            binding.type === "d1" && binding.name === bindingName
        ) || null;
    } catch (err) {
        console.log("No existing deployed D1 binding found.");
        return null;
    }
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
    const deployedBinding = findDeployedD1Binding(bindingName);

    if (deployedBinding) {
        const databaseId = deployedBinding.database_id || deployedBinding.id;

        if (!databaseId) {
            throw new Error(`Deployed D1 binding ${bindingName} does not include a database_id`);
        }

        const database = findDatabaseById(databaseId);
        const databaseLabel = database?.name || databaseId;
        console.log(`Reusing deployed D1 binding ${bindingName}: ${databaseLabel}`);

        updateWranglerTomlDatabaseId(databaseId);
        runMigrations(bindingName);
        return;
    }

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

    console.log("Checking ROOT_TOKEN...");

    try {
        const secrets = runAndCapture("npx", ["wrangler", "secret", "list"]);
        const providedToken = process.env.ROOT_TOKEN;
        
        if (secrets.includes("ROOT_TOKEN") && !providedToken) {
            console.log("ROOT_TOKEN already exists in Cloudflare.");
            return;
        }

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
            process.exit(1);
        }

        console.log("Setting custom ROOT_TOKEN from environment...");
        
        run("npx", ["wrangler", "secret", "put", "ROOT_TOKEN"], {
            input: `${providedToken}\n`,
            stdio: ["pipe", "inherit", "inherit"],
        });

        console.log("✅ Custom ROOT_TOKEN has been securely set.");
    } catch (err) {
        console.error("Error checking/setting secrets:", err.message);
        process.exit(1);
    }
}

function runDeploySetup() {
    if (!hasDeploySetupFlags()) {
        return;
    }

    console.log("Running Cloudflare deploy setup...");
    setupDatabase();
    setupRootToken();
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

function verifyTokenPermissions() {
    console.log("Verifying Cloudflare API Token permissions...");
    try {
        const output = runAndCapture("npx", ["wrangler", "whoami"]);
        
        const requiredPermissions = [
            { name: "Worker Scripts", check: (out) => out.includes("Worker Scripts: Edit") || out.includes("Workers Scripts: Edit") },
            { name: "D1", check: (out) => out.includes("D1: Edit") },
            { name: "Workers KV Storage", check: (out) => out.includes("KV Storage: Edit") }
        ];
        
        const missingPermissions = [];
        
        for (const p of requiredPermissions) {
            if (!p.check(output)) {
                missingPermissions.push(p.name);
            }
        }
        
        if (missingPermissions.length > 0) {
            console.error("\n==========================================");
            console.error(" ❌ [ERROR] INSUFFICIENT TOKEN PERMISSIONS ❌");
            console.error("==========================================");
            console.error(`Your CLOUDFLARE_API_TOKEN is missing the following permissions:`);
            missingPermissions.forEach(p => console.error(`  - Account | ${p} | Edit`));
            console.error("\nPlease go to Cloudflare Dashboard -> My Profile -> API Tokens,");
            console.error("and edit your token to ensure it has 'Edit' access for these permissions.");
            console.error("==========================================\n");
            process.exit(1);
        }
        
        console.log("✅ API Token permissions verified.");
    } catch (err) {
        console.error("\n==========================================");
        console.error(" ❌ [ERROR] INVALID CLOUDFLARE_API_TOKEN ❌");
        console.error("==========================================");
        console.error("Failed to verify API Token. Please ensure your token is correct.");
        console.error("Error details:", err.message);
        console.error("==========================================\n");
        process.exit(1);
    }
}

try {
    checkEnvironmentVariables();
    verifyTokenPermissions();
    runDeploySetup();
    syncSubmodules();
    run("npm", ["ci", "--prefix", "frontend", "--progress=false"]);
    run("npm", ["run", "frontend:build"]);
    run("npx", ["wrangler", "deploy", "--minify", ...wranglerArgs]);

    console.log("\n==========================================");
    console.log("    ✅ DEPLOYMENT SUCCESSFUL ✅");
    console.log("==========================================");
    console.log("ℹ️  Your ROOT_TOKEN is the value you configured in GitHub Secrets.");
    console.log("⚠️  If you modify the secret, please re-run this pipeline to apply the new value.");
    console.log("==========================================\n");

} catch (error) {
    console.error("Cloudflare deploy failed:", error.message);
    process.exit(1);
}
