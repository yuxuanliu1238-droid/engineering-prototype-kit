# 工作流更新候选与验证记录（2026-10-16）

当前结论：本地实现及自动检查通过；需求模板、接口模板格式已获产品经理确认，工作流其余部分的整体评审仍待确认。Git 提交、推送及正式发布均未执行，未修改历史需求完成状态。

后续已按用户授权补充交付证据卡、错误实现验收与上游排障规则，当前验证见[增强候选记录](2026-10-16-evidence-enhancement.md)。以下保留本批次原验证过程；其原报告不代替后续改动的当前证据。

## 产品确认记录

| 日期 | 确认方 | 确认内容 | 依据 | 生效范围 |
| --- | --- | --- | --- | --- |
| 2026-10-16 | 产品经理（当前用户） | 需求模板、接口模板格式认可 | 本聊天：“l需求模板和接口模板都OK。” | 两份当前模板的格式与结构；不代替具体业务规则批准、工作流整体验收或 Git 提交与发布授权 |

## 授权、范围与事实

依据本聊天明确的“PLEASE IMPLEMENT THIS PLAN”以及后续“继续”，实施已确认的四批 Kit 更新。在线文档继续作为正文事实源，Git 保存模板、采用修订及必要快照。只更新本 Kit；没有迁移包装推荐 Demo，也没有写入在线正文或把包装规则复制到模板。

本轮目标、包含/禁止范围、可观察验收点和执行授权均来自已确认计划；依赖由锁文件安装，规则采用用户选择的在线正文优先方式。风险检查聚焦已有正文保护、授权门禁、证据过期、事务恢复及分发兼容，没有代替产品经理确认业务规则或风险等级，也未创建新的业务 CR。

## 可直接评审的材料

- [需求说明书空模板](../../templates/business-project/optional/documents/business-requirements.md)：按页面目标、结构、动作、字段及必要状态异常展开，复杂规则单列
- [接口说明书空模板](../../templates/business-project/optional/documents/interface-specification.md)：采用当前八章结构，先业务流程后接口数据，未确认技术方案保留待设计
- [脱敏需求示例](../../examples/document-review/requirements.md)、[脱敏接口示例](../../examples/document-review/interface.md)、[三方对照示例](../../examples/document-review/comparison.md)：均明确标记为合成演示，不是正式业务结论
- [文档基线示例](../../examples/document-review/baseline.json)：展示位置、修订、采用章节、读取时间及确认引用

## 实现与验收对应

| 验收项 | 已实现行为 | 验证依据 |
| --- | --- | --- |
| AC-01 文档格式可复用且按需启用 | 两份正文模板归属 business；首次依赖空基线；两种模式默认均不生成正文或基线 | 模板校验、两模式实际创建与材料测试、脱敏示例检查 |
| AC-02 分发与升级一致 | 创建、切换、升级及材料入口共用 manifest 选择；页面说明 README 归属 kit-managed | 两模式归属对比、既有模式切换与升级测试 |
| AC-03 已有正文与人工门禁受保护 | 默认预览，显式 apply 新增；已有正文不覆盖，升级保留业务内容，事务失败回滚，后续改动阻断恢复 | 重复、预览过期、故障注入及恢复测试；模式、交接状态保持不变 |
| AC-04 证据按当前采用基线生效 | AGENTS、README、启动说明、Kit 现行审查规范、文档基线与本地引用/快照纳入检查覆盖；报告区分缺失、过期、失败、覆盖不足、不支持 | 检查执行器和评审包测试；最终 Schema 2 实际进程报告 |
| AC-05 任务只展开直接材料 | CR documents 可引用条目 ID 或文档位置；只展开选中项，相关修订/快照变化使旧上下文失效 | 文档与任务上下文测试；不相关条目变化不会污染当前任务上下文 |
| AC-06 文档审查进入日常入口 | documents:validate 接入 Kit check 与业务 check；三个既有 Skill 支持业务文档及需求/接口/Demo 对照 | 完整检查、Skills 路由/边界检查、独立业务实例运行 |
| AC-07 交付链路可使用新材料 | Kit 临时打包、校验和、解包后可准备新文档；业务评审包保留采用的本地引用和快照，解包后摘要可复核 | release:smoke 隔离回放 |

## 实际修改分组

- 模板与分发：template-manifest.json、新增 optional/documents 三份材料、template-manifest.mjs、runtime-manifest.mjs、project-generator-lib.mjs、upgrade-project.mjs、project-material.mjs
- 校验与运行时：documents-validate.mjs、business-runtime.mjs、runtime/validate.mjs、runtime/package.mjs、archive-policy.mjs、check-current.mjs、validate-project.mjs、validate-templates.mjs、两侧 package.json
- 证据与上下文：check-runner.mjs、review-package.mjs、task-context.mjs、workflow/model.mjs 及相应回归测试
- 协作规范与入口：AGENTS、README、START-HERE、业务 AGENTS 模板、现行审查基线与清单、证据指引、三个既有 Skill、业务文档参考及 skill-boundaries.json
- 样例与验证：examples/document-review 四份合成材料、test-documents.mjs、test-project-material.mjs、verify-document-release.mjs

