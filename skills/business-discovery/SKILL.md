---
name: business-discovery
description: Classify contracts, proposals, meeting notes, raw transcripts, screenshots, interface notes, and verbal requirements by source type, authority, confirmation, and owner before extracting facts, assumptions, questions, roles, flows, dependencies, or risks. Use before demo planning or whenever unconfirmed or conflicting material must remain traceable and must not be promoted into decisions, contracts, or prototype requirements.
---

# 业务探索

## 按需事实源

1. 复用已核对的根目录 `AGENTS.md`，源文件变化时再读。
2. `project.config.json`。
3. `docs/business-baseline.md`（业务实例）或现有探索材料（Kit 示例）。
4. 用户明确指定的资料；不得自行扫描其他业务项目。

读取 `references/discovery-checklist.md` 执行来源分类和新人防遗漏检查。

## 工作流

1. 列出实际读取材料及来源，按来源类型、权威性、确认状态和责任方登记，为每份材料保留可定位的来源引用。
2. 提取明确陈述，不先总结成需求。
3. 分类为：
   - 已确认事实；
   - 业务目标；
   - 角色与职责；
   - 核心对象；
   - 主流程；
   - 已确认规则；
   - 当前假设；
   - 待确认问题；
   - 历史信息；
   - 外部依赖；
   - 风险。
4. 同一问题存在不同说法时列出冲突。
5. 标明谁发起、谁处理、谁履约、谁处理异常、谁查看和谁统计。
6. 生成下一轮访谈问题和首版 Demo 验证目标。
7. AI 推荐“业务方案、原型呈现、生成工作流”中的一个或多个评审目标，并请产品经理用自然语言确认主要目标。
8. 按内容判断输入为“充分、部分充分、不充分”，分别列出已知、缺失、可继续、需确认和禁止推进的内容；不得按文件数量判断。

## 来源与下游边界

- `inbox/`、会议纪要、截图和口头描述默认属于 `source-material`，不是已确认业务事实。
- 只有存在明确确认记录时，条目才可标为已确认事实；同时保留原始来源和确认来源。
- 业务探索只整理输入，不直接创建 `decision`、页面契约、原型或交付证据。
- 下游需要采用某条结论时，交给 `$decision-and-domain` 确认，或交给 `$change-and-delivery-governance` 纳入 CR 门禁。

## 禁止

- 不把“会议中提到”当作正式确认。
- 不使用常见行业做法补充业务规则。
- 不提前设计后端、数据库、权限或正式接口。
- 不生成完整 PRD。
- 不修改决策、状态机、页面契约或原型。
- 输入不充分时不实施 Demo；只继续业务探索。

## 输出

V0.3 业务实例只更新同一份 `docs/business-baseline.md`，其中明确区分：

- 验证目标；
- 角色；
- 服务于验证目标的核心流程；
- 范围与非范围；
- 已确认事实；
- 临时假设和待确认问题。

每个待确认问题包含确认方、阻断程度和最晚确认节点。
快速模式不创建正式 CR。如果持续迭代中的问题阻断当前 CR，同时形成 `waiting-human` 介入单，只保留一个当前必须回答的问题。

输入部分充分时先生成 `docs/demo-blueprint.md`，让产品经理确认菜单与页面范围、核心流程串联、必要配置和代表性异常。菜单、字段和操作由 AI 基于来源分层提出候选，不要求产品经理预先列全或逐字段确认。

## 退出条件

- 事实和假设分离。
- 核心角色与对象明确。
- 主流程可以完整讲述。
- Demo 验证目标明确。
- 阻断问题已确认或显式记录为假设。
- 关键事实、冲突和问题均可追溯到来源。
