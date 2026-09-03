import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { hasText, pathExists, printResult, readJson, ROOT, walk } from "./project-lib.mjs";
import { renderRequirements, validateRegistryData } from "./workflow-v3-lib.mjs";
import { renderPageGuides, validateBusinessPageContracts } from "./page-guide-lib.mjs";
import { validateReviewScenarios, validateValidationProfile } from "./rapid-validation-lib.mjs";

const command = process.argv[2] || "check";

function safeProjectPath(relativePath) {
  const absolutePath = path.resolve(ROOT, relativePath);
  if (absolutePath !== ROOT && !absolutePath.startsWith(`${ROOT}${path.sep}`)) {
    throw new Error(`路径越出业务项目：${relativePath}`);
  }
  return absolutePath;
}

async function projectPathExists(relativePath) {
  try {
    await fs.access(safeProjectPath(relativePath));
    return true;
  } catch {
    return false;
  }
}

async function writeRequirements() {
  const config = await readJson("project.config.json");
  const status = await readJson("project-status.json");
  if (status.currentMode !== "continuous-iteration") {
    throw new Error("快速验证模式没有正式 CR 台账，无需生成需求视图");
  }
  const registry = JSON.parse(await fs.readFile(safeProjectPath(config.paths.requirements), "utf8"));
  const errors = validateRegistryData(registry);
  if (!printResult("需求台账生成前校验", errors, `${registry.items.length} 条需求`)) {
    throw new Error("需求台账未通过校验");
  }
  const target = safeProjectPath(config.paths.requirementsSummary);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, renderRequirements(registry), "utf8");
  console.log(`已生成：${config.paths.requirementsSummary}`);
}

async function writePageGuides() {
  const config = await readJson("project.config.json");
  const status = await readJson("project-status.json");
  if (status.currentMode !== "continuous-iteration") {
    throw new Error("快速验证模式不创建正式页面契约或页面说明");
  }
  const contractsPath = config.paths.contracts || "prototype/src/contracts/contracts.json";
  if (!(await projectPathExists(contractsPath))) {
    console.log("当前需求尚未触发正式页面契约，未生成页面说明。");
    return;
  }
  const registry = JSON.parse(await fs.readFile(safeProjectPath(config.paths.requirements), "utf8"));
  const contracts = JSON.parse(await fs.readFile(safeProjectPath(contractsPath), "utf8"));
  const errors = [
    ...validateRegistryData(registry),
    ...validateBusinessPageContracts(contracts, registry, config),
  ];
  if (!printResult("页面说明生成前校验", errors, `${contracts.length} 个触达页面`)) {
    throw new Error("页面契约未通过校验");
  }
  const target = safeProjectPath(config.paths.pageGuides || "docs/page-guides/pages.md");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, renderPageGuides(contracts), "utf8");
  console.log(`已生成：${path.relative(ROOT, target)}`);
}

