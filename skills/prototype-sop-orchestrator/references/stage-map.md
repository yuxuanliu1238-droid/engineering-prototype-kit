# 阶段路由

| 阶段 | 目标 | 允许写入 | 人工门禁 | 下一阶段 |
|---|---|---|---|---|
| initialization | 判断项目类型和基础完整性 | 空白模板配置 | 确认开始探索 | business-discovery |
| business-discovery | 事实、角色、流程和问题 | `docs/discovery/` | 确认 Demo 基础 | demo-planning |
| demo-planning | 最小流程和页面范围 | Demo 计划 | 确认实施范围 | prototype |
| prototype | 本地 fixtures 的可点击前端 | `prototype/` | 业务评审 | decision-domain |
| decision-domain | 正负决策和状态模型 | `docs/decisions/`、`docs/domain/` | 确认正式结论 | page-contract |
| page-contract | 页面动作、状态和验收事实 | 契约与页面说明 | 确认覆盖范围 | quality-review |
| quality-review | 只读发现冲突 | 审查报告 | 确认修复项 | user-review |
| user-review | 逐项评审 | 评审证据 | 产品经理确认 | delivery |
| delivery | 构建评审或 ZIP | `dist/` | 明确交付授权 | 完成或新 CR |

任何阶段都不得自动跳过人工门禁。
