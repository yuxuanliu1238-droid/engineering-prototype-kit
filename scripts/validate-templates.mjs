import { promises as fs } from "node:fs";
import path from "node:path";
import {
  assertObject,
  hasText,
  printResult,
  readJson,
  ROOT,
  walk,
} from "./project-lib.mjs";
import { resolveActivationIds } from "./template-manifest.mjs";

const errors = [];
const manifestPath = "templates/business-project/template-manifest.json";
const templateRoot = path.join(ROOT, "templates/business-project");
const manifest = await readJson(manifestPath);

const EXPECTED_MODES = ["rapid-validation", "continuous-iteration"];
const ALLOWED_INCLUSIONS = ["always", "continuous-iteration", "on-demand"];
const ALLOWED_OWNERSHIP = ["business", "kit-managed", "generated-view"];
const REQUIRED_INTERNAL_PATHS = [
  "skills",
  "scripts",
  "examples",
  "templates",
  "docs/design",
  "docs/review/v0.1-verification.md",
  "docs/review/v0.2-verification.md",
];

if (manifest.schemaVersion !== 1) errors.push("模板清单 schemaVersion 必须为 1");
if (manifest.templateVersion !== (await readJson("package.json")).version) {
  errors.push("模板清单 templateVersion 必须与 package.json.version 一致");
}
if (JSON.stringify(manifest.modes) !== JSON.stringify(EXPECTED_MODES)) {
  errors.push("模板清单必须按顺序声明两种 V0.3 模式");
}
if (!Array.isArray(manifest.files)) errors.push("模板清单 files 必须是数组");

const sources = new Set();
const targets = new Set();
const activationIds = new Set();

for (const [index, file] of (manifest.files || []).entries()) {
  const label = `files[${index}]`;
  if (!assertObject(file, label, errors)) continue;
  for (const field of ["source", "target", "inclusion", "ownership"]) {
    if (!hasText(file[field])) errors.push(`${label}.${field} 缺失`);
  }
  if (!ALLOWED_INCLUSIONS.includes(file.inclusion)) {
    errors.push(`${label}.inclusion 无效`);
  }
  if (!ALLOWED_OWNERSHIP.includes(file.ownership)) {
    errors.push(`${label}.ownership 无效`);
  }
  if (sources.has(file.source)) errors.push(`模板来源重复：${file.source}`);
  if (targets.has(file.target)) errors.push(`业务项目目标重复：${file.target}`);
  sources.add(file.source);
  targets.add(file.target);

  try {
    await fs.access(path.join(templateRoot, file.source));
  } catch {
    errors.push(`${label}.source 不存在：${file.source}`);
  }

  if (file.inclusion === "on-demand") {
    if (!hasText(file.activationId)) errors.push(`${label}.activationId 缺失`);
    if (activationIds.has(file.activationId)) {
      errors.push(`按需模块 activationId 重复：${file.activationId}`);
    }
    activationIds.add(file.activationId);
  } else if (file.activationId !== undefined) {
    errors.push(`${label} 非按需模板不得声明 activationId`);
  }
}

for (const [id, dependencies] of Object.entries(manifest.activationDependencies || {})) {
  if (!Array.isArray(dependencies) || dependencies.some((dependency) => !activationIds.has(dependency))) {
    errors.push(`按需材料依赖无效：${id}`);
  }
  try { resolveActivationIds([id]); } catch (error) { errors.push(error.message); }
}
for (const id of manifest.materialActivations || []) {
  if (!activationIds.has(id)) errors.push(`材料入口指向未知 activationId：${id}`);
  const entry = manifest.files.find((file) => file.activationId === id);
  if (entry?.ownership !== "business" || !hasText(entry.configKey)) errors.push(`材料入口必须声明 business 归属及 configKey：${id}`);
}

const alwaysTargets = (manifest.files || [])
  .filter((file) => file.inclusion === "always")
  .map((file) => file.target)
  .sort();
const expectedAlwaysTargets = [
  "docs/business-baseline.md",
  "docs/review/review-confirmation.md",
].sort();
if (JSON.stringify(alwaysTargets) !== JSON.stringify(expectedAlwaysTargets)) {
  errors.push("快速验证实例只能默认携带业务基线和评审确认材料");
}

