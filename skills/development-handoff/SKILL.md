---
name: development-handoff
description: Prepare and validate a reviewed development-scope task list, organize engineering-review differences, verify task-linked material availability and version state, and generate one-task context prompts without granting implementation authority. Use when product or engineering asks for a development task list, review reconciliation, formal handoff baseline, material-entry check, or a prompt for one named task.
---

# 产研交接

## 按需事实源

按顺序读取：

1. 根目录 `AGENTS.md`；
2. `project.config.json` 和 `project-status.json`；
3. `docs/design/v0.4-development-handoff.md`；
4. 当前需求或 CR 台账；
5. 当前研发任务清单；
6. 用户指定任务直接关联的材料入口。

详细流程见 `references/handoff-workflow.md`。

## 适用动作

- 根据已确认需求和原型生成研发任务清单草稿；
- 将研发评审整理为新增、拆分、合并、删除和归类差异；
- 记录产品与研发确认并形成正式研发任务清单；
- 检查一个任务关联材料的访问方式和版本状态；
- 为一个明确任务编号生成研发上下文提示词。

纯快速验证且不进入研发实施时不强制启用本 Skill。

## 材料读取边界

- 只读取任务清单和当前任务 `materialRefs` 指向的材料，不默认扫描整个项目或所有业务文档；
- Git、钉钉文档、原型、截图、接口文档和其他研发可访问入口均可使用，Git 不是必选项；
- 钉钉文档可由研发肉眼查看，也可在已有授权和可用工具时只读获取；本 Skill 不配置登录、不索取凭证、不写入令牌；
- 能自动核对版本时记录当前版本；不能自动核对时标为 `unverified`，提示实施前由人工确认；
- 材料为 `changed` 或 `missing` 时停止生成，并只提出一个会改变执行结果的问题；
- 材料片段是提示词上下文，不反向成为需求事实源。

## 任务清单规则

1. 草稿只表达 AI 建议，研发评审后才能正式化；
2. 首次正式化需要产品和研发双确认；
3. 任务按应用功能、外部系统接口和非页面研发任务分类；
4. 任务必须回溯到已确认需求、研发评审结论或研发确认的技术必要项；
5. 四项覆盖检查只证明已声明范围存在映射，不替代研发完整性确认；
6. 清单是开发范围基线，不记录负责人、工期、进度或完成比例；
7. 业务范围或验收变化必须回到 CR，不得在任务表中绕过确认。

## 单任务提示词规则

1. 只接受正式研发任务清单中的一个任务编号；
2. 只组装该任务的范围、材料片段、原型／截图、验收和前置条件；
3. “为 TASK-xxx 生成提示词”只允许生成提示词，不修改代码、配置、数据或 CR 状态；
4. 生成提示词不构成实施授权；
5. 收到明确的“开始实施 TASK-xxx”后，返回 `$change-and-delivery-governance` 核对授权和七项就绪检查；
6. 实施完成只进入待评审，不自动宣布任务或需求完成。

## 确定性工具

- 任务清单生成：`scripts/generate-development-task-list.mjs`；
- 任务清单校验：`scripts/validate-development-handoff.mjs`；
- 单任务提示词生成：`scripts/generate-development-task-prompt.mjs`；
- 结构化模型和 Markdown 保持同源，不手工维护第二份结果。

## 输出

按动作输出以下最小信息：

- 当前清单编号、版本和状态；
- 当前任务编号；
- 实际读取的材料入口与核对状态；
- 允许动作和禁止动作；
- 覆盖缺口、版本警告或阻断原因；
- 需要谁确认；
- 唯一下一动作；
- 是否已经获得实施授权。

## 完成标准

- 没有把清单草稿当作正式开发基线；
- 没有读取无关任务材料；
- 没有把无法核对版本描述为已核对；
- 没有将生成提示词解释为允许实施；
- 没有补造业务规则、接口字段或技术任务；
- 任务、材料、需求和确认均可追溯。
