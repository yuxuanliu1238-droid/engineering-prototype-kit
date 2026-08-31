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

## 自然语言请求路由

| 用户表达 | 默认模式 | 直接路由 | 边界 |
|---|---|---|---|
| 记录需求、先分析影响、开始同步、生成交付物 | PLAN / EXECUTE / DELIVER | `$change-and-delivery-governance` | 先核对授权范围，不因登记或检查通过自动实施、关闭或交付 |
| 整理会议纪要、访谈或原始资料 | PLAN | `$business-discovery` | 读取不等于确认，按来源权威分类 |
| 确认规则、决策或状态关系 | PLAN / EXECUTE | `$decision-and-domain` | 不猜测未确认业务规则 |
| 新增、合并、删除页面或同步页面说明 | EXECUTE | `$page-contract-and-spec` | 同步检查 Page/Action/State 退役引用 |
| 检查一致性、过期证据或已删除内容残留 | REVIEW | `$requirement-quality-review` | 只读给出证据，不顺带修复 |
| 复盘最近修改、指定 CR 或时间范围 | REVIEW | `$prototype-change-retrospective` | 只读指定范围及直接关联差异，不默认扫描整个仓库 |
| 检查页面是否可以评审、需要验证哪些场景、证据是否充分 | REVIEW | `$scenario-evidence-capture` | Skill 选择场景并判断充分性；脚本负责采集、索引和格式校验 |

宽泛的“给我评审”先进入变更治理核对当前检查点和授权，再按需要转场景证据或质量审查；不得同时把多个专项 Skill 当成事实写入者。
