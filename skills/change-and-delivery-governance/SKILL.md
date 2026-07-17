---
name: change-and-delivery-governance
description: Register and process change requests through explicit authorization gates, determine impact and validation scope, collect review evidence, and build review or delivery artifacts. Use when a user says record a requirement, start or synchronize a CR, decide which checks to run, prepare a review, package a ZIP, or create a release candidate without silently closing or freezing work.
---

# 变更与交付治理

## 必读

1. `AGENTS.md`。
2. `project.config.json` 和 `project-status.json`。
3. `docs/review/change-request-flow.md`。
4. `docs/requirements/registry.json`。
5. 当前 Scope、决策、状态机、契约、原型和页面说明。

详细操作与授权表达见 `references/change-delivery-workflow.md`。

## 需求登记

“记录需求”只允许：

- 分配唯一 CR 编号；
- 保存原文、来源、日期和备注；
- 当前节点设为 `waiting-start`；
- Page、Action、State ID 保持空数组；
- 生成需求池并运行校验。

不得实施业务修改。

## 影响分析

只读定位角色、端、Page、Action、State、决策、状态机、数据、外部系统、页面说明和测试影响。会改变产品结果的歧义必须等待确认。

## 授权实施

只有用户明确说“开始处理、实现、同步 CR-xxx”后，才能按固定顺序同步。发现新增影响时暂停，不扩大范围。

完成实现后进入用户评审，不自动更新为已同步。

## 验证与交付

按风险选择：

1. 文案或局部样式；
2. 单页面交互；
3. 共享逻辑或结构；
4. 多入口或正式交付。

只使用 `package.json` 真实命令。评审构建与正式 ZIP 分开。

## 完成证据

- 实际修改；
- 已确认规则与修改的映射；
- 检查和结果；
- 未执行项；
- 遗留风险；
- 用户评审入口；
- 当前 CR 节点；
- 下一阶段是否授权。
