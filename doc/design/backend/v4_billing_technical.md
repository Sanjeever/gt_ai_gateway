# v4.0 计费管理 - 后端技术实现文档

## 技术概述

实现用户余额管理和模型计费功能的后端 API，包括模型价格配置、余额调整、充值记录、自动停止服务和计费统计。

---

## API 接口

### 模型价格配置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/model/list.json` | 获取模型列表（含价格） |
| PUT | `/model/:id` | 更新模型（包含价格） |

**请求示例 - 更新模型**
```json
{
  "name": "gpt-4",
  "vendor_id": 1,
  "enable": true,
  "input_price": 0.001,
  "output_price": 0.002
}
```

**响应示例**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "name": "gpt-4",
    "vendor_id": 1,
    "enable": true,
    "input_price": 0.001,
    "output_price": 0.002,
    "created_at": "2026-03-20T00:00:00Z",
    "updated_at": "2026-03-20T00:00:00Z"
  }
}
```

---

### 用户余额管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/user/list.json` | 获取用户列表（含余额） |
| POST | `/user/:id/balance/adjust.json` | 调整用户余额 |

**请求示例 - 调整用户余额**
```json
{
  "type": "recharge",
  "amount": 100.00,
  "remark": "充值"
}
```

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 调整类型：recharge/deduct |
| amount | number | 是 | 调整金额 |
| remark | string | 否 | 备注信息 |

**响应示例**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "name": "user1",
    "balance": 150.00
  }
}
```

---

### 充值记录

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/balance/recharge/list.json` | 获取充值记录列表 |

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 否 | 按用户名搜索 |
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
    "total": 50,
    "page": 1,
    "page_size": 20,
    "items": [
      {
        "id": 1,
        "user_id": 1,
        "username": "admin",
        "amount": 100.00,
        "balance_after": 100.00,
        "remark": "充值",
        "created_at": "2026-03-20T00:00:00Z"
      }
    ]
  }
}
```

---

## 数据库设计

### 修改表：users

| 字段 | 类型 | 说明 |
|------|------|------|
| balance | decimal | 当前余额，默认 0 |

**迁移文件**
```ruby
add_column :users, :balance, :decimal, default: 0, precision: 10, scale: 2
```

---

### 修改表：models

| 字段 | 类型 | 说明 |
|------|------|------|
| input_price | decimal | 输入 Token 价格（元/千 Token），默认 0 |
| output_price | decimal | 输出 Token 价格（元/千 Token），默认 0 |

**迁移文件**
```ruby
add_column :models, :input_price, :decimal, default: 0, precision: 16, scale: 8
add_column :models, :output_price, :decimal, default: 0, precision: 16, scale: 8
```

---

### 新增表：recharge_records

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer | 主键 |
| user_id | integer | 用户 ID |
| amount | decimal | 充值金额 |
| balance_after | decimal | 充值后余额 |
| remark | string | 备注 |
| created_at | datetime | 创建时间 |

**迁移文件**
```ruby
create_table :recharge_records do |t|
  t.integer :user_id, null: false
  t.decimal :amount, null: false, precision: 10, scale: 2
  t.decimal :balance_after, null: false, precision: 10, scale: 2
  t.string :remark
  t.datetime :created_at, null: false

  t.index :user_id
end
```

---

### 修改表：request_records

| 字段 | 类型 | 说明 |
|------|------|------|
| cost | decimal | 消费金额 |

**迁移文件**
```ruby
add_column :request_records, :cost, :decimal, default: 0, precision: 16, scale: 8
```

---

## 代码结构

### Model 层

```ruby
# app/models/user.rb
class User < ApplicationRecord
  has_many :recharge_records

  def recharge!(amount, remark = nil)
    transaction do
      update!(balance: balance + amount)
      recharge_records.create!(amount: amount, balance_after: balance, remark: remark)
    end
  end

  def deduct!(amount)
    update!(balance: balance - amount)
  end

  def sufficient_balance?(amount)
    balance >= amount
  end
end

# app/models/model.rb
class Model < ApplicationRecord
  belongs_to :vendor
end

# app/models/recharge_record.rb
class RechargeRecord < ApplicationRecord
  belongs_to :user
end
```

---

### Controller 层

```ruby
# app/controllers/models_controller.rb
class ModelsController < ApplicationController
  def index
    models = Model.includes(:vendor)
    render json: { code: 200, message: 'success', data: models }
  end

  def update
    model = Model.find(params[:id])
    model.update!(model_params)
    render json: { code: 200, message: 'success', data: model }
  end

  private

  def model_params
    params.permit(:name, :vendor_id, :enable, :input_price, :output_price)
  end
end

# app/controllers/users_controller.rb
class UsersController < ApplicationController
  def index
    users = User.all
    render json: { code: 200, message: 'success', data: users }
  end

  def adjust_balance
    user = User.find(params[:id])
    amount = params[:amount].to_d

    if params[:type] == 'recharge'
      user.recharge!(amount, params[:remark])
    else
      user.deduct!(amount)
    end

    render json: { code: 200, message: 'success', data: user }
  end
end

# app/controllers/balance_controller.rb
class BalanceController < ApplicationController
  def recharge_records
    records = RechargeRecord.includes(:user)
      .order(created_at: :desc)
      .page(params[:page] || 1)
      .per(params[:page_size] || 20)

    if params[:username].present?
      records = records.joins(:user).where(users: { name: params[:username] })
    end

    if params[:start_time].present?
      records = records.where('created_at >= ?', params[:start_time])
    end

    if params[:end_time].present?
      records = records.where('created_at <= ?', params[:end_time])
    end

    render json: {
      code: 200,
      message: 'success',
      data: {
        total: records.total_count,
        page: records.current_page,
        page_size: records.limit_value,
        items: records
      }
    }
  end
end
```

---

## 计费逻辑

### 请求计费

每次 API 请求后，根据模型价格和 Token 数量计算消费金额：

```ruby
def calculate_cost(model, input_tokens, output_tokens)
  input_cost = (input_tokens.to_f / 1000) * model.input_price
  output_cost = (output_tokens.to_f / 1000) * model.output_price
  input_cost + output_cost
end
```

---

### 余额扣减

计算消费金额后，从用户余额中扣除：

```ruby
def deduct_balance(user, cost)
  return false unless user.sufficient_balance?(cost)

  user.deduct!(cost)
  true
end
```

---

### 余额检查

每次 API 请求前检查用户余额：

```ruby
def check_balance(user)
  unless user.sufficient_balance?(0)
    render json: {
      code: 402,
      message: '余额不足，请充值后再试',
      data: { current_balance: user.balance }
    }, status: :payment_required
    return false
  end
  true
end
```

---

## 路由配置

```ruby
# config/routes.rb
Rails.application.routes.draw do
  # 模型相关
  resources :models, only: [:index, :show, :create, :update, :destroy]

  # 用户相关
  resources :users, only: [:index, :show, :create, :update, :destroy] do
    post :balance/adjust, to: 'users#adjust_balance'
  end

  # 余额相关
  namespace :balance do
    get 'recharge/list', to: 'balance#recharge_records'
  end
end
```

---

## 相关文档

- [后端产品文档](./v4_billing_product.md)
- [前端产品文档](../frontend/v4_billing_product.md)