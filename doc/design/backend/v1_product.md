# v1.0/v1.1 后端产品文档

## 项目概述

完成 AI 网关的基础管理功能后端 API，包括登录认证、用户管理、供应商管理和模型管理。

---

## 功能模块

### 登录认证（v1.0）

**API 接口**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 欢迎接口（验证 Token） |
| GET | `/status.json` | 系统状态查询 |

**响应示例**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "version": "1.0.0",
    "status": "running"
  }
}
```

---

### 用户管理（v1.0）

**API 接口**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/user/list.json` | 获取用户列表 |
| GET | `/user/:id` | 获取用户详情 |
| POST | `/user/create.json` | 创建用户 |
| PUT | `/user/:id` | 更新用户 |
| DELETE | `/user/:id` | 删除用户 |

**请求示例 - 创建用户**
```json
{
  "name": "user1",
  "token": "optional_token",
  "type": "normal"
}
```

**请求参数说明**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 用户名 |
| token | string | 否 | Token，为空时自动生成 |
| type | string | 否 | 用户类型：normal/admin |

**响应示例**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "name": "user1",
    "token": "sk-xxx...",
    "type": "normal",
    "created_at": "2026-03-20T00:00:00Z",
    "updated_at": "2026-03-20T00:00:00Z"
  }
}
```

---

### 供应商管理（v1.1）

**API 接口**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/vendor/list.json` | 获取供应商列表 |
| GET | `/vendor/:id` | 获取供应商详情 |
| POST | `/vendor/create.json` | 创建供应商 |
| PUT | `/vendor/:id` | 更新供应商 |
| DELETE | `/vendor/:id` | 删除供应商 |

**请求示例 - 创建供应商**
```json
{
  "type": "openai",
  "name": "OpenAI",
  "token": "sk-xxx...",
  "urls": {
    "chat": "https://api.openai.com/v1/chat/completions"
  },
  "format": "openai"
}
```

**请求参数说明**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 供应商类型 |
| name | string | 是 | 供应商名称 |
| token | string | 是 | API Token |
| urls | object | 否 | API 端点配置 |
| format | string | 是 | API 格式：openai/anthropic/google |

---

### 模型管理（v1.1）

**API 接口**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/model/list.json` | 获取模型列表 |
| GET | `/model/:id` | 获取模型详情 |
| POST | `/model/create.json` | 创建模型 |
| PUT | `/model/:id` | 更新模型 |
| DELETE | `/model/:id` | 删除模型 |

**请求示例 - 创建模型**
```json
{
  "name": "gpt-4",
  "vendor_id": 1,
  "enable": true
}
```

**请求参数说明**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 模型名称 |
| vendor_id | number | 是 | 供应商 ID |
| enable | boolean | 否 | 是否启用 |

---

## 数据库设计

### 用户表 (users)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer | 主键 |
| name | string | 用户名 |
| token | string | Token |
| type | string | 用户类型：normal/admin |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### 供应商表 (vendors)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer | 主键 |
| type | string | 供应商类型 |
| name | string | 供应商名称 |
| token | string | API Token |
| urls | string | URL 配置（JSON） |
| format | string | API 格式 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### 模型表 (models)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer | 主键 |
| name | string | 模型名称 |
| vendor_id | integer | 供应商 ID |
| enable | boolean | 是否启用 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

---

## 相关文档

- [前端产品文档](../frontend/v1/product.md)
- [前端技术实现方案](../frontend/v1/technical_design.md)