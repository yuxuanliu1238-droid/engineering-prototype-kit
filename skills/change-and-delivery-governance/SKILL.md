---
name: change-and-delivery-governance
description: Register and process change requests through explicit authorization, readiness, human-intervention, evidence, and delivery gates. Use when a user says record, plan, start, implement, review, synchronize, unblock, or deliver a CR; asks whether AI may execute; or needs typed artifacts and validation without silently closing or freezing work.
---

# 变更与交付治理

## 必读

1. `AGENTS.md`。
2. `project.config.json` 和 `project-status.json`。
3. `docs/review/change-request-flow.md`。
4. `docs/requirements/registry.json`。
5. 当前 Scope、决策、状态机、契约、原型和页面说明。
6. `docs/requirements/task-control-model.md`。

详细操作与授权表达见 `references/change-delivery-workflow.md`。

## 需求登记

“记录需求”只允许：

- 分配唯一 CR 编号；
- 保存原文、来源、日期和备注；
- 当前节点设为 `waiting-start`；
- `executionState` 设为 `locked`，`aiPolicy` 设为 `unassessed`；
- 七项就绪检查设为 `not-assessed`；
- `waitingReason` 为 `null`，`artifacts` 为空数组；
- Page、Action、State ID 保持空数组；
- 生成需求池并运行校验。

不得实施业务修改。

## 影响分析

只读定位角色、端、Page、Action、State、决策、状态机、数据、外部系统、页面说明和测试影响。会改变产品结果的歧义必须等待确认。

## 授权实施

用户明确授权后，先回写 `aiPolicy` 和授权证据，再完成目标、范围、验收、依赖、规则、授权和风险检查。只有结论为 `execution-ready` 时才允许实施。

结论为 `planning-ready` 时只能做影响分析、提问和拆分。发现新增影响时进入 `waiting-human`，不扩大范围。

完成实现后进入用户评审，不自动更新为已同步。

## 验证与交付

按风险选择：

1. 文案或局部样式；
2. 单页面交互；
3. 共享逻辑或结构；
4. 多入口或正式交付。

只使用 `package.json` 真实命令。评审构建与正式 ZIP 分开。

## 完成证据

- 实际修改；
- 已确认规则与修改的映射；
- 检查和结果；
- 未执行项；
- 遗留风险；
- 用户评审入口；
- 当前 CR 节点；
- 下一阶段是否授权。
- 类型化产物及其支撑的验收 ID。
- 执行状态、AI 策略和就绪结论。