没有修改 project-status.json、历史台账、项目锁文件或现有业务 Demo。源码版本保持 0.4.0，不将此候选标为正式发布。

## 已执行检查

| 检查 | 结果 |
| --- | --- |
| pnpm check（最终由 check:scope 执行） | 25/25 当前源码检查及隔离回归通过 |
| pnpm check:scope -- --no-cache | 实际执行完整检查与前端生产构建，两项退出码均为 0；无阻断项 |
| pnpm release:smoke | 临时目录 Kit 构建、打包、摘要、解包、材料准备及业务评审包引用完整性通过；测试包已清理 |
| pnpm install:test | 使用锁定依赖独立安装与构建通过，依赖未链接宿主 Kit |
| pnpm browser:test | 菜单、取消、完成、重置、场景上下文、返回评审、占位控件及结论记录八类通过；页面脚本错误为 0 |
| pnpm skills:validate 及路由/职责回归 | 三个 Skill 更新后的职责、引用、路由通过，未新增重复 Skill |
| git diff --check | 通过 |

最终实际报告：[Schema 2 检查记录](../../dist/checks/f17f2027b24a4223c9fb8eb6cfd17c2848cb9f157d689193ec2289cfdd172fbc.json)。使用 pnpm 10.12.4 补验的执行时间为北京时间 2026-10-16 10:53:13，源码指纹为 `9ab0352b897d33c24ea69dc3f07a8f9702dbb4a7eff34835a6fa980a1ac6f8b8`。后续相关文件变化时，此报告须重新核验。

浏览器与独立安装结果位于本地 dist/verification，不作为正式发布物。初轮验证使用 Node 24.19.0、环境提供的 pnpm 11.25.0；随后已使用项目声明的 pnpm 10.12.4 补跑完整检查、前端构建，以及独立项目的锁定依赖安装与构建，均通过。pnpm 10.12.4 安装在临时工具目录，未修改全局包管理器或项目锁文件。

## 五步流程回放与 Git 状态（补验）

北京时间 2026-10-16 10:55 使用 pnpm 10.12.4，在独立安装产生的合成项目中实际调用材料 CLI、业务校验和升级入口：

| 步骤 | 实际结果 |
| --- | --- |
| 新建空项目 | 快速模式，未生成正式 CR 与文档基线 |
| 准备两份文档 | 预览不写正文，显式 apply 后生成模板与空基线 |
| 登记采用修订与快照 | 离线结构、引用及摘要通过，明确不证明在线最新 |
| 修改采用修订 | 原实际检查报告变为 stale，不能继续支持当前结论 |
| 升级工作流 | 自行维护的业务正文保留，模式、确认与交接状态未改变 |

五步均通过，结果见本地 `dist/verification/product-walkthrough-pnpm10.json`。这是技术回放，工作流整体的产品验收仍由用户确认。

经用户同意沿用历史邮箱，本仓库 Git 身份已设为 `Bean <yuxuanliu1238@gmail.com>`，未修改全局身份。GitHub 连接器确认当前账号 `yuxuanliu1238-droid` 对本仓库有 push 和 admin 权限；本机 Git 的普通 dry-run 及系统 osxkeychain 凭证方式均因缺少命令行登录而失败。此失败表示本机凭证尚未就绪，不表示账号没有仓库权限。Git 提交、推送与正式发布仍未执行。

## 未验证、限制与下一动作

- 两份模板格式已获确认；在线文档是否发生新修订、具体业务规则批准及工作流整体评审仍未验证；documents:validate 明确只做离线结构、本地引用和摘要检查
- 执行器内部跳过的台账证据文件逐项核验，不由绿色进程报告代替；评审包会显示这一限制
- 独立 quick_validate.py 因环境缺少 PyYAML 未能运行；采用仓库自带 Skills 校验与实际路由/职责回归，未为此修改 Python 环境或项目依赖
- 历史全文校验不在当前日常入口，本轮未重写历史台账的旧阶段名或生成记录；此前识别的两项历史差异继续保留
- 没有建设在线文档自动同步、完整增量依赖图或新的文档管理平台，check:scope 继续如实回退全量
- 技术验证无已知阻断；两份模板格式确认已记录，后续按需评审其余工作流能力与使用方式。工具检查通过、模板格式确认、整体评审、Git 提交及发布分别记录，不自动跨入下一阶段
