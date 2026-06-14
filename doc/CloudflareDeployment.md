# Cloudflare Workers 部署文档

本项目原生支持部署到 Cloudflare Workers，享受边缘计算带来的低延迟、高可用和零服务器维护成本。数据持久化采用 Cloudflare D1 数据库。

---

## 1. 准备工作

1. 注册并登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2. 在本地安装 [Node.js](https://nodejs.org/) (推荐 v20 以上版本)。
3. 在项目根目录执行以下命令安装依赖：

```bash
npm install
cd frontend && npm install && cd ..
```

4. 安装并登录 Cloudflare 的命令行工具 Wrangler：

```bash
npx wrangler login
```
*这会打开浏览器并要求您授权 Wrangler 访问您的 Cloudflare 账号。*

---

## 2. 配置 Cloudflare D1 数据库

本项目使用 Cloudflare D1 作为 Serverless 数据库。您需要先在 Cloudflare 创建一个 D1 数据库，并将其绑定到项目中。

### 创建 D1 数据库

在项目根目录运行以下命令创建一个名为 `gt_ai_gateway_db` 的数据库：

```bash
npx wrangler d1 create gt_ai_gateway_db
```

命令执行成功后，控制台会输出一段类似如下的配置信息：

```toml
[[d1_databases]]
binding = "DB" # 不可修改，代码中依赖此名称
database_name = "gt_ai_gateway_db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 修改 wrangler.toml

打开项目根目录下的 `wrangler.toml` 文件，找到 `[[d1_databases]]` 配置块，将上述输出的 `database_id` 替换到文件中：

```toml
[[d1_databases]]
binding = "DB"
database_name = "gt_ai_gateway_db"
database_id = "这里填入你刚刚生成的 database_id"
```

---

## 3. 初始化数据库表结构

将数据库的 Schema 和表结构应用到刚才创建的 D1 数据库中（注意区分本地测试和远程生产环境）。

### (可选) 本地测试初始化
```bash
npx wrangler d1 migrations apply gt_ai_gateway_db --local
```

### 远程生产环境初始化 (必须)
```bash
npx wrangler d1 migrations apply gt_ai_gateway_db --remote
```
*遇到提示时输入 `y` 确认执行。*

---

## 4. 配置 ROOT_TOKEN

`ROOT_TOKEN` 是登录管理后台和调用管理 API 的超级管理员密码。

在 Cloudflare Workers 中，我们通过 Secrets 来安全地存储环境变量：

```bash
npx wrangler secret put ROOT_TOKEN
```
*输入命令后，终端会提示您输入秘钥值，请设置一个强密码并牢记。*

---

## 5. 部署到 Cloudflare

以上准备工作完成后，可以直接执行一键部署命令。该命令会自动构建前端静态页面和后端代码，并将它们打包发布到 Cloudflare Workers：

```bash
npm run backend:deploy
```

部署成功后，控制台会输出一个类似 `https://serverless-ai-gateway.your-subdomain.workers.dev` 的访问链接。

---

## 6. 访问系统

在浏览器中打开部署成功后输出的链接，输入您刚才配置的 `ROOT_TOKEN` 即可登录进入管理后台。

后续的具体使用和渠道配置，请参考 [系统配置指南](ConfigurationGuide.md)。
