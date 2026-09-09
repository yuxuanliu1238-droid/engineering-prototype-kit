# {{TASK_LIST_TITLE}}

<!-- 本文件由结构化研发任务台账确定性生成，请勿直接编辑。 -->

> 本清单只定义经评审确认的开发范围，不承担负责人、工期、进度和完成比例管理。

## 1. 清单信息

| 项目 | 内容 |
|---|---|
| 清单编号 | {{LIST_ID}} |
| 清单版本 | {{VERSION}} |
| 当前状态 | {{STATUS}} |
| 交接范围 | {{HANDOFF_SCOPE}} |
| 当前版本变化 | {{CURRENT_REVISION}} |
| 产品确认 | {{PRODUCT_CONFIRMATION}} |
| 研发确认 | {{ENGINEERING_CONFIRMATION}} |

### 本轮需求范围

| 需求编号 | 需求 | 处理结论 | 说明 |
|---|---|---|---|
| {{REQUIREMENT_ID}} | {{REQUIREMENT_TITLE}} | {{REQUIREMENT_DISPOSITION}} | {{REQUIREMENT_REASON}} |

### 明确非范围

{{EXPLICIT_EXCLUSIONS}}

### 会改变业务结果的待确认问题

{{BUSINESS_OPEN_QUESTIONS}}

### 实施前置条件

| 前置条件 | 责任方 | 影响 | 满足条件 |
|---|---|---|---|
| {{PREREQUISITE}} | {{PREREQUISITE_OWNER}} | {{PREREQUISITE_IMPACT}} | {{PREREQUISITE_READY_WHEN}} |

## 2. 公共材料入口

| 编号 | 用途 | 材料 | 位置 | 相关章节 | 评审基线 |
|---|---|---|---|---|---|
| {{MATERIAL_ID}} | {{MATERIAL_ROLE}} | {{MATERIAL_TITLE}} | {{MATERIAL_LOCATOR}} | {{MATERIAL_SECTION}} | {{BASELINE_STATE}} |

## 3. 应用功能任务

| 任务编号 | 应用端 | 菜单／页面 | 功能操作 | 开发范围 | 涉及研发端 | 关联需求 | 验收要点 | 实施前置条件 | 关联材料／评审依据 |
|---|---|---|---|---|---|---|---|---|---|
| {{TASK_ID}} | {{APPLICATION}} | {{MENU_AND_PAGE}} | {{OPERATION}} | {{DEVELOPMENT_SCOPE}} | {{ENGINEERING_DOMAINS}} | {{REQUIREMENT_IDS}} | {{ACCEPTANCE}} | {{TASK_PREREQUISITES}} | {{TASK_MATERIALS}} |

## 4. 外部系统接口任务

| 任务编号 | 系统方 | 接口名称 | 对接方向 | 调用场景 | 开发范围 | 关联需求 | 异常与验收 | 依赖／待确认 | 关联材料／评审依据 |
|---|---|---|---|---|---|---|---|---|---|
| {{TASK_ID}} | {{SYSTEM_PARTY}} | {{INTERFACE_NAME}} | {{DIRECTION}} | {{TRIGGER_SCENARIO}} | {{DEVELOPMENT_SCOPE}} | {{REQUIREMENT_IDS}} | {{ACCEPTANCE}} | {{TASK_PREREQUISITES}} | {{TASK_MATERIALS}} |

## 5. 非页面研发任务

| 任务编号 | 任务分类 | 触发场景 | 开发范围 | 涉及研发端 | 关联需求 | 验收要点 | 实施前置条件 | 关联材料／评审依据 |
|---|---|---|---|---|---|---|---|---|
| {{TASK_ID}} | {{NON_PAGE_CATEGORY}} | {{TRIGGER_SCENARIO}} | {{DEVELOPMENT_SCOPE}} | {{ENGINEERING_DOMAINS}} | {{REQUIREMENT_IDS}} | {{ACCEPTANCE}} | {{TASK_PREREQUISITES}} | {{TASK_MATERIALS}} |

## 6. 完整性检查

| 检查 | 结果 | 说明 |
|---|---|---|
| {{CHECK_LABEL}} | {{CHECK_RESULT}} | {{CHECK_DETAIL}} |

> 检查只证明已声明范围存在映射；研发任务是否技术完整，仍以研发负责人确认为准。

## 7. 版本记录

| 版本 | 变更类型 | 摘要 | 记录时间 |
|---|---|---|---|
| {{VERSION}} | {{CHANGE_TYPE}} | {{REVISION_SUMMARY}} | {{RECORDED_AT}} |
