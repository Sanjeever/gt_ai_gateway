# 客户端管理页面重构进度

## 已完成的工作

### 1. 供应商匹配移到后端

**问题**：前端 `findVendorByUrl` 只按协议对应的单一 URL 匹配（ANTHROPIC 只查 `urls.anthropic`），导致部分供应商显示为空。

**已实现**：
- `src/service/vendorService.ts` 新增 `findVendorByUrl(gatewayUrl, protocol)` 函数
- `src/service/clientConfigService/types.ts` 的 `ClientConfigBackupInfo` 增加 `matchedVendorId: number | null`
- `src/service/clientConfigService/core.ts` 的 `toBackupInfo` 中对 VENDOR 模式配置调用 `findVendorByUrl`，结果写入 `config.matchedVendorId`
- `frontend/src/types/clientConfig.ts` 的 `CurrentClientConfig` 增加 `matchedVendorId?: number | null`
- `tests/unit/vendorService.test.ts` 新增 10 个测试用例，全部通过

### 2. 合并详情弹窗和编辑弹窗

**问题**：原来有两个独立弹窗（configDialogVisible 和 detailDialogVisible），结构几乎一样。

**已实现**：
- 新增 `dialogMode` ref：`'create' | 'edit' | 'detail'`
- 删除了独立的详情弹窗模板（~120 行）
- 编辑弹窗根据 `dialogMode` 切换只读/可编辑
- Footer：详情模式隐藏，编辑模式显示保存按钮
- `submitConfig` 加了 detail 模式 guard

### 3. 组件拆分

**已实现**：
- `frontend/src/utils/clientManagerUtils.ts`（108 行）：工具函数（标签、颜色、URL 匹配）
- `frontend/src/components/clientConfig/ConfigDialog.vue`（432 行）：配置弹窗，自带表单逻辑
- `frontend/src/components/clientConfig/RenameDialog.vue`（67 行）：重命名弹窗
- `frontend/src/views/ClientManager.vue`（727 行，原 1425 行）：只保留客户端列表+卡片+API 调用

## 未完成的工作

### 1. 前端构建验证 ✅

**已完成**：`npm run build` 通过，无 TS 错误。修复了 4 个 TypeScript 错误：
- `ConfigDialog.vue:324` — 数组索引非空断言
- `clientManagerUtils.ts:4` — 移除未使用的 `User` 导入
- `ClientManager.vue:239` — `renameForm.client` 初始值改为 `ClientName.CLAUDE_CODE as ClientName`
- `ClientManager.vue:391` — `createClientConfigBackup` 返回 `ClientConfigBackupInfo`，新增 `addBackup` 辅助函数替代 `updateClientStatus`

### 2. 功能回归测试

需要手动验证以下场景：
- [ ] 新建配置（三个 tab 都能正常创建）
- [ ] 修改配置（能正常编辑并保存）
- [ ] 查看配置（详情弹窗只读，供应商正确显示）
- [ ] 删除配置
- [ ] 启用配置（切换配置）
- [ ] 从本地配置新建
- [ ] 重命名配置
- [ ] Claude Code 供应商显示 "Mimo个人账户"（不是 `-`）

### 3. VENDOR tab 供应商 combobox（用户后续需求）

用户希望 VENDOR tab 的供应商字段改成可下拉选择又可输入的 combobox，类似 `DialogTest.vue` 中测试模型的实现方式。目前是普通 `a-select`。

参考实现见 `frontend/src/views/Vendor/DialogTest.vue` 的 `selectOptions` 和 `handleSearch` 逻辑。

### 4. 后端测试基础设施问题

`tests/globalSetup.ts` 中测试 server 启动有端口冲突问题（端口 8720 被占用时会失败），这是预存问题，不是本次改动引起的。

## 文件变更清单

```
新增:
  tests/unit/vendorService.test.ts          # 供应商匹配单元测试
  frontend/src/utils/clientManagerUtils.ts   # 工具函数
  frontend/src/components/clientConfig/ConfigDialog.vue   # 配置弹窗组件
  frontend/src/components/clientConfig/RenameDialog.vue   # 重命名弹窗组件

修改:
  src/service/vendorService.ts              # 新增 findVendorByUrl
  src/service/clientConfigService/types.ts  # 新增 matchedVendorId 字段
  src/service/clientConfigService/core.ts   # toBackupInfo 集成供应商匹配
  frontend/src/types/clientConfig.ts        # 新增 matchedVendorId 字段
  frontend/src/views/ClientManager.vue      # 精简为容器组件，使用子组件
```

## 关键代码位置

| 功能 | 文件 | 行号 |
|------|------|------|
| 供应商匹配逻辑 | `src/service/vendorService.ts` | `findVendorByUrl` |
| matchedVendorId 写入 | `src/service/clientConfigService/core.ts` | `toBackupInfo` |
| 配置弹窗表单逻辑 | `frontend/src/components/clientConfig/ConfigDialog.vue` | 全文 |
| 弹窗打开逻辑 | `frontend/src/views/ClientManager.vue` | `openConfigDialog` |
| 保存逻辑 | `frontend/src/views/ClientManager.vue` | `handleConfigSave` |
