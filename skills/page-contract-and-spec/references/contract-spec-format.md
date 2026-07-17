# 页面契约与说明格式

## 契约字段

`pageId`、`surface`、`title`、`goal`、`implementationStatus`、`preview`、`sections`、`actions`、`states`、`rules`、`dataFields`、`integrations`、`exceptions`、`acceptanceCriteria`。

## 页面说明最低覆盖

- 目标、角色和入口；
- 页面区块和可见字段；
- 交互、校验、弹窗和取消恢复；
- 正常、空、异常和失败状态；
- 数据来源、敏感性和后台联动；
- 当前实现状态；
- 未确认接口和外部依赖；
- 验收事实。

接口建议不等于正式契约。不得为隐藏 mock 字段设计接口。
