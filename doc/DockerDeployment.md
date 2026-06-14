# Docker 部署文档

本文档描述如何使用 Docker 部署 serverless-ai-gateway。

---

## 使用 Docker Compose

### 1. 创建环境变量文件

在项目根目录创建 `.env` 文件：

```bash
ROOT_TOKEN=your-secret-root-token
PORT=8787
DB_PATH=/app/data/local.db
```

> **注意**：`ROOT_TOKEN` 是系统最高权限 Token，用于登录管理后台。请务必修改为强密码。

### 2. 启动服务

```bash
# 构建并启动（后台运行）
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 3. 访问服务

服务启动后，访问 `http://localhost:8787` 即可使用。

### 4. 数据持久化

服务使用单个挂载目录持久化所有数据：

| 宿主机目录 | 容器目录 | 说明 |
|-----------|---------|------|
| `./data` | `/app/data` | 数据库文件和应用日志 |

日志文件位于宿主机的 `./data/log` 目录下，按日期命名（如 `app-2026-03-16.log`）。

---

## 使用 Docker 直接构建和运行

### 构建镜像

```bash
docker build -t gt_ai_gateway .
```

### 运行容器

```bash
docker run -d \
    --name gt_ai_gateway \
    -p 8787:8787 \
    -v $(pwd)/data:/app/data \
    -e ROOT_TOKEN=your-secret-root-token \
    gt_ai_gateway
```

### 常用操作

```bash
# 查看日志
docker logs -f gt_ai_gateway

# 停止容器
docker stop gt_ai_gateway

# 启动容器
docker start gt_ai_gateway

# 删除容器
docker rm -f gt_ai_gateway
```

### 直接执行 db 工具

```bash
docker exec -it gt_ai_gateway npx tsx script/db.ts status --env node
docker exec -it gt_ai_gateway npm run db:migrate:node
```

---

## 使用 GitHub 镜像 (推荐)

### 拉取镜像

```bash
docker pull ghcr.io/alexazhou/gt_ai_gateway:latest
```

### 运行容器

```bash
docker run -d \
    --name gt_ai_gateway \
    -p 8787:8787 \
    -v $(pwd)/data:/app/data \
    -e ROOT_TOKEN=your-secret-root-token \
    ghcr.io/alexazhou/gt_ai_gateway:latest
```

---

## Dockerfile 说明

项目采用多阶段构建优化镜像大小：

1. **构建阶段** (`builder`)：
   - 安装前端和后端依赖
   - 构建前端静态资源

2. **生产阶段**：
   - 只复制必要的运行时文件
   - 安装 `libstdc++` 以支持 `better-sqlite3`
   - 创建日志和数据目录

### 镜像信息

| 配置项 | 值 |
|-------|-----|
| 基础镜像 | `node:20-alpine` |
| 暴露端口 | `8787` |
| 数据库路径 | `/app/data/local.db` |
| 日志路径 | `/app/data/log`（Docker 镜像内置默认值） |
| 健康检查 | 每 30 秒检查 `/welcome` 端点 |

---

## 健康检查

容器内置健康检查机制：

- **检查间隔**：30 秒
- **超时时间**：3 秒
- **重试次数**：3 次
- **检查端点**：`http://localhost:8787/welcome`

可以通过以下命令查看健康状态：

```bash
docker inspect --format='{{.State.Health.Status}}' gt_ai_gateway
```

---

## 故障排查

### 容器无法启动

```bash
# 查看容器日志
docker logs gt_ai_gateway

# 进入容器排查
docker exec -it gt_ai_gateway sh
```

### 数据库初始化失败

确保 `./data` 目录有写权限：

```bash
chmod 755 ./data
```

### 日志未写入

检查宿主机 `./data` 目录是否有写权限（日志会写入到 `./data/log` 子目录）：

```bash
chmod 755 ./data
```

---

## 相关文档

- **后端开发手册**：`doc/BackendDevManual.md`
- **前端开发手册**：`doc/FrontendDevManual.md`
- **LLM API 使用指南**：`doc/LlmApiUsage.md`
