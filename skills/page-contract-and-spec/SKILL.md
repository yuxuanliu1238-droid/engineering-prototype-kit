---
name: page-contract-and-spec
description: Create or update structured page contracts and readable page specifications from confirmed decisions, state machines, and a runnable prototype. Use when formal pages need stable Page, Action, and State IDs; when prototype behavior must become testable acceptance facts; or when page documentation must be synchronized without inventing APIs or restoring removed fields.
---

# 页面契约与说明

## 必读顺序

1. `AGENTS.md` 和 `project.config.json`。
2. 当前有效正向、负向决策。
3. 状态机。
4. 目标页面现有契约。
5. 当前原型。
6. 当前页面说明。
7. 关联 CR。

字段说明和模板见 `references/contract-spec-format.md`。

## 页面契约

每个正式页面包含：

- 稳定 Page ID、端、角色、目标和实现状态；
- 预览入口；
- 页面区块和数据字段；
- 动作、状态、规则、外部集成、异常；
- Given/When/Then 验收事实。

动作必须包含前置条件、校验、成功、失败、下一页面、数据影响和实现状态。状态必须包含进入条件、可见变化、允许动作和恢复方式。

## 页面说明

区分：

- 当前原型已实现；
- 部分实现；
- 计划中；
- 待确认。

移动端按用户旅程组织；后台按页面结构、字段、状态、功能、权限、异常和接口建议组织。

## 防错

- mock、隐藏字段、旧截图不构成需求。
- 负向决策命中的字段不得写回正文或待确认问题。
- 未确认接口只写占位，不得写真实 URL 或错误码。
- 原型和契约不一致时报告同步未完成。
- ID 进入正式契约后不随意修改。

## 验证

修改后运行 `pnpm contracts:validate`。如果原型行为变化，同时运行与风险等级匹配的页面和链接检查。

关联 CR 时，分别登记 `contract、prototype、page-guide` 产物，并用 `supports` 关联验收 ID。

## 完成标准

- 页面、动作和状态 ID 唯一。
- 契约与原型一致。
- 验收事实可观察。
- 页面说明没有覆盖高优先级事实。
- 未实现能力没有伪装为已实现。
