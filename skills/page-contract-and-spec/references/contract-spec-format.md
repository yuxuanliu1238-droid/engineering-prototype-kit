# 页面契约与说明格式

## 契约字段

基础字段：`schemaVersion`、`sourceCrId`、`pageId`、`surface`、`title`、`goal`、`implementationStatus`、`preview`、`sections`、`actions`、`states`、`rules`、`dataFields`、`integrations`、`exceptions`、`acceptanceCriteria`。

高风险按触发因素增加：

- 权限：`riskControls.permissions`；
- 数据范围：`riskControls.dataScope`；
- 资金、删除、敏感数据或安全：`riskControls.specialistConfirmations`；
- 外部系统：至少一项 `integrations`；
- 失败恢复或批量异步：至少一项 `exceptions`。

## 页面说明生成

页面说明由 `contracts.json` 确定性生成，产品经理不直接维护 `docs/page-guides/pages.md`。生成视图最低覆盖：

- 目标、角色和入口；
- 页面区块和可见字段；
- 交互、校验、弹窗和取消恢复；
- 正常、空、异常和失败状态；
- 数据来源、敏感性和后台联动；
- 当前实现状态；
- 未确认接口和外部依赖；
- 验收事实。

接口建议不等于正式契约。不得为隐藏 mock 字段设计接口。

## 页面合并、删除与 ID 退役清单

先记录变更依据、变更类型、旧入口、承接页面、生效检查点和回退边界，再逐项核对以下对象：

| 对象类型 | 必查内容 | 退出条件 |
|---|---|---|
| `page` | 旧 Page ID、路由、导航、预览入口、页面映射和承接 Page ID | 当前入口不再指向旧页面，旧 ID 不复用 |
| `action` | 旧 Action ID、触发控件、前置条件、结果和承接动作 | 当前契约与原型无悬空动作引用 |
| `state` | 旧 State ID、进入条件、展示映射、fixture 和恢复路径 | 当前状态组合不再产生已退役展示或行为 |

同时搜索当前决策、状态机、契约、原型、页面说明、路由、测试、fixture、评审包和生成器。当前事实源中的残留必须清理或给出明确承接关系；`archive/`、历史快照和旧检查报告只保留追溯，不应被改写成当前实现。

退役记录至少说明：原 ID、退役原因、替代 ID 或“无替代”、影响引用、清理结果、历史保留位置和验证证据。删除页面不等于删除其历史证据，也不允许把旧 ID 分配给新含义。
