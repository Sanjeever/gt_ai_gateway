# Cloudflare Workers 部署文档

本项目原生支持部署到 Cloudflare Workers，享受边缘计算带来的低延迟、高可用和零服务器维护成本。数据持久化采用 Cloudflare D1 数据库，请求/响应记录的原始载荷则存放在 Cloudflare R2 对象存储中（与 D1 分离，避免大文本拖累数据库查询）。

---

## 方案一：GitHub Actions 自动化部署 (推荐)

为了保证您未来能够无损、顺畅地获取项目更新，我们强烈建议您通过 GitHub Actions 进行自动化部署。此方案会自动为您完成 D1 数据库创建、R2 对象存储桶创建、表结构初始化以及代码发布。

### 第一步：Fork 本项目
请先点击页面右上角的 **Fork** 按钮，将本项目克隆到您自己的 GitHub 账号下。**这是后续能够享受一键自动升级的前提条件！**

<img src="../../images/do_fork.png" width="50%" alt="Fork 本项目">

### 第二步：获取 Cloudflare 部署凭证 (环境变量)
您需要准备两个 Cloudflare 凭证，以便 GitHub Actions 能够替您自动部署。获取方法非常简单：

1. **获取 Account ID**：
   - 登录 [Cloudflare 后台](https://dash.cloudflare.com/?to=/:account/workers-and-pages)，点击左侧菜单的 `Workers & Pages`。
   - 此时观察浏览器上方的地址栏 URL，格式通常为：`https://dash.cloudflare.com/一串由字母和数字组成的32位长字符/workers-and-pages`。
   - **这串 32 位的长字符**，就是您的 `Account ID`。复制下来备用。
   - *(或者您可以在页面右侧边栏下拉寻找 `Account ID` 并点击复制)*。

<img src="../../images/get_cloudflare_account_id.png" width="50%" alt="获取 Account ID">

2. **获取 API Token**：
   - 直接点击专属快捷链接前往 API 令牌管理页：[https://dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
   - 点击右侧的 `Create Token` (创建令牌) 按钮，拉到最下方选择 `Create Custom Token` (创建自定义令牌)。
   
   第一步

   <img src="../../images/create_token_step_1.png" width="50%" alt="创建自定义令牌">
   
   第二步

   <img src="../../images/create_token_step_2.png" width="50%" alt="创建自定义令牌">

   - **Token 名称 (Token name)**：随便填，比如 `GitHub Actions Deploy`。
   
   - **权限配置 (Permissions)**：点击 `Add more`，确保完整添加以下 **四项** 权限：
     - `Account` (帐户) | `D1` | `Edit` (编辑)
     - `Account` (帐户) | `Worker Scripts` (Worker 脚本) | `Edit` (编辑)
     - `Account` (帐户) | `Workers KV Storage` (Workers KV 存储) | `Edit` (编辑)
     - `Account` (帐户) | `Workers R2 Storage` (Workers R2 存储) | `Edit` (编辑)
   - 其它选项保持默认，拉到最下面点击 `Continue to summary`，然后点击 `Create Token`。
   - ⚠️ **核心警告**：此时屏幕上会显示出这串 Token 密钥，**它只显示这一次！刷新就会永远消失！** 请务必立刻将它复制下来备用。

   <img src="../../images/set_token_permissions.png" width="50%" alt="配置 Token 权限">

### 第三步：配置 GitHub Secrets
回到您刚才 Fork 的 GitHub 仓库页面：
1. 点击顶部的 `Settings` -> 左侧菜单的 `Secrets and variables` -> `Actions`。
2. 点击 `New repository secret`，添加以下两个 Secret：
   - Name: `CLOUDFLARE_ACCOUNT_ID`，Value 填入您刚才复制的 Account ID。
   - Name: `CLOUDFLARE_API_TOKEN`，Value 填入您刚才生成的 API Token。
   - Name: `ROOT_TOKEN`，请填入您自定义的后台管理员密码。

<img src="../../images/set_github_action_secret.png" width="50%" alt="配置 GitHub Secrets">

### 第四步：触发自动部署
1. 点击仓库顶部的 `Actions` 标签页。
2. 在左侧列表中选择 `Deploy to Cloudflare` 工作流。
3. 如果看到 "Workflows aren’t being run on this forked repository"，请点击绿色的 `I understand my workflows, go ahead and enable them` 按钮。
4. 点击右侧的 `Run workflow` 按钮并确认执行。
5. 脚本会自动完成 D1 数据库创建/绑定、R2 对象存储桶创建、表结构迁移和代码发布（约耗时 1~2 分钟）。
6. **访问管理后台**：点开执行成功的 Action 详情，展开 `Deploy` 步骤，在日志最末尾您会看到应用的 **访问链接**。点击链接，并输入您在前面步骤中配置的 **ROOT_TOKEN** 即可登录系统。

<img src="../../images/run_cloudflare_deploy.png" width="50%" alt="触发自动部署">

### 如何修改或自定义 ROOT_TOKEN？
如果您想更新自己的后台管理员密码（即 ROOT_TOKEN），可以通过以下两种方式配置：

**方式一：通过 GitHub Secrets (推荐)**
1. 进入 GitHub 仓库 `Settings` -> 左侧 `Secrets and variables` -> `Actions`。
2. 添加或更新名为 `ROOT_TOKEN` 的 Repository Secret，填入您的自定义密码。
3. 回到 `Actions` 页面，手动触发一次 `Deploy to Cloudflare` 工作流，部署完成后新密码即刻生效。

**方式二：通过 Cloudflare 控制台**
1. 登录 Cloudflare 面板，进入左侧菜单的 `Workers & Pages`。
2. 点击您的网关服务实例（默认名为 `gt-ai-gateway`）。
3. 点击 `Settings` (设置) 选项卡 -> 左侧选择 `Variables and Secrets`。
4. 找到 `ROOT_TOKEN` 变量，点击 `Edit` 修改为新密码，保存后 Cloudflare 会在后台自动应用生效。

### 后续无损更新（一键热升级）

未来当本开源项目发布了新版本时，您**只需一步操作**即可完成升级：
1. 登录您的 GitHub，进入您 Fork 的仓库。
2. 点击页面上方的 **Sync fork -> Update branch** 按钮。
3. 同步完成后，由于您仓库的代码发生了变化（`push` 到 `master`），GitHub Actions 会**自动触发**部署流程，智能保留您的 D1 数据库并热更最新代码，实现无损升级！

<img src="../../images/upgrade_code.png" width="50%" alt="一键同步更新">

---

## 方案二：本地手动命令行部署 (高级开发者)

如果您希望在本地深度定制开发，可以通过命令行工具 Wrangler 手动部署。

### 1. 准备工作

1. 在本地安装 [Node.js](https://nodejs.org/) (推荐 v20 以上版本)。
2. 在项目根目录执行以下命令安装依赖：

```bash
npm install
cd frontend && npm install && cd ..
```

3. 安装并登录 Cloudflare 的命令行工具 Wrangler：

```bash
npx wrangler login
```
*这会打开浏览器并要求您授权 Wrangler 访问您的 Cloudflare 账号。*

### 2. 配置 Cloudflare D1 数据库

在项目根目录运行以下命令创建一个名为 `gt_ai_gateway` 的数据库：

```bash
npx wrangler d1 create gt_ai_gateway
```

命令执行成功后，将控制台输出的 `database_id` 填入项目根目录的 `wrangler.toml` 文件中：

```toml
[[d1_databases]]
binding = "DB"
database_name = "gt_ai_gateway"
database_id = "这里填入你刚刚生成的 database_id"
```

### 3. 配置 Cloudflare R2 对象存储桶

请求/响应的原始载荷（request body / response body）存放在 R2 中，与 D1 分离。`wrangler.toml` 默认已声明如下绑定：

```toml
[[r2_buckets]]
binding = "OBJECT_BUCKET"
bucket_name = "gt-ai-gateway-objects"
```

创建对应的 R2 桶（名称需与 `bucket_name` 一致）：

```bash
npx wrangler r2 bucket create gt-ai-gateway-objects
```

> 若想改用已有的 R2 桶，把 `bucket_name` 改成你的桶名即可，无需重新创建。

### 4. 初始化数据库表结构

将数据库的 Schema 和表结构应用到远程生产环境：
```bash
npm run db:migrate:worker-cloud
```
该命令会通过 `wrangler.toml` 中的 `DB` binding 连接远程 D1，并执行项目内置的 `resource/migrate` 迁移脚本。

### 5. 配置 ROOT_TOKEN

在 Cloudflare Workers 中，我们通过 Secrets 来安全地存储环境变量：

```bash
npx wrangler secret put ROOT_TOKEN
```
*输入命令后，终端会提示您输入秘钥值，请设置一个强密码并牢记。*

### 6. 发布上线

```bash
npm run deploy
```

部署成功后，控制台会输出一个类似 `https://serverless-ai-gateway.your-subdomain.workers.dev` 的访问链接。

项目推荐统一使用标准部署入口。该命令会执行远程 migrations，并在缺失时自动配置 `ROOT_TOKEN`。

如果需要让部署脚本自动创建/绑定 D1 数据库和 R2 对象存储桶，使用：

```bash
npm run deploy -- --auto-create-db --auto-create-r2
```

底层脚本仍然可以直接调用：

```bash
npm run deploy:cloudflare
```

部署脚本会优先读取当前已部署 Worker 的 `DB` D1 binding 并复用原有数据库，因此已部署实例的数据库名称不需要固定为 `gt_ai_gateway`。如果当前账号下还没有已部署的 Worker，脚本才会按 `wrangler.toml` 中的 `database_name` 查找 D1 数据库；找不到时，只有传入 `--auto-create-db` 才会自动创建，否则直接报错。R2 桶同理：脚本会按 `wrangler.toml` 中的 `bucket_name` 查找，找不到时只有传入 `--auto-create-r2` 才会自动创建，否则报错（也可用 `npx wrangler r2 bucket create <bucket_name>` 手动创建）。

标准 `npm run deploy` 已包含 `--auto-create-root-token`。如果直接调用底层 `npm run deploy:cloudflare` 且不传该参数，请手动使用 `npx wrangler secret put ROOT_TOKEN` 配置。

---

## 访问系统与后续配置

无论您使用哪种方式部署，在浏览器中打开部署成功后输出的链接，输入您的 `ROOT_TOKEN` 即可登录进入管理后台。

后续的具体使用和渠道配置，请参考 [系统配置指南](../ConfigurationGuide.md)。
