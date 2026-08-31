---
name: prototype-change-retrospective
description: Retrospect a specified CR or time-bounded prototype change set without scanning unrelated repository content. Use when a user asks to review recent changes, extract reusable methods, identify workflow gaps, or decide which repeated mechanics should become deterministic tooling; keep findings read-only until separately authorized.
---

# 原型修改复盘

## 边界

只复盘用户指定的 CR、时间范围或当前已授权变更集。输出发现，不修改源文件、不登记或启动 CR，也不把会议纪要、聊天记录或历史材料自动升级为业务事实。

## 取数范围

1. 先读取项目协作规则和指定 CR 的结构化台账记录。
2. 使用 `scripts/collect-scope.mjs` 生成范围清单；脚本只收集文件路径和关联关系，不替代人工分类。
3. 只读取清单中的相关差异和必要事实源。需要扩大范围时，先说明新增范围和原因。
4. 用户只说“最近修改”时，优先使用当前 CR 最近确认点至今的变更；无法确定当前 CR 时只询问一个范围问题。

## 分类

每项发现只选一个主类：

- 业务专属内容：只适用于当前产品事实，不进入通用 Skill。
- 可复用方法：能改善多个原型任务中的判断或协作。
- 工作流缺口：现有门禁、路由、证据或授权表达不足。
- 确定性工具：重复、机械且可由脚本稳定完成的操作。

详细字段、去重规则和完成检查见 `references/retrospective-format.md`，仅在需要形成正式复盘结果时读取。

## 输出与交接

说明复盘范围、未覆盖范围、四类发现、证据位置和建议归属。确定性操作只建议脚本接口，不在 Skill 正文复制实现；是否登记或修正交给 `$change-and-delivery-governance`，不得自动实施。

## 完成标准

- 未读取指定范围之外的文件正文。
- 业务结论与可复用方法分开，来源不明项标记待确认。
- 每项发现可追溯、已去重，并说明是否需要后续授权。
- Skill 输出不包含项目专属状态、固定页面文案或接口规则。
