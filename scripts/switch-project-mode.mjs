import { parseOptions } from "./cli-lib.mjs";
import os from "node:os";

import { safePath } from "./safe-path.mjs";
import { applyTransaction, restoreTransaction, previewGuard } from "./transaction-lib.mjs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { addContinuousStructure } from "./project-generator-lib.mjs";

function parseArgs(argv) {
  const result = parseOptions(argv, {
    values: ["project", "restore", "outcome", "confirmed-by", "evidence"],
    flags: ["apply", "continue-build"],
  });
  result.continueBuild = !!result["continue-build"];
  return { apply: false, ...result };
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

const args = parseArgs(process.argv.slice(2));
if (!args.project) throw new Error("缺少业务项目路径 --project");
const projectRoot = path.resolve(args.project);
if (args.restore === "latest") {
  await restoreTransaction(projectRoot, "mode-switch");
  process.exit(0);
}
const config = await readJson(safePath(projectRoot, "project.config.json"));
const statusPath = safePath(projectRoot, "project-status.json");
const manifestPath = safePath(projectRoot, ".prototype-kit/manifest.json");
const baselinePath = safePath(projectRoot, "docs/business-baseline.md");
const evidencePath = args.evidence ? safePath(projectRoot, args.evidence) : null;
const status = await readJson(statusPath);
const manifest = await readJson(manifestPath);
const preflight = await previewGuard(
  projectRoot,
  "mode-switch",
  [
    "project.config.json",
    "project-status.json",
    ".prototype-kit/manifest.json",
    "docs/business-baseline.md",
    ...(args.evidence ? [args.evidence] : []),
  ],
  args.apply,
);
const issues = [];
let baseline = "";

if (status.currentMode !== "rapid-validation") issues.push("当前项目不是快速验证模式");
if (!["approved", "conditional"].includes(args.outcome)) {
  issues.push("评审结论必须为 approved 或 conditional");
}
if (!args.continueBuild) issues.push("缺少继续建设结论 --continue-build");
if (!args["confirmed-by"]?.trim()) issues.push("缺少产品经理确认人 --confirmed-by");
try {
  baseline = await fs.readFile(baselinePath, "utf8");
  if (!baseline.includes("当前模式：rapid-validation")) {
    issues.push("业务基线没有明确记录当前快速验证模式");
  }
  const expectedReview =
    args.outcome === "conditional" ? "需求评审结论：有条件通过" : "需求评审结论：通过";
  if (!baseline.includes(expectedReview)) issues.push("业务基线中的评审结论与本次切换不一致");
  if (/正式范围：\s*未生效/.test(baseline)) issues.push("业务基线尚未形成继续建设的正式范围");
  const assumptionRows = baseline.split("\n").filter((line) => /^\|\s*ASM-[^|]+\|/.test(line));
  for (const row of assumptionRows) {
    const cells = row
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean);
    const statusCell = cells.at(-1);
    if (!["已确认", "已否定", "仍待确认"].includes(statusCell)) {
      issues.push(`临时假设尚未转换为评审后状态：${cells[0] || row}`);
    }
  }
} catch {
  issues.push("缺少可读取的 docs/business-baseline.md");
}
if (!evidencePath) issues.push("缺少评审确认证据 --evidence");
else if (evidencePath !== projectRoot && !evidencePath.startsWith(`${projectRoot}${path.sep}`)) {
  issues.push("评审确认证据必须位于目标业务项目内");
} else {
  try {
    const evidence = await fs.readFile(evidencePath, "utf8");
    const unresolvedMarkers = [
      "当前状态：尚未评审",
      "评审结论：待确认",
      "产品确认人：待确认",
      "是否明确继续建设：待确认",
      "产品经理确认模式：待确认",
      "模式切换结论：未生效",
    ];
    if (unresolvedMarkers.some((marker) => evidence.includes(marker))) {
      issues.push("评审确认单仍包含未生效的关键占位内容");
    }
    const expectedOutcome =
      args.outcome === "conditional" ? "评审结论：有条件通过" : "评审结论：通过";
    if (!evidence.includes(expectedOutcome)) issues.push("命令中的评审结论与评审确认单不一致");
    if (!evidence.includes("是否明确继续建设：是")) issues.push("评审确认单没有明确继续建设");
    if (!evidence.includes("产品经理确认模式：continuous-iteration")) {
      issues.push("评审确认单没有确认切换为 continuous-iteration");
    }
    if (!evidence.includes("模式切换结论：生效")) issues.push("评审确认单的模式切换结论尚未生效");
    if (!evidence.includes(args["confirmed-by"] || "__missing__")) {
      issues.push("评审确认单未记录本次产品经理确认人");
    }
  } catch {
    issues.push(`评审确认证据不存在：${args.evidence}`);
  }
}