async function validateProject() {
  const errors = [];
  const config = await readJson("project.config.json");
  const status = await readJson("project-status.json");
  const manifest = await readJson(".prototype-kit/manifest.json");
  const modes = ["rapid-validation", "continuous-iteration"];

  if (config.schemaVersion !== 2) errors.push("project.config.json schemaVersion 必须为 2");
  if (config.instanceKind !== "business-project") errors.push("instanceKind 必须为 business-project");
  if (!hasText(config.projectName)) errors.push("projectName 缺失");
  if (!hasText(config.kitVersion)) errors.push("kitVersion 缺失");
  for (const [name, relativePath] of Object.entries(config.paths || {})) {
    if (!hasText(relativePath)) {
      errors.push(`config.paths.${name} 缺失`);
      continue;
    }
    try {
      safeProjectPath(relativePath);
    } catch (error) {
      errors.push(error.message);
    }
  }
  if (status.schemaVersion !== 2) errors.push("project-status.json schemaVersion 必须为 2");
  if (!modes.includes(status.currentMode)) errors.push("currentMode 无效");
  if (status.modeState !== "confirmed") errors.push("业务项目模式必须经产品经理确认");
  errors.push(...validateValidationProfile(status.validationProfile));
  if (!Array.isArray(status.modeHistory) || status.modeHistory.length === 0) {
    errors.push("缺少模式确认历史");
  } else {
    const latest = status.modeHistory.at(-1);
    if (latest.mode !== status.currentMode || !hasText(latest.recommendationReason) || !hasText(latest.confirmedBy) || !hasText(latest.confirmedAt)) {
      errors.push("最新模式确认记录不完整或与当前模式不一致");
    }
  }
  try {
    const baseline = await fs.readFile(path.join(ROOT, "docs/business-baseline.md"), "utf8");
    if (!baseline.includes(`当前模式：${status.currentMode}`)) {
      errors.push("业务基线记录的当前模式与 project-status.json 不一致");
    }
    for (const snippet of ["## 1. 评审目标与输入判断", "必要配置", "代表性异常", "可恢复演示数据"]) {
      if (!baseline.includes(snippet)) errors.push(`业务基线缺少快速 Demo 边界：${snippet}`);
    }
  } catch {
    errors.push("无法读取业务基线");
  }
  if (manifest.kitVersion !== config.kitVersion) errors.push("固定 Kit 版本与管理清单不一致");

  const always = [
    "START-HERE.md",
    "README.md",
    "AGENTS.md",
    "inbox/README.md",
    "docs/business-baseline.md",
    "docs/review/review-confirmation.md",
    "prototype/package.json",
    "prototype/src/App.jsx",
    ".prototype-kit/manifest.json",
    ".prototype-kit/project-lib.mjs",
    ".prototype-kit/workflow-v3-lib.mjs",
    ".prototype-kit/contract-lib.mjs",
    ".prototype-kit/page-guide-lib.mjs",
    ".prototype-kit/rapid-validation-lib.mjs",
    ".prototype-kit/business-cli.mjs",
  ];
  for (const relativePath of always) {
    if (!(await pathExists(relativePath))) errors.push(`缺少业务项目路径：${relativePath}`);
  }

  const internalOnly = [
    "skills",
    "scripts",
    "examples",
    "templates",
    "docs/design",
    "docs/review/v0.1-verification.md",
    "docs/review/v0.2-verification.md",
    "docs/review/review-baseline.md",
    "docs/review/review-checklist.md",
    "docs/review/change-request-flow.md",
    "docs/review/work-package-evidence.md",
    "docs/requirements/task-control-model.md",
  ];
  const retainedLegacyPaths = new Set(config.legacyMigration?.retainedInternalPaths || []);
  for (const relativePath of internalOnly) {
    if (await pathExists(relativePath) && !retainedLegacyPaths.has(relativePath)) {
      errors.push(`业务实例不应包含 Kit 内部材料：${relativePath}`);
    }
  }

  const continuousPaths = [
    "docs/decisions/decisions.md",
    "docs/requirements/registry.json",
    "docs/requirements/requirements.md",
    "docs/page-guides/README.md",
  ];
  let registry = null;
  const profile = status.validationProfile;
  const scenariosPath = config.paths.reviewScenarios || "prototype/src/review-scenarios.json";
  if (await projectPathExists(scenariosPath)) {
    try {
      const scenarios = JSON.parse(await fs.readFile(safeProjectPath(scenariosPath), "utf8"));
      if (scenarios.reviewCenterEnabled !== profile?.reviewCenter?.enabled) {
        errors.push("评审场景配置与 validationProfile.reviewCenter 不一致");
      }
      if (profile?.reviewCenter?.enabled) errors.push(...validateReviewScenarios(scenarios));
    } catch (error) {
      errors.push(`无法读取评审场景配置：${error.message}`);
    }
  } else if (profile?.reviewCenter?.enabled) {
    errors.push("已启用评审中心，但缺少评审场景配置");
  }
  if (status.currentMode === "rapid-validation") {
    const blueprintRequired = profile?.inputSufficiency?.level === "partial" || profile?.reviewCenter?.enabled === true;
    if (blueprintRequired && !(await projectPathExists(config.paths.demoBlueprint || "docs/demo-blueprint.md"))) {
      errors.push("部分充分输入或启用评审中心时必须创建 Demo 蓝图");
    }
    for (const relativePath of [
      ...continuousPaths,
      "docs/domain",
      "docs/scenarios",
      "prototype/src/contracts",
    ]) {
      if (await pathExists(relativePath)) {
        errors.push(`快速验证模式不得默认创建持续迭代材料：${relativePath}`);
      }
    }
  } else {
    for (const relativePath of continuousPaths) {
      if (!(await pathExists(relativePath))) errors.push(`持续迭代模式缺少：${relativePath}`);
    }
    if (await projectPathExists(config.paths.requirements)) {
      registry = JSON.parse(await fs.readFile(safeProjectPath(config.paths.requirements), "utf8"));
      errors.push(...validateRegistryData(registry));
      const expectedView = renderRequirements(registry);
      try {
        const actualView = await fs.readFile(safeProjectPath(config.paths.requirementsSummary), "utf8");
        if (actualView !== expectedView) errors.push("需求可读视图与 Schema v3 台账不同步，请先运行 workflow:generate");
      } catch {
        errors.push("无法读取需求可读视图");
      }
    }
    const contractsPath = config.paths.contracts || "prototype/src/contracts/contracts.json";
    const pageGuidesPath = config.paths.pageGuides || "docs/page-guides/pages.md";
    if (await projectPathExists(contractsPath)) {
      try {
        const contracts = JSON.parse(await fs.readFile(safeProjectPath(contractsPath), "utf8"));
        errors.push(...validateBusinessPageContracts(contracts, registry || { items: [] }, config));
        for (const contract of contracts) {
          const previewPath = `prototype/${contract.preview?.entry || ""}`;
          if (!(await pathExists(previewPath))) errors.push(`${contract.pageId || "页面契约"} 的原型入口不存在：${previewPath}`);
        }
        const expectedGuide = renderPageGuides(contracts);
        try {
          const actualGuide = await fs.readFile(safeProjectPath(pageGuidesPath), "utf8");
          if (actualGuide !== expectedGuide) errors.push("页面说明与页面契约不同步，请先运行 page-guides:generate");
        } catch {
          errors.push("已存在页面契约，但缺少生成的页面说明");
        }
      } catch (error) {
        errors.push(`无法读取页面契约：${error.message}`);
      }
    } else if (await projectPathExists(pageGuidesPath)) {
      errors.push("页面契约未触发，但仍存在正式页面说明生成文件");
    }
  }

  for (const entry of manifest.files || []) {
    if (entry.ownership !== "kit-managed") continue;
    let absolutePath;
    try {
      absolutePath = safeProjectPath(entry.path);
    } catch (error) {
      errors.push(error.message);
      continue;
    }
    try {
      const content = await fs.readFile(absolutePath);
      const checksum = createHash("sha256").update(content).digest("hex");
      if (checksum !== entry.sha256) errors.push(`Kit 管理文件发生未登记修改：${entry.path}`);
    } catch {
      errors.push(`Kit 管理文件缺失：${entry.path}`);
    }
  }

  const result = printResult(
    "业务项目检查",
    errors,
    `${status.currentMode}，Kit ${config.kitVersion}${retainedLegacyPaths.size ? `，兼容保留 ${retainedLegacyPaths.size} 个未审计历史路径` : "，未混入内部材料"}`,
  );
  if (!result) process.exitCode = 1;
}

