# 从这里开始

这是由 engineering-prototype-kit V0.4 创建的干净业务项目。

产品经理日常只需关注：

1. `docs/business-baseline.md`；
2. `prototype/` 中的可运行原型；
3. `docs/review/review-confirmation.md`；
4. 持续迭代模式下的 `docs/requirements/requirements.md`。

产研交接默认不启用。只有产品经理明确选择进入真实研发交接时，才会出现 `docs/development/`；未启用时不需要准备研发任务清单。

如果输入材料只是部分充分，或本轮包含多个独立评审场景，还会出现 `docs/demo-blueprint.md`。它只请你确认菜单页面范围、流程串联、必要配置和代表性异常，不要求逐字段确认。

复杂规则、状态动作或外部数据推导需要跨场景复用时，可按需启用 `docs/domain/domain-evidence.json`。启用后运行 `pnpm domain-evidence:validate`，检查演示数据、最终规则、源状态、异常去向和页面断言是否闭环。

当原型包含仅供评审的操作、需要遵循现有 B 端系统体验，或一次业务口径变化会同时影响规则、页面和演示数据时，可启用 `docs/review/delivery-governance.json`。运行 `pnpm delivery-governance:validate` 后，系统会检查能力用途、允许状态、变更影响、验收场景和 B 端体验证据。

这两项按需材料由 Kit 使用 `pnpm project:activate -- --project <项目目录> --capability domain-evidence|delivery-governance` 先预览，产品经理确认后增加 `--apply` 启用；已有材料不会被覆盖。

准备发布到 Sites 时，先配置 `.openai/hosting.json`，再运行 `pnpm site:check`。该命令会重新构建并检查发布目录、构建新鲜度和不应发布的文件；它不会自动发布，也不会改变站点访问范围。发布后仍需核对部署状态、版本、正式地址和浏览器主路径。

请先把明确提供的资料放入 `inbox/`。AI 只读取用户指定的输入，不应扫描其他业务项目。
