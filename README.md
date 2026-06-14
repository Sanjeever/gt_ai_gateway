# GT AI Gateway

一个轻量级、多环境适配的 AI 服务网关，支持 OpenAI 和 Anthropic API 格式的请求转发、模型路由和请求记录。

## 核心特性

- 🚀 **多运行模式**：支持 Serverless 部署、Docker 部署、本地源码运行以及跨平台桌面端应用 (App) 运行。
- 🔄 **协议转换与兼容**: 统一 API 入口，支持主流大模型协议（OpenAI、Anthropic 等）的自动适配与双向转换。
- 🔍 **请求分析与改写**: 深入解析请求上下文，支持在网关层对请求体和提示词进行拦截、分析及智能改写。
- 🔐 **用户管理与鉴权**: 支持把单个上游 API 分发给多用户使用，精准控制各自用量，有效防止上游 Key 泄漏。
- 💰 **额度管理与用量统计**: 内置精准的余额控制与计费机制，提供多维度的数据用量统计分析，实现成本的精细化控制。
- 📝 **完整请求记录**: 全量记录所有 AI 请求、响应日志以及耗时数据，方便进行排查、对账和二次分析。
- ⚡ **极轻量与高性能**: 低资源占用，无额外的独立数据库依赖。Serverless 模式下使用 Cloudflare 原生的 D1 数据库，其他环境下默认使用轻量级内嵌的 SQLite。

## 四种运行模式 (部署方案)

本项目具有极高的灵活性，你可以根据不同的使用场景选择最适合的运行和部署模式：

### 1. Serverless 部署 (Cloudflare Workers)
最适合追求极致弹性、零维护成本和高可用性的场景。可以将其部署至 Cloudflare Workers 等 Serverless 平台，享受边缘计算网络带来的低延迟和自动扩缩容。
- 结合 Cloudflare D1 等云端数据库进行数据持久化。
- 详见：[Cloudflare 部署文档](doc/deploy/CloudflareDeployment.md)。

### 2. Docker 部署 (推荐服务器使用)
最适合自建服务器部署的方式。开箱即用，容器化隔离，数据方便挂载与备份。

```bash
docker run -d \
    --name gt_ai_gateway \
    -p 8787:8787 \
    -v $(pwd)/data:/app/data \
    -e ROOT_TOKEN=your-secret-root-token \
    ghcr.io/alexazhou/gt_ai_gateway:latest
```
启动后访问 `http://localhost:8787` 即可进入管理界面。详见：[Docker 部署文档](doc/deploy/DockerDeployment.md)。

### 3. 桌面客户端 (App) 运行
最适合个人用户的即开即用模式。无需配置复杂的环境，直接下载安装包即可运行本地客户端。
- 前往项目的 [Releases 页面](https://github.com/alexazhou/gt_ai_gateway/releases) 下载对应操作系统的安装包即可直接使用。

### 4. Node 方式直接运行代码
适合二次开发、代码贡献者或希望在本地物理机环境原生运行服务的用户。
- 详见：[Node 方式部署文档](doc/deploy/SourceCodeDeployment.md)。

## 新手指南：从零开始配置

无论您使用哪种方式成功启动了系统，接下来您需要经过简单的几步配置才能开始对外提供模型调用服务。从添加渠道密钥、配置模型路由到分发令牌，请阅读这份 5 分钟上手教程：

👉 **[配置与使用指南：从零到一](doc/usage/ConfigurationGuide.md)**

## 文档索引

如果您希望参与到项目中，或者深入了解系统的运作原理，请参考以下详细文档：

- **基础部署与使用**
  - [Cloudflare 部署文档](doc/deploy/CloudflareDeployment.md)
  - [Docker 部署文档](doc/deploy/DockerDeployment.md)
  - [源码部署文档](doc/deploy/SourceCodeDeployment.md)
  - [系统配置与使用指南](doc/usage/ConfigurationGuide.md)
  - [LLM API 使用指南](doc/usage/LlmApiUsage.md)

- **开发人员手册**
  - [前端开发手册](doc/dev/FrontendDevManual.md): 包含前端环境配置、项目结构及开发命令。
  - [后端开发手册](doc/dev/BackendDevManual.md): 包含后端架构、环境配置、API 开发及数据库管理。
  - [Tauri 桌面开发手册](doc/dev/TauriDevManual.md): 包含 Tauri 目录结构、客户端运行和打包说明。
  - [测试手册](doc/dev/TestManual.md): 自动化测试环境架构设计、操作流程及调试方法。
  - [编程规范](GEMINI.md): 项目代码规范、开发技巧及 Git 提交指南。

## 许可证

[MIT License](LICENSE)