async function packageReview() {
  await validateProject();
  if (process.exitCode) throw new Error("项目检查失败，未生成评审包");

  const config = await readJson("project.config.json");
  const { zipSync } = await import("fflate");
  const retainedInternalPaths = new Set(config.legacyMigration?.retainedInternalPaths || []);
  const files = await walk(".", {
    exclude: (relativePath, entry) => {
      const segments = relativePath.split("/");
      if (entry.isDirectory() && ["node_modules", ".git", "inbox", ".prototype-kit", "skills", "scripts", "examples", "templates"].includes(entry.name)) return true;
      if (segments[0] === "dist") return true;
      if ([...retainedInternalPaths].some((retained) => relativePath === retained || relativePath.startsWith(`${retained}/`))) return true;
      if (relativePath === "docs/design" || relativePath.startsWith("docs/design/")) return true;
      if (relativePath === "docs/review/v0.2-verification.md") return true;
      if (segments.includes("node_modules")) return true;
      if (relativePath.startsWith(".prototype-kit/backups/")) return true;
      return false;
    },
  });
  const base = `${config.packageName}-review`;
  const entries = {};
  for (const relativePath of files) {
    const content = await fs.readFile(path.join(ROOT, relativePath));
    entries[`${base}/${relativePath}`] = content;
  }
  const archive = zipSync(entries, { level: 6 });
  const outputDirectory = path.join(ROOT, "dist", "review");
  const archivePath = path.join(outputDirectory, `${base}.zip`);
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.writeFile(archivePath, archive);
  const checksum = createHash("sha256").update(archive).digest("hex");
  await fs.writeFile(`${archivePath}.sha256`, `${checksum}  ${path.basename(archivePath)}\n`, "utf8");
  console.log(`已生成业务项目评审包：${path.relative(ROOT, archivePath)}`);
}

if (command === "check") await validateProject();
else if (command === "generate") await writeRequirements();
else if (command === "generate-page-guides") await writePageGuides();
else if (command === "package-review") await packageReview();
else throw new Error(`未知命令：${command}`);
