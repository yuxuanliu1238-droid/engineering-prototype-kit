# 工程化原型启动包

面向产品经理的 AI 辅助工程化原型模板。目标不是一次生成尽可能多的页面，而是把业务资料逐步转化为可运行、可验证、可审查、可追溯、可交接的前端原型。

## V0.2 能力

- 开箱即用的目录、项目规则和新人引导。
- 业务探索、Demo 规划、决策、状态机、页面契约和 CR 模板。
- 一个主导航 Skill 和五个专项 Skills。
- 配置驱动的需求台账与页面契约校验。
- 阶段与执行状态分离，能说明“走到哪”和“现在能否做”。
- AI 策略、就绪检查、人工介入单和类型化产物。
- React + Vite 最小前端原型。
- 日常检查、评审构建和 ZIP 交付。
- 未授权实施、虚构接口、历史材料污染等防错用例。

## 快速开始

先阅读 [`START-HERE.md`](START-HERE.md)。普通使用者不需要手动执行终端命令；Codex 应负责检查环境、安装依赖、运行验证，并且一次只在确有必要时要求用户完成一个操作。

开发者验证入口：

```bash
pnpm install
pnpm check
pnpm build:delivery
```

## 事实源分工

| 内容 | 唯一事实来源 |
|---|---|
| AI 执行边界 | `AGENTS.md` |
| 当前阶段 | `project-status.json` |
| 已确认业务规则 | `docs/decisions/` |
| 状态流转 | `docs/domain/` |
| 页面功能、动作和验收事实 | `prototype/src/contracts/` |
| 实际可见界面和操作 | `prototype/src/` |
| 增量需求状态 | `docs/requirements/registry.json` |
| 当前范围 | `docs/governance/scope-current.md` |

历史材料、示例、截图和 `inbox/` 内容只用于输入与追溯，不能直接覆盖正式事实源。

## V0.2 相对 V0.1

V0.1 重点防止越权和事实污染；V0.2 在保留原有门禁的基础上，增加任务可执行性判断和完成证据闭环。详见 `docs/requirements/task-control-model.md`。

## 当前边界

V0.2 固定使用 React、Vite、JavaScript + JSDoc 和 pnpm，只建设前端原型。正式后端、生产数据库、真实鉴权、远程 MCP、多人原子认领和生产部署不在本版本范围。
