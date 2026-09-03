import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ROOT } from "./project-lib.mjs";
import { parseFocuses, validateValidationProfile } from "./rapid-validation-lib.mjs";
import { makeEmptyRegistry, renderRequirements } from "./workflow-v3-lib.mjs";

export const KIT_VERSION = "0.3.0";
export const MODES = ["rapid-validation", "continuous-iteration"];

export function packageNameFor(name) {
  const normalized = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "business-prototype";
}

function renderTemplate(content, values) {
  return content.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`);
}

async function ensureEmptyTarget(targetRoot) {
  try {
    const entries = await fs.readdir(targetRoot);
    if (entries.length) throw new Error(`目标目录不是空目录：${targetRoot}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await fs.mkdir(targetRoot, { recursive: true });
  }
}

async function writeManaged(targetRoot, relativePath, content, files, ownership = "kit-managed") {
  const absolutePath = path.join(targetRoot, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content);
  files.push({
    path: relativePath.split(path.sep).join("/"),
    ownership,
    sha256: createHash("sha256").update(content).digest("hex"),
  });
}

async function copyMaterial(targetRoot, source, target, files, ownership) {
  const content = await fs.readFile(path.join(ROOT, "templates/business-project", source));
  await writeManaged(targetRoot, target, content, files, ownership);
}

function makeValidationProfile(options, timestamp) {
  const isRapid = options.mode === "rapid-validation";
  const profile = {
    focuses: parseFocuses(options.validationFocuses || (isRapid ? [] : ["business-solution"])),
    primaryFocus: options.primaryValidationFocus || (isRapid ? null : "business-solution"),
    recommendedBy: "ai",
    recommendationReason: options.validationRecommendationReason || (isRapid ? "" : options.recommendationReason),
    confirmationState: "confirmed",
    confirmedBy: options.confirmedBy?.trim(),
    confirmedAt: timestamp,
    inputSufficiency: {
      level: options.inputSufficiency || (isRapid ? null : "sufficient"),
      reason: options.inputSufficiencyReason || (isRapid ? "" : "项目已通过需求评审并进入持续建设"),
      known: options.inputKnown || [],
      missing: options.inputMissing || [],
      canProceed: options.inputCanProceed || [],
      requiresConfirmation: options.inputRequiresConfirmation || [],
      mustNotDo: options.inputMustNotDo || [],
    },
    reviewCenter: {
      enabled: options.reviewCenterEnabled === true,
      reason: options.reviewCenterReason || (options.reviewCenterEnabled ? "存在多个需要独立进入的评审场景" : "当前范围可直接在业务系统内完成评审"),
    },
  };
  const errors = validateValidationProfile(profile);
  if (errors.length) throw new Error(`评审目标或输入判断不完整：${errors.join("；")}`);
  return profile;
}

function renderBaselineProfile(content, profile) {
  const labels = { "business-solution": "业务方案", "prototype-presentation": "原型呈现", "generation-workflow": "生成工作流" };
  let result = content;
  for (const [focus, label] of Object.entries(labels)) {
    const selected = profile.focuses.includes(focus) ? "是" : "否";
    const primary = profile.primaryFocus === focus ? "是" : "否";
    const row = `| ${label} | ${selected} | ${primary} | ${profile.recommendationReason} | ${profile.confirmedBy} | ${selected === "是" ? "已确认" : "未选择"} |`;
    result = result.replace(new RegExp(`\\| ${label} \\|.*`), row);
  }
  const labelsByLevel = { sufficient: "充分", partial: "部分充分", insufficient: "不充分" };
  const sufficiency = profile.inputSufficiency;
  const replacements = [
    [/AI 建议等级：待判断，可选“充分、部分充分、不充分”。/, `AI 建议等级：${labelsByLevel[sufficiency.level]}。`],
    [/判断理由：待整理。/, `判断理由：${sufficiency.reason}。`],
    [/已经能确定：待整理。/, `已经能确定：${sufficiency.known.join("；") || "暂无"}。`],
    [/仍然缺少：待整理。/, `仍然缺少：${sufficiency.missing.join("；") || "暂无"}。`],
    [/可以继续生成：待整理。/, `可以继续生成：${sufficiency.canProceed.join("；") || "暂无"}。`],
    [/需要产品确认：待整理。/, `需要产品确认：${sufficiency.requiresConfirmation.join("；") || "暂无"}。`],
    [/当前不应做：待整理。/, `当前不应做：${sufficiency.mustNotDo.join("；") || "暂无"}。`],
    [/产品经理确认：待确认。/, `产品经理确认：${profile.confirmedBy}，${profile.confirmedAt}。`],
  ];
  for (const [pattern, value] of replacements) result = result.replace(pattern, value);
  return result;
}

