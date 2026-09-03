# Schema v3 CR 任务控制模型

## 五个主阶段

`recorded → analysis-confirmation → implementation → awaiting-review → completed`

对应产品经理可见状态：`已记录 → 分析确认 → 实施中 → 待评审 → 已完成`。总状态不重复存储，由当前阶段和执行状态确定性派生。

## 四个正交维度

| 维度 | 回答的问题 | 事实源 |
|---|---|---|
| `currentStageId` | 需求走到哪个主阶段 | CR 记录 |
| `executionState` | 当前能否执行或为何暂停 | CR 记录 |
| `aiPolicy` | AI 被允许做什么 | 产品经理授权 |
| 就绪结论 | 信息、依赖和风险是否满足 | 七项检查的派生结果 |

执行状态使用：`locked、ready、in-progress、waiting-human、paused、completed、cancelled`。等待人工、暂停和取消不是额外主阶段。

## 七项就绪检查

| ID | 检查内容 | 执行时可否不适用 |
|---|---|---|
| `goal-clear` | 目标和背景明确 | 否 |
| `scope-clear` | 范围和非目标明确 | 否 |
| `acceptance-testable` | 验收标准可观察、可验证 | 否 |
| `dependencies-clear` | 依赖已满足 | 是 |
| `rules-confirmed` | 会改变产品结果的规则已确认 | 是 |
| `authorization-confirmed` | 实施授权已记录 | 否 |
| `risk-reviewed` | 风险等级已由产品经理确认 | 否 |

检查状态只使用 `not-assessed、met、not-met、not-applicable`。`met` 必须带证据。授权不等于就绪；自动检查通过也不替代人工门禁。

## 三级风险与动态活动

- `light`：范围确认、实施、页面检查、产品评审；
- `standard`：影响分析、规则确认、页面契约、原型、一致性检查、产品评审；
- `high`：在标准活动上按触发因素增加正式决策、领域模型、异常分析和专项确认。

AI 记录建议等级、触发因素和理由，产品经理确认最终等级。AI 建议高风险但产品经理降级时，必须保留降级理由和验证补偿措施。

未触发的页面契约、领域模型或专项 B 端模块不是缺失项，校验器不得报错。

## 等待、暂停与取消

- `waiting-human`：必须包含当前唯一问题、请求确认方、影响和恢复条件；
- `paused`：必须包含暂停原因和恢复前提；
- `cancelled`：必须保留取消原因和已有产物。

## 证据与产物

外部证据使用结构化记录，区分原始结论、AI 理解、适用范围和确认状态。V0.2 字符串证据迁移后使用 `legacy-reference` 兼容包装，不改变原文。

`artifacts` 中每项包含 `type、location、supports`。允许类型包括业务基线、决策、计划、契约、原型、页面说明、测试/评审报告、评审确认、用户确认、迁移报告、提交和发布包。

## 完成边界

- 实施完成：范围内活动完成，进入 `awaiting-review`；
- 需求完成：产品经理给出有效评审确认，产品评审活动完成，并存在用户确认与测试或评审产物。

AI 不得自行把需求从待评审更新为已完成。