const reportDirectory = safePath(projectRoot, "dist/mode-switch");
await fs.mkdir(reportDirectory, { recursive: true });
const reportPath = path.join(reportDirectory, "rapid-to-continuous-impact-report.md");
const lines = [
  "# 模式切换影响报告",
  "",
  `- 当前模式：${status.currentMode}`,
  "- 目标模式：continuous-iteration",
  `- 评审结论：${args.outcome || "未提供"}`,
  `- 继续建设：${args.continueBuild ? "是" : "否"}`,
  `- 产品经理确认：${args["confirmed-by"] || "未提供"}`,
  `- 评审证据：${args.evidence || "未提供"}`,
  "",
  "## 将初始化的结构",
  "",
  "- 决策台账入口；",
  "- Schema v3 空 CR 台账及可读视图；",
  "- 页面说明生成视图入口。",
  "",
  "不会自动创建领域模型、页面契约或 B 端专项模块，也不会把临时假设升级为正式规则。",
];
if (issues.length) lines.push("", "## 阻断项", "", ...issues.map((issue) => `- ${issue}`));
await fs.writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");
console.log(`已生成影响报告：${reportPath}`);

if (!args.apply) {
  console.log("当前仅预览；明确授权后增加 --apply 才会切换模式。");
  process.exit(issues.length ? 1 : 0);
}
if (issues.length) throw new Error(`模式切换被阻断：${issues[0]}`);

const timestamp = new Date().toISOString();
const staging = await fs.mkdtemp(path.join(os.tmpdir(), "kit-switch-"));
let added;
const writes = new Map();
try {
  added = await addContinuousStructure(staging, { paths: config.paths });
  for (const entry of added) {
    writes.set(entry.path, await fs.readFile(safePath(staging, entry.path)));
    preflight[entry.path] = null;
  }
} finally {
  await fs.rm(staging, { recursive: true, force: true });
}
const evidenceRelativePath = path.relative(projectRoot, evidencePath).split(path.sep).join("/");
const updatedBaseline = baseline
  .replace("当前形态：业务验证简报", "当前形态：正式业务基线")
  .replace("当前模式：rapid-validation", "当前模式：continuous-iteration")
  .replace(/生效评审：.*$/m, `生效评审：${evidenceRelativePath}`)
  .replace(
    /最后确认：.*$/m,
    `最后确认：${args["confirmed-by"].trim()} / ${timestamp.slice(0, 10)}`,
  );
writes.set("docs/business-baseline.md", Buffer.from(updatedBaseline));
status.currentMode = "continuous-iteration";
status.modeState = "confirmed";
status.modeHistory.push({
  mode: "continuous-iteration",
  recommendedBy: "ai",
  recommendationReason: "需求评审通过或有条件通过，并已明确继续建设",
  confirmedBy: args["confirmed-by"].trim(),
  confirmedAt: timestamp,
  evidence: evidenceRelativePath,
  reviewOutcome: args.outcome,
  continueBuild: true,
});
status.nextGate = "change-request-authorization";
status.updatedAt = timestamp;
writes.set("project-status.json", Buffer.from(JSON.stringify(status, null, 2) + "\n"));

const byPath = new Map((manifest.files || []).map((entry) => [entry.path, entry]));
for (const entry of added) byPath.set(entry.path, entry);
const baselineEntry = byPath.get("docs/business-baseline.md");
if (baselineEntry) {
  const { createHash } = await import("node:crypto");
  baselineEntry.sha256 = createHash("sha256").update(updatedBaseline).digest("hex");
  byPath.set(baselineEntry.path, baselineEntry);
}
manifest.files = [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
writes.set(".prototype-kit/manifest.json", Buffer.from(JSON.stringify(manifest, null, 2) + "\n"));
await applyTransaction(projectRoot, "mode-switch", writes, { expected: preflight });
console.log("模式已切换为 continuous-iteration；未启用任何按需模块。");
