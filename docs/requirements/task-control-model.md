# CR 任务控制模型

## 四个正交维度

| 维度 | 回答的问题 | 事实源 |
|---|---|---|
| `currentStageId` | 交付走到哪个阶段 | CR 节点 |
| `executionState` | 当前能否执行 | 任务控制字段 |
| `aiPolicy` | AI 被允许做什么 | 用户授权 |
| 就绪结论 | 信息、依赖和风险是否满足 | 由检查项确定性推导 |

## 就绪检查

| ID | 检查内容 | 执行时可否跳过 |
|---|---|---|
| `goal-clear` | 目标和背景明确 | 否 |
| `scope-clear` | 范围和非目标明确 | 否 |
| `acceptance-testable` | 验收标准可观察、可验证 | 否 |
| `dependencies-clear` | 依赖已满足或明确不适用 | 是 |
| `rules-confirmed` | 会改变产品结果的规则已确认 | 简单局部变更可不适用 |
| `authorization-confirmed` | 实施授权已记录 | 否 |
| `risk-reviewed` | 风险和验证等级已评估 | 否 |

检查状态只使用 `not-assessed、met、not-met、not-applicable`。`met` 必须带证据。

## 就绪结论

- `needs-authorization`：AI 策略尚未评估。
- `planning-ready`：只能分析、提问、拆分和准备计划。
- `execution-ready`：已授权且所有必需检查通过。
- `needs-input`：缺少信息、依赖、授权或风险结论。
- `human-only`：任务只允许人工执行。

## 等待人工介入单

`executionState` 为 `waiting-human` 时，`waitingReason` 必须包含：

- `code`：结构化原因。
- `question`：当前只需回答的唯一问题。
- `requestedFrom`：产品、业务、研发或其他确认方。
- `impact`：不回答或选择不同结论的影响。
- `resumeWhen`：任务恢复的明确条件。

## 类型化产物

`artifacts` 中每项包含 `type、location、supports`。`supports` 记录该产物支撑的验收 ID 或门禁。

允许类型：`decision、plan、contract、prototype、page-guide、test-report、review-report、user-confirmation、commit、release`。

## 解锁原则

校验器可以判断任务是否可规划或可实施，但不替代产品决策。阶段完成只解锁下一阶段，不自动启动。
