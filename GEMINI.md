# 说明

## API 说明
1. URL 定义使用 rest 风格

## 项目结构
1. src/index.ts: api 的入口定义（简单的逻辑，如查询等，直接在里面实现。复杂的引用其他模块中的代码）
2. web/aiApiEntry.ts: AI 请求的入口和基础逻辑
3. src/service/: 各个服务的代码
    1. modelService.ts: 对 model 对象的操作
    2. recordService.ts: 对 record 对象的操作
    3. senderService.ts: 实现 AI 请求转发的逻辑
    4. userService.ts: 对 user 对象的操作
4. src/model/:各个数据对象的定义
5. util/: 一些拓展，工具类