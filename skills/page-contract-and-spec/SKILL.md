---
name: page-contract-and-spec
description: Create source-traceable page contracts and readable specifications from confirmed decisions, state machines, and runnable prototype behavior, including merge, deletion, and Page, Action, or State ID retirement control. Use when behavior must become testable acceptance facts or documentation must synchronize without inventing APIs, restoring removed fields, reusing retired IDs, or treating screenshots as requirements.
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

字段说明、页面合并/删除和 ID 退役清单见 `references/contract-spec-format.md`。

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
- 页面合并、删除或替换时先完成 ID 退役清单；退役 ID 不复用，历史材料保留追溯但不得继续出现在当前入口、契约或生成内容中。

## 验证

修改后运行 `pnpm contracts:validate`。如果原型行为变化，同时运行与风险等级匹配的页面和链接检查。

关联 CR 时，分别登记 `contract、prototype、page-guide` 产物，用 `supports` 关联验收 ID，并用 `sourceRefs` 指向采用的决策、状态机、原型或治理依据。

契约校验、链接检查和证据索引属于确定性脚本职责。本 Skill 负责选择与解释验证范围，不用自然语言代替脚本结果。截图、截图索引和正式格式文档只在用户明确要求时生成；后续需要自动化时新增脚本，不新增同名治理 Skill。

## 完成标准

- 页面、动作和状态 ID 唯一。
- 契约与原型一致。
- 验收事实可观察。
- 页面说明没有覆盖高优先级事实。
- 未实现能力没有伪装为已实现。
- 合并或删除页面的旧 Page、Action、State 引用已清理或明确保留为历史追溯。