const rapidForbidden = (manifest.files || []).filter(
  (file) =>
    file.inclusion === "always" &&
    /(?:decisions|domain|page-guides|requirements|scenarios)/.test(file.target),
);
if (rapidForbidden.length) {
  errors.push(`快速验证默认包含了持续迭代材料：${rapidForbidden.map((item) => item.target).join("、")}`);
}

for (const requiredPath of REQUIRED_INTERNAL_PATHS) {
  if (!(manifest.internalOnly || []).includes(requiredPath)) {
    errors.push(`internalOnly 缺少 Kit 内部路径：${requiredPath}`);
  }
}

const generatedTargets = new Set(
  (manifest.generatedViews || []).map((view) => view.target),
);
for (const requiredTarget of ["docs/page-guides", "docs/requirements/requirements.md", "docs/development/development-task-list.md"]) {
  if (!generatedTargets.has(requiredTarget)) {
    errors.push(`缺少生成视图声明：${requiredTarget}`);
  }
}
for (const [index, view] of (manifest.generatedViews || []).entries()) {
  if (view.template !== undefined) {
    if (!hasText(view.template)) {
      errors.push(`generatedViews[${index}].template 必须是非空字符串`);
      continue;
    }
    try {
      await fs.access(path.join(templateRoot, view.template));
    } catch {
      errors.push(`generatedViews[${index}].template 不存在：${view.template}`);
    }
  }
}

const requiredText = new Map([
  [
    "shared/docs/business-baseline.md",
    ["## 1. 评审目标与输入判断", "## 4. 核心流程", "## 7. 临时假设", "## 8. 待确认问题", "## 10. 持续迭代基线", "必要配置", "代表性异常", "可恢复演示数据"],
  ],
  [
    "shared/docs/review/review-confirmation.md",
    ["评审结论", "继续建设范围", "明确不做范围", "模式切换", "外部证据", "确认人/时间", "分层评审结果", "反馈闭环", "表单提交成功"],
  ],
  [
    "shared/docs/demo-blueprint.md",
    ["输入充分度", "菜单与页面", "核心流程串联", "必要配置与代表性异常", "评审中心入口", "不逐字段确认"],
  ],
  [
    "continuous/docs/decisions/decisions.md",
    ["## 准入条件", "采用 / 禁止 / 已替代", "确认日期", "替代关系"],
  ],
  [
    "continuous/docs/requirements/README.md",
    ["都归属于对应 CR", "不维护独立的空白工作包证据表"],
  ],
  [
    "continuous/docs/page-guides/README.md",
    ["页面契约与当前原型的可读生成视图", "不直接同步多份页面文档"],
  ],
  [
    "internal/generated-views/requirements.md",
    ["## 1. 当前总览", "## 2. 单条需求详情", "当前责任人", "下一步", "详细任务控制"],
  ],
  [
    "internal/generated-views/development-task-list.md",
    ["不承担负责人、工期、进度和完成比例管理", "## 3. 应用功能任务", "## 4. 外部系统接口任务", "## 5. 非页面研发任务", "## 6. 完整性检查"],
  ],
]);

for (const [relativePath, snippets] of requiredText) {
  const content = await fs.readFile(path.join(templateRoot, relativePath), "utf8");
  for (const snippet of snippets) {
    if (!content.includes(snippet)) {
      errors.push(`${relativePath} 缺少材料边界说明：${snippet}`);
    }
  }
}

try {
  const scenariosTemplate = await fs.readFile(path.join(templateRoot, "runtime/prototype/src/review-scenarios.json"), "utf8");
  JSON.parse(scenariosTemplate.replace("{{REVIEW_CENTER_ENABLED_BOOL}}", "true"));
} catch (error) {
  errors.push(`评审场景运行时模板不是可渲染 JSON：${error.message}`);
}

const secretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /[?&](?:token|key|secret|password)=[^&\s]+/i,
];
const templateFiles = await walk("templates/business-project");
for (const relativePath of templateFiles) {
  if (relativePath.endsWith("template-manifest.json")) continue;
  const content = await fs.readFile(path.join(ROOT, relativePath), "utf8");
  if (secretPatterns.some((pattern) => pattern.test(content))) {
    errors.push(`业务项目模板疑似包含敏感信息：${relativePath}`);
  }
}

printResult(
  "业务项目模板校验",
  errors,
  `${manifest.files.length} 个模板清单条目：2 个默认业务材料、3 个持续迭代材料、${activationIds.size} 个按需材料`,
);
