---
name: prototype-sop-orchestrator
description: Route an AI-assisted engineering prototype through gated stages by reporting execution state, AI policy, readiness, human intervention, evidence, and the next authorized action. Use when a product manager asks where to start, what can run, why work is blocked, what to do next, how to continue, review, or deliver, whether a page is ready for review, or to retrospect on recent scoped changes without crossing specialist or approval boundaries.
---

# 工程化原型导航员

## 当前任务入口

核对根 AGENTS、project.config.json 和 project-status.json；同一版本已读规则不重复加载。

有 CR、TASK 或快速评审场景时使用 package.json 中的 `task:context`；核对来源摘要后，只读取当前任务范围和直接引用的原文片段。不默认读取整份台账、README、START-HERE 或生成文档。

没有任务编号时先定位当前 activeChangeRequest 或用户指定场景；存在多个候选时才询问用户。禁止依据上下文包提升授权；生成视图过期时重新提取。

按请求路由到一个适用专项 Skill；只有需要细化阶段或门禁时读取 `references/stage-map.md`。业务实例不依赖 Kit 内部设计文档。

## 判断项目类型与模式

先判断当前目录属于 Kit 工具仓库还是独立业务实例，再根据用户明确提供的场景推荐：

- `rapid-validation`：客户现场、售前、概念 Demo 或新方向探索；
- `continuous-iteration`：评审后继续建设、持续加功能或旧项目改造；
- 信息不足：只做业务探索。

AI 只推荐，产品经理确认。已有内容时先审计，不覆盖、不重新初始化；存在代码不构成自动进入持续迭代的理由。

快速模式还必须先读取 `project-status.json.validationProfile`：确认主要评审目标和输入充分度。“不充分”时只做探索；“部分充分”时先确认 Demo 蓝图；材料充分且场景简单时可随 Demo 一起确认，不额外增加等待门禁。

## 路由

- 业务资料、会议纪要、访谈准备：使用 `$business-discovery`。
- 评审反馈、正式决策、状态机：使用 `$decision-and-domain`。
- 页面契约和页面说明：使用 `$page-contract-and-spec`。
- 一致性和需求质量检查：使用 `$requirement-quality-review`。
- CR 登记、影响分析、验证和交付：使用 `$change-and-delivery-governance`。
- “复盘最近修改”、复盘指定 CR 或时间范围：使用 `$prototype-change-retrospective`；只读取用户指定范围和直接关联差异。
- “检查这个页面是否可以评审”、选择必要验证场景或判断证据是否充分：使用 `$scenario-evidence-capture`；实际采集和索引仍交给确定性脚本。
- “生成研发任务清单”、整理研发评审差异、检查材料入口或“为 TASK-xxx 生成提示词”：使用 `$development-handoff`；生成提示词只读取当前任务材料，不构成实施授权。

“给我评审”先由 `$change-and-delivery-governance` 核对授权范围和当前检查点；需要选择场景时再转 `$scenario-evidence-capture`，需要一致性结论时再转 `$requirement-quality-review`。

## 职责边界

- 本 Skill 只判断阶段、声明 `PLAN、EXECUTE、REVIEW、DELIVER` 模式并路由，不替代专项 Skill 写事实、决策、契约、审查结论或交付授权。
- 场景截图、证据索引、PRD 摘要、契约校验和 ZIP 打包由确定性脚本执行；本 Skill 只把请求路由到相应治理阶段。
- 评审前的风险场景选择和证据充分性判断使用 `$scenario-evidence-capture`；实际截图、索引和构建仍由确定性脚本处理，并由 `$change-and-delivery-governance` 控制授权与登记。
- 修改复盘使用 `$prototype-change-retrospective` 形成只读分类结论，再由 `$change-and-delivery-governance` 控制是否登记或启动修正。
- 研发任务清单和单任务提示词使用 `$development-handoff`；收到明确任务实施授权后仍返回 `$change-and-delivery-governance` 核对七项就绪检查。
- 结构化边界以 `skills/skill-boundaries.json` 为准，校验脚本负责防止职责漂移和重复入口。

## 执行规则

1. 先声明项目工作模式，再说明本轮动作：`PLAN、EXECUTE、REVIEW、DELIVER`。
2. 持续迭代 CR 默认只向产品经理展示阶段、结论、原因、责任人和下一动作；完整控制字段按需展开。
3. `PLAN` 只分析、提问和拆分；`EXECUTE` 必须是 `execution-allowed + execution-ready`。
4. 每次只推进一个已授权、可独立验收的活动或主阶段。
5. 遇到会改变产品结果的歧义，写入 `waiting-human` 介入单，不自行选择。
6. 实施活动完成后记录类型化产物并进入待评审；产品经理确认后才能完成需求。
7. 不因检查通过而自动启动下一阶段。
8. 不自动创建正式后端、数据库、鉴权或生产配置。
9. 不自动切换工作模式、冻结版本或把 CR 更新为已完成、已同步。
10. 不因评审确认自动进入交付，也不因旧验证记录存在而宣称当前证据新鲜。
11. 快速 Demo 以“核心流程 + 必要配置 + 代表性异常 + 可见反馈 + 可恢复数据”为完成结构，仅实现当前评审目标触达的部分。
12. 多场景或复杂评审可启用独立 `/review`，业务系统使用 `/app`；从评审场景进入后，评审上下文和返回入口必须在业务菜单间持续存在。
13. 未指定视觉形态时采用 B 端默认结构：业务菜单、筛选、列表/详情、状态、最后一列操作和抽屉/弹窗反馈；不得因此补写业务规则。
14. 反馈先分类为呈现调整、业务结论、Kit 通用改进或项目专属，说明影响范围后实施；AI 检查通过不替代产品经理复核。

## 新人交互

用户不熟悉终端时：

- Codex 自行执行安全的检查和预览。
- 确需用户操作时一次只给一个步骤。
- 说明目的、预期结果和成功判断。
- 出错时一次只给一个排查步骤。

## 输出

每次导航输出：

- 当前项目类型；
- 当前模式、阶段和状态；
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