export async function createBusinessProject(options) {
  const { name, output, mode, recommendationReason, confirmedBy, confirmedAt } = options;
  if (!name?.trim()) throw new Error("缺少项目名称 --name");
  if (!MODES.includes(mode)) throw new Error(`--mode 必须为 ${MODES.join(" 或 ")}`);
  if (!recommendationReason?.trim()) throw new Error("缺少 AI 模式推荐依据 --recommendation-reason");
  if (!confirmedBy?.trim()) throw new Error("缺少模式确认人 --confirmed-by");

  const timestamp = confirmedAt || new Date().toISOString();
  const validationProfile = makeValidationProfile(options, timestamp);
  const targetRoot = path.resolve(output);
  await ensureEmptyTarget(targetRoot);
  const packageName = packageNameFor(name);
  const values = {
    PROJECT_NAME: name.trim(),
    PACKAGE_NAME: packageName,
    KIT_VERSION,
    MODE: mode,
    INPUT_SUFFICIENCY: validationProfile.inputSufficiency.level,
    PRIMARY_VALIDATION_FOCUS: validationProfile.primaryFocus,
    REVIEW_CENTER_ENABLED: validationProfile.reviewCenter.enabled ? "是" : "否",
    REVIEW_CENTER_ENABLED_BOOL: String(validationProfile.reviewCenter.enabled),
    REVIEW_CENTER_REASON: validationProfile.reviewCenter.reason,
  };
  const files = [];

  const runtimeRoot = path.join(ROOT, "templates/business-project/runtime");
  async function materializeRuntime(sourceDirectory, targetDirectory = targetRoot) {
    const entries = await fs.readdir(sourceDirectory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const source = path.join(sourceDirectory, entry.name);
      const target = path.join(targetDirectory, entry.name);
      if (entry.isDirectory()) {
        await fs.mkdir(target, { recursive: true });
        await materializeRuntime(source, target);
      } else {
        const content = Buffer.from(renderTemplate(await fs.readFile(source, "utf8"), values));
        const relativePath = path.relative(targetRoot, target).split(path.sep).join("/");
        const ownership = relativePath.startsWith("prototype/") ? "business" : "kit-managed";
        await writeManaged(targetRoot, relativePath, content, files, ownership);
      }
    }
  }
  await materializeRuntime(runtimeRoot);

  await copyMaterial(targetRoot, "shared/docs/business-baseline.md", "docs/business-baseline.md", files, "business");
  await copyMaterial(targetRoot, "shared/docs/review/review-confirmation.md", "docs/review/review-confirmation.md", files, "business");
  const baselinePath = path.join(targetRoot, "docs/business-baseline.md");
  let baseline = await fs.readFile(baselinePath, "utf8");
  baseline = baseline.replace("当前模式：待产品经理确认", `当前模式：${mode}`);
  baseline = renderBaselineProfile(baseline, validationProfile);
  if (mode === "continuous-iteration") {
    baseline = baseline.replace("当前形态：业务验证简报", "当前形态：持续迭代最小基线");
  }
  await fs.writeFile(baselinePath, baseline, "utf8");
  const baselineEntry = files.find((entry) => entry.path === "docs/business-baseline.md");
  baselineEntry.sha256 = createHash("sha256").update(baseline).digest("hex");

  if (mode === "rapid-validation" && (validationProfile.inputSufficiency.level === "partial" || validationProfile.reviewCenter.enabled)) {
    const blueprint = renderTemplate(
      await fs.readFile(path.join(ROOT, "templates/business-project/shared/docs/demo-blueprint.md"), "utf8"),
      values,
    );
    await writeManaged(targetRoot, "docs/demo-blueprint.md", Buffer.from(blueprint), files, "business");
  }

  if (mode === "continuous-iteration") {
    await copyMaterial(targetRoot, "continuous/docs/decisions/decisions.md", "docs/decisions/decisions.md", files, "business");
    await copyMaterial(targetRoot, "continuous/docs/requirements/README.md", "docs/requirements/README.md", files, "kit-managed");
    await copyMaterial(targetRoot, "continuous/docs/page-guides/README.md", "docs/page-guides/README.md", files, "kit-managed");
    const registry = `${JSON.stringify(makeEmptyRegistry(), null, 2)}\n`;
    await writeManaged(targetRoot, "docs/requirements/registry.json", Buffer.from(registry), files, "business");
    await writeManaged(targetRoot, "docs/requirements/requirements.md", Buffer.from(renderRequirements(JSON.parse(registry))), files, "generated-view");
  }

  const runtimeFiles = [
    ["scripts/project-lib.mjs", ".prototype-kit/project-lib.mjs"],
    ["scripts/workflow-v3-lib.mjs", ".prototype-kit/workflow-v3-lib.mjs"],
    ["scripts/contract-lib.mjs", ".prototype-kit/contract-lib.mjs"],
    ["scripts/page-guide-lib.mjs", ".prototype-kit/page-guide-lib.mjs"],
    ["scripts/rapid-validation-lib.mjs", ".prototype-kit/rapid-validation-lib.mjs"],
    ["scripts/business-runtime.mjs", ".prototype-kit/business-cli.mjs"],
  ];
  for (const [source, target] of runtimeFiles) {
    await writeManaged(targetRoot, target, await fs.readFile(path.join(ROOT, source)), files);
  }
  await writeManaged(targetRoot, "pnpm-lock.yaml", await fs.readFile(path.join(ROOT, "pnpm-lock.yaml")), files);

  const config = {
    schemaVersion: 2,
    instanceKind: "business-project",
    kitVersion: KIT_VERSION,
    projectName: name.trim(),
    packageName,
    prototypeFramework: "react-vite",
    packageManager: "pnpm",
    paths: {
      inbox: "inbox",
      requirements: "docs/requirements/registry.json",
      requirementsSummary: "docs/requirements/requirements.md",
      contracts: "prototype/src/contracts/contracts.json",
      pageGuides: "docs/page-guides/pages.md",
      demoBlueprint: "docs/demo-blueprint.md",
      reviewScenarios: "prototype/src/review-scenarios.json",
      releaseOutput: "dist/review",
    },
    validation: {
      allowedSurfaces: ["mobile", "admin", "web", "service"],
      implementationStatuses: ["implemented", "partial", "planned"],
    },
  };
  const status = {
    schemaVersion: 2,
    currentMode: mode,
    modeState: "confirmed",
    modeHistory: [{
      mode,
      recommendedBy: "ai",
      recommendationReason: recommendationReason.trim(),
      confirmedBy: confirmedBy.trim(),
      confirmedAt: timestamp,
      evidence: "创建业务项目时的明确授权",
    }],
    validationProfile,
    activeChangeRequest: null,
    nextGate: mode === "rapid-validation"
      ? (validationProfile.inputSufficiency.level === "partial" ? "demo-blueprint-confirmation" : "demo-implementation-or-review")
      : "change-request-authorization",
    updatedAt: timestamp,
  };
  await writeManaged(targetRoot, "project.config.json", Buffer.from(`${JSON.stringify(config, null, 2)}\n`), files);
  await writeManaged(targetRoot, "project-status.json", Buffer.from(`${JSON.stringify(status, null, 2)}\n`), files, "business");

  const manifest = {
    schemaVersion: 1,
    kitVersion: KIT_VERSION,
    createdAt: timestamp,
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
  };
  await fs.mkdir(path.join(targetRoot, ".prototype-kit"), { recursive: true });
  await fs.writeFile(path.join(targetRoot, ".prototype-kit/manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { targetRoot, mode, fileCount: files.length };
}

export async function addContinuousStructure(targetRoot) {
  const files = [];
  const copies = [
    ["continuous/docs/decisions/decisions.md", "docs/decisions/decisions.md", "business"],
    ["continuous/docs/requirements/README.md", "docs/requirements/README.md", "kit-managed"],
    ["continuous/docs/page-guides/README.md", "docs/page-guides/README.md", "kit-managed"],
  ];
  const allTargets = [
    ...copies.map(([, target]) => target),
    "docs/requirements/registry.json",
    "docs/requirements/requirements.md",
  ];
  for (const target of allTargets) {
    const absolute = path.join(targetRoot, target);
    try {
      await fs.access(absolute);
      throw new Error(`模式切换目标已存在，停止以避免覆盖：${target}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  for (const [source, target, ownership] of copies) {
    await copyMaterial(targetRoot, source, target, files, ownership);
  }
  const registry = makeEmptyRegistry();
  await writeManaged(targetRoot, "docs/requirements/registry.json", Buffer.from(`${JSON.stringify(registry, null, 2)}\n`), files, "business");
  await writeManaged(targetRoot, "docs/requirements/requirements.md", Buffer.from(renderRequirements(registry)), files, "generated-view");
  return files;
}
