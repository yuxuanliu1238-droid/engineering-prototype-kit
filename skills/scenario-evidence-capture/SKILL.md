---
name: scenario-evidence-capture
description: Select the smallest sufficient set of prototype review scenarios from an authorized change scope and assess whether existing evidence covers its risks. Use when a user asks what pages, states, actions, exceptions, or viewports must be checked, or whether a page is ready for review; do not capture screenshots or expand implementation scope automatically.
---

# 场景证据选择

## 边界

只为已授权的变更范围制定证据计划并判断证据是否充分。读取当前有效的需求范围、决策、页面契约和已有检查结果；不新增业务规则，不修改原型，不自动截图、构建、登记 CR 或生成正式交付物。

## 选择方法

1. 明确本轮要评审的产物和被暂缓的产物；范围或授权不清时，只提出当前最关键的一个问题。
2. 从事实源提取受影响的页面、状态、动作、异常边界和实际支持的视口，不凭标题或历史截图猜测。
3. 结合变化范围、共享程度、状态转换、失败影响和恢复难度评估风险，并说明依据。
4. 为每项风险选择能证明它的最小场景；同一场景能覆盖多项风险时合并，不能证明新风险的截图或构建不加入计划。
5. 对照已有证据逐项判断已覆盖、缺失或可能过期。检查命令通过只说明被检查内容通过，不能替代场景覆盖或用户确认。

需要输出正式证据计划或判断充分性时，读取 `references/evidence-plan-format.md`。完成后可用 `scripts/validate-evidence-plan.mjs` 检查 JSON 结构；脚本不替代风险判断。

## 证据充分性

只有以下条件同时满足时才能标记“充分”：

- 每个必须场景都有可追溯且未过期的证据。
- 正常路径之外，与本次变化直接相关的边界、异常、取消或恢复已覆盖。
- 视口选择与受影响端和布局风险一致。
- 证据能看出操作前提、动作和结果，而不只是静态页面存在。
- 尚需用户确认的检查点仍明确保留，未被自动关闭。

否则标记“不充分”，只列当前缺失的必要证据及其影响，不默认扩大为全量截图或全量构建。

## 输出

给出风险等级与理由、必需场景、可选场景、已有证据、缺失或过期证据、充分性结论和下一项最小动作。页面、状态和动作 ID 必须来自当前事实源；来源不明时标记待确认。

## 完成标准

- 场景能追溯到范围内风险，没有项目外扩张。
- Skill 做风险选择，脚本只做确定性结构检查和索引。
- 未把历史证据、检查通过或用户授权互相替代。
- 正文不包含项目专属状态、固定页面文案或接口规则。
