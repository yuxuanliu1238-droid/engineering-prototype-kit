# V0.3 模式与阶段路由

## 项目模式

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
| 生成研发任务清单、整理研发评审差异、为 TASK 生成提示词 | PLAN / REVIEW | `$development-handoff` | 清单正式化需产品与研发确认；生成提示词不构成实施授权 |

宽泛的“给我评审”先进入变更治理核对当前检查点和授权，再按需要转场景证据或质量审查；不得同时把多个专项 Skill 当成事实写入者。

## 模式与阶段路由

| 当前情况 | AI 允许动作 | 人工门禁 | 下一步 |
|---|---|---|---|
| 信息不足 | 业务探索、识别缺口 | 产品经理确认场景 | 推荐模式 |
| rapid-validation | 维护业务验证简报和 Demo | 产品经理确认范围与假设 | 需求评审 |
| 评审后待切换 | 生成切换影响预览 | 有效评审、继续建设、确认人和证据 | continuous-iteration |
| continuous-iteration | 按 CR 风险活动实施 | 单条 CR 授权与最终评审 | 完成或下一条 CR |

快速验证切换持续迭代不得由 AI 自动执行。切换时初始化空 CR 台账，不自动创建领域模型、页面契约或 B 端专项模块。

## 持续迭代 CR

| 主阶段 | 默认动作 | 主要门禁 | 下一阶段 |
|---|---|---|---|
| recorded | 保存原始请求和来源 | 产品经理确认 AI 策略 | analysis-confirmation |
| analysis-confirmation | 风险、影响、规则、范围与验收；启用产研交接时形成任务清单草稿、研发评审差异和正式清单 | 产品经理确认风险和实施授权；产研交接正式化还需产品与研发确认 | implementation |
| implementation | 执行动态活动并登记证据 | 就绪检查持续满足 | awaiting-review |
| awaiting-review | 展示结果、检查和遗留风险 | 产品经理最终评审 | completed 或退回 |
| completed | 保留确认和类型化产物 | 不自动启动新 CR | 新授权 |

`waiting-human、paused、cancelled` 是执行状态，不新增主阶段。进入 `EXECUTE` 前必须同时满足 `execution-allowed` 和 `execution-ready`。
