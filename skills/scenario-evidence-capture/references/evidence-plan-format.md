# 场景证据计划格式

仅在需要形成可复用的正式证据计划或判断现有证据是否充分时读取本文件。

## 建议结构

### 范围

- `changeId`：当前 CR、检查点或隔离样本编号。
- `summary`：本轮实际要评审的变化，不包含暂缓范围。
- `sourceRefs`：当前有效的需求、决策、契约或检查证据。
- `authorizationBasis`：允许本轮评审或验证的依据。

### 风险判断

- `level`：`low`、`medium` 或 `high`。
- `reasons`：必须与本次变化直接相关。
- `dimensions`：可使用页面数量、共享逻辑、状态转换、失败影响、恢复难度、权限或布局等维度；不要为了凑项而填写。

### 场景

每个场景包含唯一 `id`、`priority`、`pageIds`、`stateIds`、`actionIds`、`exceptions`、`viewports`、`expectedOutcome` 和 `evidenceRequirements`。

- `priority=required`：缺失时不能得出充分结论。
- `priority=optional`：能增加信心，但不阻断当前评审。
- 没有对应内容的 `stateIds`、`actionIds` 或 `exceptions` 使用空数组，不虚构 ID。
- `viewports` 只列实际支持且与变化风险相关的视口。
- `evidenceRequirements` 描述证据必须看出什么，不指定截图文件名。

### 充分性

- `status`：`sufficient` 或 `insufficient`。
- `coveredScenarioIds`：已有新鲜证据覆盖的场景。
- `missing`：缺失项，每项包含 `scenarioId` 和 `reason`。

标记 `sufficient` 前，所有必需场景都应在 `coveredScenarioIds` 中且 `missing` 为空。结构校验通过只证明计划字段完整、自洽，不证明风险选择正确或证据真实有效。

## 去重与停止条件

- 同一个操作路径只保留一个主场景，用 `evidenceRequirements` 合并可同时观察的结果。
- 只因视口尺寸不同但风险相同的场景可合并；布局或操作方式确实变化时再拆分。
- 已能证明范围内风险后停止增加证据；正式交付、全量回归或截图包需要单独授权。
