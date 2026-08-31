import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, readJson } from "./project-lib.mjs";

function list(values, empty = "无") {
  return values?.length ? values.map((value) => `- ${value}`).join("\n") : `- ${empty}`;
}

function readinessLines(checks = []) {
  return checks.length
    ? checks.map((check) => `- \`${check.id}\`：${check.status}${check.evidence?.length ? `（证据：${check.evidence.join("、")}）` : ""}`).join("\n")
    : "- 未提供";
}

function artifactLines(artifacts = []) {
  return artifacts.length
    ? artifacts.map((artifact) => `- \`${artifact.type}\`：${artifact.location}（支撑：${artifact.supports.join("、")}）`).join("\n")
    : "- 无";
}

export function renderReviewPackage(item, options = {}) {
  const freshness = options.freshness || { status: "unknown", reason: "未提供检查报告" };
  const waiting = item.waitingReason
    ? `- 当前问题：${item.waitingReason.question}\n- 确认方：${item.waitingReason.requestedFrom}\n- 影响：${item.waitingReason.impact}\n- 恢复条件：${item.waitingReason.resumeWhen}`
    : "- 当前无人工卡点";
  const lines = [
    `# ${item.id} 评审包`,
    "",
    "> 本文件由结构化台账确定性生成，只汇总证据，不成为新的业务事实源。",
    "",
    "## 当前状态",
    "",
    `- 摘要：${item.summary}`,
    `- 流程节点：${item.currentStageId}`,
    `- 执行状态：${item.executionState}`,
    `- AI 策略：${item.aiPolicy}`,
    `- 证据新鲜度：${freshness.status}（${freshness.reason}）`,
    "",
    "## 本轮范围",
    "",
    `### 页面\n\n${list(item.pageIds)}`,
    "",
    `### 动作\n\n${list(item.actionIds)}`,
    "",
    `### 状态\n\n${list(item.stateIds)}`,
    "",
    "## 就绪检查",
    "",
    readinessLines(item.readinessChecklist),
    "",
    "## 当前唯一卡点",
    "",
    waiting,
    "",
    "## 类型化证据",
    "",
    artifactLines(item.artifacts),
    "",
    "## 待确认项",
    "",
    list(item.pendingQuestions),
    "",
  ];
  return lines.join("\n");
}

function parseArgs(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!["--cr", "--output"].includes(key)) throw new Error(`未知参数：${key}`);
    values[key.slice(2)] = args[index + 1];
  }
  return values;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.cr || !args.output) throw new Error("必须提供 --cr 和 --output");
  const config = await readJson("project.config.json");
  const registry = await readJson(config.paths.requirements);
  const item = registry.items.find((candidate) => candidate.id === args.cr);
  if (!item) throw new Error(`未找到需求：${args.cr}`);
  const outputPath = path.resolve(ROOT, args.output);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, renderReviewPackage(item), "utf8");
  console.log(`评审包已生成：${path.relative(ROOT, outputPath)}`);
}
