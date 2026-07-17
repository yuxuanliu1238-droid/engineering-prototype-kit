---
name: requirement-quality-review
description: Run a read-only audit across decisions, state machines, page contracts, runnable prototypes, and page specifications. Use when checking structural completeness, terminology and state consistency, removed-item residue, decision implementation, review readiness, or when a product manager needs P0/P1/P2 evidence before authorizing fixes.
---

# 需求质量审查

## 边界

只报告问题，不修改源文件。用户确认问题后，另行进入修复任务。

## 必读

1. `AGENTS.md`。
2. `docs/review/review-baseline.md`。
3. `docs/review/review-checklist.md`。
4. 当前有效决策和状态机。
5. 受审页面契约、原型和说明。

统一字段、分级和对抗用例见 `references/audit-format.md`。

## 固定顺序

1. 页面文档结构合规审查。
2. 需求口径一致性审查。
3. 决策落地一致性审查。
4. 按“同一基线规则 + 同一业务根因 + 同一修正动作”去重。
5. 汇总 P0/P1/P2 和确认优先级。

## 判断规则

- “没写”不等于“写错”。
- 有有效基线时，违反基线不是待确认项。
- 展示态不能作为领域源状态。
- 原型与契约冲突代表同步未完成。
- 已移除项不能回到正文、接口建议或待确认问题。
- 历史材料不能压制当前决策。

## 输出

每条问题包含编号、等级、确认状态、问题性质、主类型、标签、文件、章节、最小证据、有效基线、有效性说明、影响、建议和回写目标。

最后输出：

- P0/P1/P2 数量；
- 是否阻断评审；
- 优先确认顺序；
- 建议修复批次；
- 未覆盖范围。

## 完成标准

- 没有直接修改源文件。
- 没有重复问题。
- 没有把缺失误判成冲突。
- 每条问题可追溯且有明确回写目标。
