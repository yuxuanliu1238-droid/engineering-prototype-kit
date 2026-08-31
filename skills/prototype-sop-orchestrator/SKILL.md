---
name: prototype-sop-orchestrator
description: Route an AI-assisted engineering prototype through gated stages by reporting execution state, AI policy, readiness, human intervention, evidence, and the next authorized action. Use when a product manager asks where to start, what can run, why work is blocked, what to do next, how to continue, review, or deliver, whether a page is ready for review, or to retrospect on recent scoped changes without crossing specialist or approval boundaries.
---

# 工程化原型导航员

## 必读

按顺序读取：

1. 根目录 `AGENTS.md`。
2. `project.config.json`。
3. `project-status.json`。
4. `README.md` 和 `START-HERE.md`。
5. 当前阶段对应的事实源。

处理 CR 时读取 `docs/requirements/task-control-model.md` 和当前 CR 完整记录。

详细阶段、门禁和路由见 `references/stage-map.md`。

## 判断项目类型

先判断当前目录属于：

- 空白启动包；
- 已有前端原型；
- 处于需求同步中的项目；
- 准备评审或交付的项目；
- 已进入正式研发的项目。

已有内容时先审计，不覆盖、不重新初始化。

## 路由

- 业务资料、会议纪要、访谈准备：使用 `$business-discovery`。
- 评审反馈、正式决策、状态机：使用 `$decision-and-domain`。
- 页面契约和页面说明：使用 `$page-contract-and-spec`。
- 一致性和需求质量检查：使用 `$requirement-quality-review`。
- CR 登记、影响分析、验证和交付：使用 `$change-and-delivery-governance`。
- “复盘最近修改”、复盘指定 CR 或时间范围：使用 `$prototype-change-retrospective`；只读取用户指定范围和直接关联差异。
- “检查这个页面是否可以评审”、选择必要验证场景或判断证据是否充分：使用 `$scenario-evidence-capture`；实际采集和索引仍交给确定性脚本。

“给我评审”先由 `$change-and-delivery-governance` 核对授权范围和当前检查点；需要选择场景时再转 `$scenario-evidence-capture`，需要一致性结论时再转 `$requirement-quality-review`。

## 职责边界

- 本 Skill 只判断阶段、声明 `PLAN、EXECUTE、REVIEW、DELIVER` 模式并路由，不替代专项 Skill 写事实、决策、契约、审查结论或交付授权。
- 场景截图、证据索引、PRD 摘要、契约校验和 ZIP 打包由确定性脚本执行；本 Skill 只把请求路由到相应治理阶段。
- 评审前的风险场景选择和证据充分性判断使用 `$scenario-evidence-capture`；实际截图、索引和构建仍由确定性脚本处理，并由 `$change-and-delivery-governance` 控制授权与登记。
- 修改复盘使用 `$prototype-change-retrospective` 形成只读分类结论，再由 `$change-and-delivery-governance` 控制是否登记或启动修正。
- 结构化边界以 `skills/skill-boundaries.json` 为准，校验脚本负责防止职责漂移和重复入口。

## 执行规则

1. 先声明本轮模式：`PLAN、EXECUTE、REVIEW、DELIVER`。
2. 同时报告阶段、执行状态、AI 策略和确定性推导的就绪结论。
3. `PLAN` 只分析、提问和拆分；`EXECUTE` 必须是 `execution-allowed + execution-ready`。
4. 每次只推进一个可独立验收的阶段。
5. 遇到会改变产品结果的歧义，写入 `waiting-human` 介入单，不自行选择。
6. 阶段完成后记录类型化产物，再建议解锁下一阶段。
7. 不因检查通过而自动启动下一阶段。
8. 不自动创建正式后端、数据库、鉴权或生产配置。
9. 不自动冻结版本或把 CR 更新为已同步。
10. 不因评审确认自动进入交付，也不因旧验证记录存在而宣称当前证据新鲜。

## 新人交互

用户不熟悉终端时：

- Codex 自行执行安全的检查和预览。
- 确需用户操作时一次只给一个步骤。
- 说明目的、预期结果和成功判断。
- 出错时一次只给一个排查步骤。

## 输出

每次导航输出：

- 当前项目类型；
- 当前阶段和状态；
- 本轮模式、AI 策略和就绪结论；
- 本轮目标；
- 实际读取的事实源；
- 允许与禁止事项；
- 当前发现；
- 需要谁确认；
- 如果等待人工，唯一问题、影响和恢复条件；
- 下一项唯一建议；
- 是否已经获得下一阶段授权。

## 完成标准

- 没有把假设当成事实。
- 没有越过人工门禁。
- 没有修改无关文件。
- 当前阶段有可核对证据。
- 完成产物已标明支撑的验收事实。
- 下一步明确但未被自动启动。
