---
name: business-discovery
description: Organize contracts, proposals, meeting notes, screenshots, interface notes, and verbal requirements into confirmed facts, goals, roles, core objects, flows, assumptions, open questions, dependencies, and risks. Use before planning a demo, preparing a business interview, or when source materials conflict and must not be silently turned into requirements.
---

# 业务探索

## 必读

1. 根目录 `AGENTS.md`。
2. `project.config.json`。
3. `docs/discovery/` 现有材料。
4. 用户指定资料和 `inbox/` 中相关文件。

读取 `references/discovery-checklist.md` 执行新人防遗漏检查。

## 工作流

1. 列出实际读取材料及来源。
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

## 禁止

- 不把“会议中提到”当作正式确认。
- 不使用常见行业做法补充业务规则。
- 不提前设计后端、数据库、权限或正式接口。
- 不生成完整 PRD。
- 不修改决策、状态机、页面契约或原型。

## 输出

更新或生成：

- `docs/discovery/business-facts.md`
- `docs/discovery/roles.md`
- `docs/discovery/core-flows.md`
- `docs/discovery/assumptions.md`
- `docs/discovery/open-questions.md`

每个待确认问题包含确认方、阻断程度和最晚确认节点。
如果问题阻断当前 CR，同时形成 `waiting-human` 介入单，只保留一个当前必须回答的问题。

## 退出条件

- 事实和假设分离。
- 核心角色与对象明确。
- 主流程可以完整讲述。
- Demo 验证目标明确。
- 阻断问题已确认或显式记录为假设。
