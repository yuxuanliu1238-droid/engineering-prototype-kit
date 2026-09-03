# 需求与变更台账

<!-- 本文件由结构化 CR 台账确定性生成，请勿直接编辑。 -->

## 1. 当前总览

- 需求总数：{{totalCount}}
- 实施中：{{implementationCount}}
- 等待确认：{{waitingHumanCount}}
- 待评审：{{awaitingReviewCount}}
- 高风险：{{highRiskCount}}
- 已完成：{{completedCount}}

| 编号 | 需求 | 风险 | 当前阶段 | 当前结论 | 责任人 | 下一步 |
|---|---|---|---|---|---|---|
| {{crId}} | {{summary}} | {{riskLevel}} | {{stageLabel}} | {{verdict}} | {{currentOwner}} | {{nextAction}} |

## 2. 单条需求详情

### {{crId}} {{summary}}

#### 当前状态

- 当前阶段：{{stageLabel}}
- 当前结论：{{verdict}}
- 原因：{{verdictReason}}
- 当前责任人：{{currentOwner}}
- 下一步：{{nextAction}}

#### 本次范围

##### 包含

{{includedScope}}

##### 明确不包含

{{excludedScope}}

#### 风险判断

- AI 建议：{{recommendedRisk}}
- 触发因素：{{riskTriggers}}
- 产品确认：{{confirmedRisk}}
- 降级理由：{{downgradeReasonOrNotApplicable}}

#### 活动进度

| 活动 | 状态 | 结果或阻断原因 |
|---|---|---|
| {{activityLabel}} | {{activityStatus}} | {{activityResult}} |

#### 验收与证据

- 验收标准：{{acceptanceCriteria}}
- 当前产物：{{artifacts}}
- 遗留风险：{{remainingRisks}}
- 待确认问题：{{openQuestions}}

<details>
<summary>详细任务控制</summary>

- AI 策略：{{aiPolicy}}
- 执行状态：{{executionState}}
- 就绪结论：{{readinessVerdict}}
- 就绪检查与证据：{{readinessEvidence}}
- 人工介入单：{{waitingReason}}

</details>
