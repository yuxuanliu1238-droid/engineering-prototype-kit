import { verifyEvidenceFiles } from "../evidence-policy.mjs";

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { hasText, pathExists, printResult, readJson, ROOT } from "../project-lib.mjs";
import { renderRequirements, validateRegistryData } from "../workflow-v3-lib.mjs";
import { renderPageGuides, validateBusinessPageContracts } from "../page-guide-lib.mjs";
import { validateReviewScenarios, validateValidationProfile } from "../rapid-validation-lib.mjs";

import { safeProjectPath, projectPathExists, handoffPaths } from "./common.mjs";

export async function validateProject({ strict = false } = {}) {
  const errors = [];
  const config = await readJson("project.config.json");
  const status = await readJson("project-status.json");
  const manifest = await readJson(".prototype-kit/manifest.json");
  const modes = ["rapid-validation", "continuous-iteration"];

  if (config.schemaVersion !== 2) errors.push("project.config.json schemaVersion 必须为 2");
  if (config.instanceKind !== "business-project")
    errors.push("instanceKind 必须为 business-project");
  if (!/^[a-z0-9][a-z0-9-]*$/.test(config.packageName || ""))
    errors.push("packageName 必须是安全的小写包名");
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
    if (
      latest.mode !== status.currentMode ||
      !hasText(latest.recommendationReason) ||
      !hasText(latest.confirmedBy) ||
      !hasText(latest.confirmedAt)
    ) {
      errors.push("最新模式确认记录不完整或与当前模式不一致");
    }
  }
  const developmentHandoff = status.capabilities?.developmentHandoff;
  if (developmentHandoff !== undefined) {
    if (typeof developmentHandoff.enabled !== "boolean")
      errors.push("capabilities.developmentHandoff.enabled 必须是布尔值");
    if (!["confirmed", "not-enabled"].includes(developmentHandoff.state))
      errors.push("capabilities.developmentHandoff.state 无效");
    if (developmentHandoff.enabled === true) {
      if (developmentHandoff.state !== "confirmed")
        errors.push("启用产研交接时必须记录 confirmed 状态");
      if (
        !hasText(developmentHandoff.reason) ||
        !hasText(developmentHandoff.confirmedBy) ||
        !hasText(developmentHandoff.confirmedAt)
      ) {
        errors.push("启用产研交接时必须记录原因、确认人与确认时间");
      }
    }
  }
  try {
    const baseline = await fs.readFile(path.join(ROOT, "docs/business-baseline.md"), "utf8");
    if (!baseline.includes(`当前模式：${status.currentMode}`)) {
      errors.push("业务基线记录的当前模式与 project-status.json 不一致");
    }
    for (const snippet of [
      "## 1. 评审目标与输入判断",
      "必要配置",
      "代表性异常",
      "可恢复演示数据",
    ]) {
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
    if ((await pathExists(relativePath)) && !retainedLegacyPaths.has(relativePath)) {
      errors.push(`业务实例不应包含 Kit 内部材料：${relativePath}`);
    }
  }

  const continuousPaths = [
    "docs/decisions/decisions.md",
    config.paths.requirements,
    config.paths.requirementsSummary,
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
    const blueprintRequired =
      profile?.inputSufficiency?.level === "partial" || profile?.reviewCenter?.enabled === true;
    if (
      blueprintRequired &&
      !(await projectPathExists(config.paths.demoBlueprint || "docs/demo-blueprint.md"))
    ) {
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
      for (const item of registry.items || []) {
        const strictErrors = validateRegistryData({ ...registry, items: [item] }, { strict: true });
        if (strict || ["ready", "in-progress"].includes(item.executionState)) {
          errors.push(
            ...strictErrors,
            ...(process.env.KIT_CHECK_RUNNING === "1" ? [] : await verifyEvidenceFiles(item, ROOT)),
          );
        } else if (strictErrors.length)
          console.log(`${item.id}：未按新规则验证（保留原状态；重新推进或交付必须核验）`);
      }
      const expectedView = renderRequirements(registry);
      try {
        const actualView = await fs.readFile(
          safeProjectPath(config.paths.requirementsSummary),
          "utf8",
        );
        if (actualView !== expectedView)
          errors.push("需求可读视图与 Schema v3 台账不同步，请先运行 workflow:generate");
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
          if (!(await pathExists(previewPath)))
            errors.push(`${contract.pageId || "页面契约"} 的原型入口不存在：${previewPath}`);
        }
        const expectedGuide = renderPageGuides(contracts);
        try {
          const actualGuide = await fs.readFile(safeProjectPath(pageGuidesPath), "utf8");
          if (actualGuide !== expectedGuide)
            errors.push("页面说明与页面契约不同步，请先运行 page-guides:generate");
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

  if (developmentHandoff?.enabled === true) {
    if (status.currentMode !== "continuous-iteration") errors.push("快速验证模式不得启用产研交接");
    const paths = handoffPaths(config);
    for (const relativePath of [
      "docs/development/README.md",
      paths.source,
      paths.view,
      ".prototype-kit/development-handoff-lib.mjs",
      ".prototype-kit/development-task-prompt-lib.mjs",
    ]) {
      if (!(await projectPathExists(relativePath)))
        errors.push(`已启用产研交接但缺少：${relativePath}`);
    }
    if ((await projectPathExists(paths.source)) && (await projectPathExists(paths.view))) {
      try {
        const handoff = JSON.parse(await fs.readFile(safeProjectPath(paths.source), "utf8"));
        const { renderDevelopmentTaskList, validateDevelopmentHandoff } = await import(
          "../development-handoff-lib.mjs"
        );
        errors.push(...validateDevelopmentHandoff(handoff));
        const actual = await fs.readFile(safeProjectPath(paths.view), "utf8");
        if (actual !== renderDevelopmentTaskList(handoff)) {
          errors.push("研发任务清单与结构化台账不同源，请先运行 handoff:generate");
        }
      } catch (error) {
        errors.push(`无法校验研发任务清单：${error.message}`);
      }
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
