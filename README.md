# GT AI Gateway

一个轻量级、多环境适配的 AI 服务网关，支持 OpenAI 和 Anthropic API 格式的请求转发、模型路由和请求记录。

## 核心特性

- **多运行模式**：支持 Serverless 部署、Docker 部署、本地源码运行以及跨平台桌面端应用 (App) 运行。
- **协议转换与兼容**: 统一 API 入口，支持主流大模型协议（OpenAI、Anthropic 等）的自动适配与双向转换。
- **请求分析与改写**: 深入解析请求上下文，支持在网关层对请求体和提示词进行拦截、分析及智能改写。
- **额度管理与用量统计**: 内置精准的余额控制与计费机制，提供多维度的数据用量统计分析，实现成本的精细化控制。
- **模型智能路由**: 支持将用户的请求无缝分发、路由到多个不同的 AI 模型服务和下游供应商。
- **用户管理与鉴权**: 基于 Token 的用户认证与权限体系，针对不同用户提供隔离的访问控制。
- **完整请求记录**: 全量记录所有 AI 请求、响应日志以及耗时数据，方便进行排查、对账和二次分析。
- **流式响应**: 原生支持 SSE（Server-Sent Events）流式输出，确保实时、低延迟的交互体验。

## 四种运行模式 (部署方案)

本项目具有极高的灵活性，你可以根据不同的使用场景选择最适合的运行和部署模式：

### 1. Serverless 部署 (Cloudflare Workers)
最适合追求极致弹性、零维护成本和高可用性的场景。可以将其部署至 Cloudflare Workers 等 Serverless 平台，享受边缘计算网络带来的低延迟和自动扩缩容。
- 结合 Cloudflare D1 等云端数据库进行数据持久化。
- 详见：[后端开发手册 - 部署说明](doc/BackendDevManual.md#部署说明)。

### 2. Docker 部署 (推荐服务器使用)
最适合自建服务器部署的方式。开箱即用，容器化隔离，数据方便挂载与备份。

```bash
docker run -d \
    --name gt_ai_gateway \
    -p 8787:8787 \
    -v $(pwd)/data:/app/data \
    -e ROOT_TOKEN=your-secret-root-token \
    alexazhou/gt_ai_gateway:latest
```
启动后访问 `http://localhost:8787` 即可进入管理界面。详见：[Docker 部署文档](doc/DockerDeployment.md)。

### 3. 本地代码运行 (Node.js 源码运行)
适合二次开发、代码贡献者或希望在本地物理机环境原生运行服务的用户。
```bash
# 1. 安装依赖
npm install
cd frontend && npm install && cd ..

# 2. 配置环境
cp .env.example .env # 随后根据需要编辑 .env

# 3. 启动服务 (双终端执行)
npm run backend:dev:local  # 启动后端
npm run frontend:dev       # 启动前端
```

### 4. 桌面客户端 (App) 运行
最适合个人用户的即开即用模式。前端界面结合 Rust 编写的 Tauri 容器，无需配置复杂的环境，直接运行本地客户端。数据完全本地存储，兼顾隐私和使用的便捷性。
- 开发环境下启动客户端：`npm run tauri dev`
- 构建安装包：`npm run tauri build`
- 详见：[Tauri 桌面应用开发手册](doc/TauriDevManual.md)。

## 文档索引

如果您希望参与到项目中，或者深入了解系统的运作原理，请参考以下详细文档：

- **[前端开发手册](doc/FrontendDevManual.md)**: 包含前端环境配置、项目结构及开发命令。
- **[后端开发手册](doc/BackendDevManual.md)**: 包含后端架构、环境配置、API 开发及数据库管理。
- **[Tauri 桌面开发手册](doc/TauriDevManual.md)**: 包含 Tauri 目录结构、客户端运行和打包说明。
- **[Docker 部署文档](doc/DockerDeployment.md)**: 包含 Docker 和 Docker Compose 的配置指南。
- **[测试手册](doc/TestManual.md)**: 自动化测试环境架构设计、操作流程及调试方法。
- **[编程规范](GEMINI.md)**: 项目代码规范、开发技巧及 Git 提交指南。

## 许可证

[MIT License](LICENSE)
