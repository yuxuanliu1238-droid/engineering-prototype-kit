---
name: decision-and-domain
description: Turn explicitly confirmed conclusions into source-traceable decisions, domain objects, and testable state machines with an explicit matrix for source state, display state, external evidence, responsibility owners, and immutable rules. Use when feedback changes outcomes, pages disagree on state meaning, or a confirmed rule must be protected from accidental restoration.
---

# 决策与业务建模

## 必读

1. `AGENTS.md`。
2. `docs/business-baseline.md`。
3. `docs/decisions/decisions.md`（存在时）。
4. `docs/domain/business-model.md`（需求触达时才创建）。
5. 当前页面契约和原型，仅在判断影响时读取。

决策字段、状态—证据—责任矩阵和状态压力测试见 `references/decision-state-checklist.md`。

## 模式一：评审反馈分类

先只读提取：

- 正向决策候选；
- 负向决策候选；
- 视觉偏好；
- 局部文案；
- 待产品确认；
- 待业务确认；
- 待研发确认；
- 超出当前范围；
- 历史背景。

每条候选决策说明原始来源、确认来源、结论、适用范围、影响和验收方式。只有用户明确确认后才能写入正式决策。

## 模式二：领域对象与状态机

1. 识别核心对象及其职责。
2. 先建立状态—证据—责任矩阵，区分源状态、展示态、外部证据、责任方和不可变规则。
3. 分离必须独立的状态维度。
4. 只采用系统能够确认的事件。
5. 定义合法流转、禁止流转、失败、取消、异常旁路和终态。
6. 将展示态定义为源状态组合，不创建展示态源字段。
7. 生成正常、异常、边界、重复和乱序事件场景。

## 禁止

- 不把讨论过程写成最终结论。
- 不将技术建议写成研发已确认结论。
- 不因页面文案新增业务源状态。
- 不直接修改原型或契约，除非用户另行授权同步。

## 输出

- 候选阶段：输出确认清单，不落盘正式决策。
- 确认阶段：更新单一逻辑入口 `docs/decisions/decisions.md`，用采用、禁止、已替代区分。
- 建模阶段：只有生命周期、角色责任或关键异常被触达时，更新 `docs/domain/business-model.md` 并列出仍待确认项。
- 关联 CR 时，将正式决策登记为 `decision` 产物，保留 `sourceRefs`，并标明其支撑的验收事实。

## 退出条件

- 关键规则可追溯。
- 重要禁止项有负向决策。
- 状态由可确认事件驱动。
- 合法和禁止流转可测试。
- 下游影响被列出但未越权同步。
