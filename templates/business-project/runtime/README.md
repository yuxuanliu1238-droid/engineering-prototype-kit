# {{PROJECT_NAME}}

本项目是独立业务实例，固定使用 engineering-prototype-kit `{{KIT_VERSION}}`。

- 当前模式：`{{MODE}}`
- 主要评审目标：`{{PRIMARY_VALIDATION_FOCUS}}`
- 输入充分度：`{{INPUT_SUFFICIENCY}}`
- 独立评审中心：`{{REVIEW_CENTER_ENABLED}}`
- Kit 管理信息：`.prototype-kit/manifest.json`
- 完整检查：`pnpm check`
- 原型构建：`pnpm --dir prototype build`
- 业务评审包：`pnpm package:review`

本实例不包含 Kit 的 Skills、教学示例、发布历史和设计文档。

快速 Demo 默认使用 B 端业务系统结构。启用评审中心时从 `/review` 选择场景，再进入 `/app`；评审形式通过不自动代表业务规则或完整需求通过。
