# 阶段路由

| 阶段 | 默认模式 | 允许写入 | 人工门禁 | 下一阶段 |
|---|---|---|---|---|
| initialization | PLAN | 空白模板配置 | 确认开始探索 | business-discovery |
| business-discovery | PLAN | `docs/discovery/` | 确认 Demo 基础 | demo-planning |
| demo-planning | PLAN | Demo 计划 | 确认实施范围 | prototype |
| prototype | EXECUTE | `prototype/` | 业务评审 | decision-domain |
| decision-domain | PLAN / EXECUTE | `docs/decisions/`、`docs/domain/` | 确认正式结论 | page-contract |
| page-contract | EXECUTE | 契约与页面说明 | 确认覆盖范围 | quality-review |
| quality-review | REVIEW | 审查报告 | 确认修复项 | user-review |
| user-review | REVIEW | 评审证据 | 产品经理确认 | delivery |
| delivery | DELIVER | `dist/` | 明确交付授权 | 完成或新 CR |

任何阶段都不得自动跳过人工门禁。
进入 `EXECUTE` 前必须同时满足 `execution-allowed` 和 `execution-ready`。
