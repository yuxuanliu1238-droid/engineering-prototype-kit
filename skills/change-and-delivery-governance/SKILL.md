---
name: change-and-delivery-governance
description: Govern change requests through explicit authorization scope, readiness, checkpoints, source-traceable evidence, validation levels, human intervention, review, and delivery gates. Use when a user requests record-only, read-only analysis, prototype-only work, full synchronization, read-only review, or formal delivery, without silently expanding scope, closing work, or turning review approval into release permission.
---

# 变更与交付治理

## 当前任务入口

复用已核对的 AGENTS、配置和项目状态。以 `task:context` 提取的当前 CR 范围、授权引用、验收项和阻断问题定位直接事实源；需要原文时按引用展开。

不要求业务实例包含 Kit 内部 task-control-model 或 change-request-flow 文档，不重复读取整个台账与生成视图。只有解释授权类别或交付门禁时读取 `references/change-delivery-workflow.md`。

旧记录可以追溯；重新推进和交付必须核验当前证据。检查通过不替代产品确认，上下文生成不构成授权。

## 需求登记

“记录需求”只允许：

- 分配唯一 CR 编号；
- 保存原文、来源、日期和备注；
- 当前阶段设为 `recorded`；
- `executionState` 设为 `locked`，`aiPolicy` 设为 `unassessed`；
- 七项就绪检查设为 `not-assessed`；
- `waitingReason` 为 `null`，`artifacts` 为空数组；
- 风险未确认时不生成活动清单，Page、Action、State ID 保持空数组；
- 生成可读需求视图并运行校验。

不得实施业务修改。

## 风险确认与影响分析

AI 提出 `light、standard、high` 及触发因素，产品经理确认。高风险降级必须记录理由和补偿措施。随后只读定位角色、端、Page、Action、State、决策、状态机、数据、外部系统、页面说明和测试影响。会改变产品结果的歧义必须等待确认。

## 授权实施

先按 `references/change-delivery-workflow.md` 识别授权范围，明确本轮允许和暂缓的产物。用户明确授权后，先回写 `aiPolicy` 和授权证据，再完成目标、范围、验收、依赖、规则、授权和风险检查。只有结论为 `execution-ready` 时才允许实施。

结论为 `planning-ready` 时只能做影响分析、提问和拆分。发现新增影响时进入 `waiting-human`，不扩大范围。

完成实现后进入 `awaiting-review`，不自动更新为 `completed`。

## 验证与交付

按风险选择：

1. 文案或局部样式；
2. 单页面交互；
3. 共享逻辑或结构；
4. 多入口或正式交付。

只使用 `package.json` 真实命令。为每个检查点记录验收 ID、验证等级、必需检查和类型化产物；产物用 `sourceRefs` 指向实际事实源，用结构化检查 ID 说明覆盖范围。缺少来源、检查未覆盖或证据早于相关变更时，不得声称检查点就绪。

交付证据卡复用既有决策和产物引用，列出关键自主决策、偏离原因及源证据位置，不另建台账。AI 自述不能替代验证；未记录决策或偏离时标记待核对，不能自动等同没有偏离。

用户确认检查点只关闭该评审批次，不自动授权下一批次、整个 CR 或正式交付。正式 ZIP、截图集、Word、PDF 和其他二进制交付物必须有独立明确请求；评审构建与正式交付命令分开执行。

场景与证据充分性由 `$scenario-evidence-capture` 按风险判断，实际捕获和索引属于确定性脚本职责；本 Skill 只控制授权并登记来源、新鲜度、检查覆盖和验收支撑关系。修改复盘由 `$prototype-change-retrospective` 只读分类，质量问题由 `$requirement-quality-review` 审查；是否登记或启动修正仍由本 Skill 控制。

需要向真实研发交接时，由 `$development-handoff` 生成并校验研发任务清单和单任务提示词。正式任务清单可以支撑范围和材料判断，但不替代七项就绪检查；“生成 TASK 提示词”只生成上下文，收到明确实施授权后才返回本 Skill 进入 `EXECUTE`。

## 完成证据

- 实际修改；
- 已确认规则与修改的映射；
- 检查和结果；
- 未执行项；
- 遗留风险；
- 用户评审入口；
- 当前 CR 主阶段；
- 下一阶段是否授权。
- 类型化产物及其支撑的验收 ID。
- 执行状态、AI 策略和就绪结论。
- 事实源追踪、证据新鲜度和验证检查覆盖结论。
- 评审状态与正式交付状态各自的授权依据。
- 产品经理默认状态卡：阶段、结论、原因、责任人和下一动作。
