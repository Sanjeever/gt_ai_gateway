# v4.0 计费管理 - 前端技术实现文档

## 技术方案概述

基于现有项目结构，扩展计费管理功能。核心是用户余额管理、充值记录查询，整合在同一个页面通过 Tab 切换。

---

## 新增类型定义

**文件：`src/types/billing.ts`**

需要新增以下类型：
- `Model` - 扩展现有模型类型，新增 `input_price`、`output_price` 字段
- `User` - 扩展现有用户类型，新增 `balance` 字段
- `RechargeRecord` - 充值记录类型
- `AdjustBalanceRequest` - 余额调整请求类型
- `RechargeRecordsQuery` - 充值记录查询类型

---

## 新增 API 模块

**文件：`src/api/billing.ts`**

新增以下接口：
- `adjustUserBalance(userId, data)` - 调整用户余额
- `getRechargeRecords(query)` - 获取充值记录列表

**修改：`src/api/model.ts`**

- 现有 `updateModel` 方法支持传入 `input_price`、`output_price` 参数

---

## 新增页面组件

**目录结构：**
```
src/views/Balance/
├── Index.vue              # 余额管理主页面
└── components/
    ├── UserBalanceTable.vue        # 用户余额表格
    ├── BalanceAdjustDialog.vue     # 余额调整对话框
    └── RechargeRecordsTable.vue   # 充值记录表格
```

---

### 余额管理主页面

**文件：`src/views/Balance/Index.vue`**

**功能说明：**
- 使用 `a-tabs` 组件实现 Tab 切换
- 两个 Tab："余额管理"、"充值记录"
- 余额调整对话框的显隐控制
- 调整成功后刷新列表

**主要元素：**
- 页面标题："余额管理"
- `a-tabs` 组件
- 子组件：`UserBalanceTable`、`RechargeRecordsTable`、`BalanceAdjustDialog`

---

### 用户余额表格组件

**文件：`src/views/Balance/components/UserBalanceTable.vue`**

**功能说明：**
- 展示用户列表，包含余额列
- 充值按钮、扣减按钮
- 点击按钮触发 `adjust` 事件

**表格列：**
- 用户名
- 余额（格式化为货币格式）
- 操作（充值、扣减按钮）

**事件：**
- `adjust` - 触发余额调整对话框

---

### 余额调整对话框组件

**文件：`src/views/Balance/components/BalanceAdjustDialog.vue`**

**功能说明：**
- 使用 `a-modal` 对话框
- 表单包含：用户名（只读）、当前余额（只读）、调整类型（充值/扣减）、调整金额、备注
- 调用 `adjustUserBalance` API
- 成功后触发 `success` 事件

**表单字段：**
- 用户名 - 只读输入框
- 当前余额 - 只读输入框
- 调整类型 - RadioGroup（充值/扣减）
- 调整金额 - InputNumber（最小值 0，精度 2）
- 备注 - Textarea（可选）

---

### 充值记录表格组件

**文件：`src/views/Balance/components/RechargeRecordsTable.vue`**

**功能说明：**
- 展示充值记录列表
- 搜索：按用户名搜索
- 筛选：按时间范围筛选
- 分页支持

**搜索栏元素：**
- 用户名搜索框
- 日期范围选择器

**表格列：**
- 用户名
- 充值金额
- 充值后余额
- 备注
- 操作时间

---

## 路由配置

**修改：`src/router/index.ts`**

新增路由：
```typescript
{
  path: '/balance',
  name: 'Balance',
  component: () => import('@/views/Balance/Index.vue'),
  meta: { title: '余额管理' }
}
```

---

## 侧边栏菜单

**修改：`src/components/layout/AppSidebar.vue`**

新增菜单项：
```typescript
{
  key: '/balance',
  icon: 'money-collect',
  label: '余额管理'
}
```

---

## 修改现有组件

### 模型管理

**修改：`src/views/Model/components/EditDialog.vue`**

在编辑模型对话框中新增字段：
- 输入 Token 价格输入框（`input_price`）
- 输出 Token 价格输入框（`output_price`）

---

### 用户列表

**修改：`src/views/User/components/UserTable.vue`**

在表格中新增列：
- 余额列 - 显示用户余额，格式化为货币格式

---

## 相关文档

- [前端产品文档](./v4_billing_product.md)
- [后端技术文档](../backend/v4_billing_technical.md)