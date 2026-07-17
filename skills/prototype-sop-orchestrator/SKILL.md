---
name: prototype-sop-orchestrator
description: Inspect and guide an AI-assisted engineering prototype project through initialization, business discovery, demo planning, prototype implementation, decisions, contracts, quality review, change control, and delivery. Use when a product manager asks where to start, what to do next, to continue an existing project, or to coordinate a multi-stage prototype workflow without crossing approval gates.
---

# 工程化原型导航员

## 必读

按顺序读取：

1. 根目录 `AGENTS.md`。
2. `project.config.json`。
3. `project-status.json`。
4. `README.md` 和 `START-HERE.md`。
5. 当前阶段对应的事实源。

详细阶段、门禁和路由见 `references/stage-map.md`。

## 判断项目类型

先判断当前目录属于：

- 空白启动包；
- 已有前端原型；
- 处于需求同步中的项目；
- 准备评审或交付的项目；
- 已进入正式研发的项目。

已有内容时先审计，不覆盖、不重新初始化。

## 路由

- 业务资料、会议纪要、访谈准备：使用 `$business-discovery`。
- 评审反馈、正式决策、状态机：使用 `$decision-and-domain`。
- 页面契约和页面说明：使用 `$page-contract-and-spec`。
- 一致性和需求质量检查：使用 `$requirement-quality-review`。
- CR 登记、影响分析、验证和交付：使用 `$change-and-delivery-governance`。

## 执行规则

1. 每次只推进一个可独立验收的阶段。
2. 先说明当前阶段、目标、允许事项和禁止事项。
3. 遇到会改变产品结果的歧义，进入 `waiting-user`，不自行选择。
4. 阶段完成后记录证据，再建议下一阶段。
5. 不因上一阶段完成而自动启动下一阶段。
6. 不自动创建正式后端、数据库、鉴权或生产配置。
7. 不自动冻结版本或把 CR 更新为已同步。

## 新人交互

用户不熟悉终端时：

- Codex 自行执行安全的检查和预览。
- 确需用户操作时一次只给一个步骤。
- 说明目的、预期结果和成功判断。
- 出错时一次只给一个排查步骤。

## 输出

每次导航输出：

- 当前项目类型；
- 当前阶段和状态；
- 本轮目标；
- 实际读取的事实源；
- 允许与禁止事项；
- 当前发现；
- 需要谁确认；
- 下一项唯一建议；
- 是否已经获得下一阶段授权。

## 完成标准

- 没有把假设当成事实。
- 没有越过人工门禁。
- 没有修改无关文件。
- 当前阶段有可核对证据。
- 下一步明确但未被自动启动。
