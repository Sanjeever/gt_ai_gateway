# v2.0/v2.1 后端产品文档

## 版本概述

实现监控分析功能后端 API，包括请求记录查看、仪表盘统计和 API 测试工具。

---

## 功能模块

### 请求记录（v2.0）

**API 接口**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/record/list.json` | 获取请求记录列表 |
| GET | `/record/latest.json` | 获取最新记录 |
| GET | `/record/:id` | 获取记录详情 |
| DELETE | `/record/:id` | 删除记录 |

**请求参数说明**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 否 | 按状态筛选：success/failed |
| user_name | string | 否 | 按用户名搜索 |
| model_name | string | 否 | 按模型名搜索 |
| start_time | string | 否 | 开始时间 |
| end_time | string | 否 | 结束时间 |
| page | number | 否 | 页码，默认 1 |
| page_size | number | 否 | 每页数量，默认 20 |

**响应示例**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total": 100,
    "page": 1,
    "page_size": 20,
    "items": [
      {
        "id": 1,
        "user_id": 1,
        "user_name": "user1",
        "vendor_id": 1,
        "vendor_name": "OpenAI",
        "model_id": 1,
        "model_name": "gpt-4",
        "status": "success",
        "request_data": {...},
        "response_data": {...},
        "created_at": "2026-03-20T00:00:00Z"
      }
    ]
  }
}
```

---

### 统计数据（v2.1）

**API 接口**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/stats/dashboard.json` | 获取仪表盘统计 |
| GET | `/stats/recent.json` | 获取最近记录 |

**响应示例 - 仪表盘统计**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total_requests": 1000,
    "success_rate": 95.5,
    "active_users": 10,
    "active_models": 5,
    "today_requests": 50
  }
}
```

**响应示例 - 最近记录**
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": 1,
      "user_name": "user1",
      "model_name": "gpt-4",
      "status": "success",
      "created_at": "2026-03-20T00:00:00Z"
    }
  ]
}
```

---

### AI 调用接口（v2.1）

**API 接口**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/v1/chat/completions` | OpenAI 格式聊天接口 |
| POST | `/v1/messages` | Anthropic 格式消息接口 |

**请求示例 - Chat Completions**
```json
{
  "model": "gpt-4",
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "stream": true
}
```

**流式响应（SSE）**
```
data: {"id":"...","choices":[{"delta":{"content":"Hello"}}]}

data: [DONE]
```

---

## 数据库设计

### 请求记录表 (request_records)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer | 主键 |
| user_id | integer | 用户 ID |
| vendor_id | integer | 供应商 ID |
| model_id | integer | 模型 ID |
| status | string | 状态：success/failed |
| request_data | string | 请求数据（JSON） |
| response_data | string | 响应数据（JSON） |
| error_message | string | 错误信息 |
| created_at | datetime | 创建时间 |

---

## 相关文档

- [前端产品文档](../frontend/v2/product.md)
- [前端技术实现方案](../frontend/v2/technical_design.md)