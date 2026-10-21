import { safePath } from "./safe-path.mjs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, readJson } from "./project-lib.mjs";
import { parseOptions } from "./cli-lib.mjs";
import { evaluateCheckReport } from "./check-runner.mjs";

const missingReport = () => ({
  valid: false,
  status: "missing",
  freshness: "unknown",
  reason: "未提供 check:scope 实际检查报告",
});

const reportStatusLabel = {
  valid: "当前有效",
  missing: "缺失",
  stale: "过期",
  failed: "失败",
  incomplete: "覆盖不足",
  unsupported: "格式不支持",
  invalid: "内容无效",
};

function list(values, empty = "无") {
  return values?.length ? values.map((value) => `- ${value}`).join("\n") : `- ${empty}`;
}

function readinessLines(checks = []) {
  return checks.length
    ? checks
        .map(
          (check) =>
            `- \`${check.id}\`：${check.status}${check.evidence?.length ? `（证据：${check.evidence.join("、")}）` : ""}`,
        )
        .join("\n")
    : "- 未提供";
}

function artifactLines(artifacts = []) {
  return artifacts.length
    ? artifacts
        .map(
          (artifact) =>
            `- \`${artifact.type}\`：${artifact.location}（支撑：${artifact.supports.join("、")}）`,
        )
        .join("\n")
    : "- 无";
}

function sourceLink(location, outputPath = "review.md") {
  const label = String(location).replace(/[\\`*_[\]<>]/g, "\\$&");
  if (/^[a-z][a-z0-9+.-]*:/i.test(location) && !/^https?:\/\//i.test(location))
    return `\`${label}\``;
  const [file, ...fragment] = location.split("#");
  const target = /^https?:\/\//i.test(location)
    ? location
    : `${path.posix.relative(path.posix.dirname(outputPath), file)}${fragment.length ? `#${fragment.join("#")}` : ""}`;
  return `[${label}](${encodeURI(target).replace(/[()]/g, (c) => c === "(" ? "%28" : "%29")})`;
}

function isExecutionRun(run) {
  return run && typeof run.command === "string" && Array.isArray(run.args) &&
    run.args.every((arg) => typeof arg === "string") && Number.isInteger(run.exitCode) &&
    typeof run.timedOut === "boolean";
}

function evidenceCardLines(item, options, report) {
  const artifacts = item.artifacts || [];
  const decisions = artifacts.filter((a) => a.type === "decision");
  const link = (location) => sourceLink(location, options.outputPath);
  const sourceStatus = (location) => {
    if (!report.valid) return "当前报告不能核验，待核对";
    if (/^[a-z][a-z0-9+.-]*:/i.test(location)) return "外部引用待核验";
    return report.coveredFiles?.some((file) => file.path === location.split("#")[0])
      ? "文件纳入当前检查覆盖，业务含义仍需核对"
      : "未在当前报告覆盖，待核对";
  };
  const claims = (item.acceptanceCriteria || []).map((criterion) => {
    if (!criterion || typeof criterion.id !== "string" || typeof criterion.text !== "string")
      return `- 历史验收未结构化，未按新规则验证：${typeof criterion === "string" ? criterion : JSON.stringify(criterion)}`;
    const supporting = artifacts.filter((a) => a.supports.includes(criterion.id));
    return `- **${criterion.id}：${criterion.text}**\n${supporting.length
      ? supporting.map((a) => `  - 登记产物 \`${a.type}\`：${link(a.location)}；${sourceStatus(a.location)}`).join("\n")
      : "  - 未登记支撑产物，待补证据"}`;
  });
  const decisionLines = decisions.map((decision) => {
    const records = (item.evidence || []).filter((entry) => entry.location === decision.location);
    return [
      `- 决策来源：${link(decision.location)}（支撑：${decision.supports.join("、")}；${sourceStatus(decision.location)}）`,
      ...(records.length ? records.flatMap((entry) => [
        `  - 原始记录（采用方案、原因及偏离）：${entry.originalClaim || "未记录，待核对"}`,
        `  - AI 解读（不能替代验证）：${entry.aiInterpretation || "未记录"}`,
        `  - 确认记录：${entry.confirmationStatus || "未记录"}；${entry.confirmedBy || "确认方待核对"}；${entry.confirmedAt || "时间待核对"}`,
      ]) : ["  - 只有决策引用；采用方案、偏离原因及确认依据未展开，待核对"]),
    ].join("\n");
  });
  return [
    "## 交付证据卡",
    "",
    `- 需求编号：\`${item.id}\``,
    "- 以下为登记的改动、决策与证据引用；须对照实际差异和源记录。AI 自述、产物登记及文件覆盖均不能单独证明验收通过。",
    `- 当前检查报告：${report.reportPath ? link(report.reportPath) : "未提供"}（${reportStatusLabel[report.status] || "无效"}）`,
    `- 执行时间：${report.executedAt || "未记录"}`,
    ...(report.valid && Array.isArray(report.runs) ? report.runs.filter(isExecutionRun) : []).map((run) => `- 检查命令：\`${[run.command, ...run.args].join(" ")}\`；退出码：${run.exitCode}；超时：${run.timedOut ? "是" : "否"}`),
    "",
    "### 验收与登记的实际改动",
    "",
    ...(claims.length ? claims : ["- 未登记结构化验收项，不能建立验收与产物的对应关系"]),
    "",
    "### 关键自主决策与方案偏离",
    "",
    ...(decisionLines.length ? decisionLines : ["- 未登记决策或偏离记录，待核对；不能据此认定没有偏离"]),
    "",
  ];
}

export function renderReviewPackage(item, options = {}) {
  const checkReport = options.checkReportEvaluation || missingReport();
  const reportLabel = reportStatusLabel[checkReport.status] || "无效";
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
    `- 检查报告状态：${reportLabel}（${checkReport.reason}）`,
    `- 自动完成判断：${checkReport.valid ? "检查证据可供评审，仍需产品确认" : "检查证据不能支持当前就绪或完成结论"}`,
    `- 未验证事项：${(checkReport.limitations || ["产品业务结论与人工最终评审"]).join("；")}`,
    "",
    ...evidenceCardLines(item, options, checkReport),
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
    list(item.openQuestions ?? item.pendingQuestions),
    "",
  ];
  return lines.join("\n");
}

export async function evaluateReviewReport(reportPath, { root = ROOT, target } = {}) {
  if (!reportPath) return missingReport();
  try {
    const report = JSON.parse(await fs.readFile(safePath(root, reportPath), "utf8"));
    if (report?.schemaVersion === 2 && report.origin === "process-exit" &&
        Array.isArray(report.runs) && report.runs.some((run) => !isExecutionRun(run)))
      return { valid: false, status: "invalid", freshness: "unknown", reportPath, reason: "检查命令记录结构无效" };
    const evaluation = await evaluateCheckReport(report, { root });
    if (evaluation.valid && target && ![target, "full"].includes(report.target)) {
      return { valid: false, status: "incomplete", freshness: evaluation.freshness, reportPath, reason: "检查报告未覆盖当前需求" };
    }
    return {
      ...evaluation,
      reportPath,
      executedAt: evaluation.valid ? report.executedAt : undefined,
      runs: evaluation.valid ? report.runs : [],
      coveredFiles: evaluation.valid ? report.coveredFiles : [],
      limitations: Array.isArray(report?.limitations) ? report.limitations : ["产品业务结论与人工最终评审", "在线文档最新修订核对"],
    };
  } catch (error) {
    if (error.code === "ENOENT")
      return {
        valid: false,
        status: "missing",
        freshness: "unknown",
        reportPath,
        reason: `检查报告不存在：${reportPath}`,
      };
    if (error instanceof SyntaxError)
      return {
        valid: false,
        status: "invalid",
        freshness: "unknown",
        reportPath,
        reason: `检查报告不是有效 JSON：${reportPath}`,
      };
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseOptions(process.argv.slice(2), { values: ["cr", "output", "report"] });
  if (!args.cr || !args.output) throw new Error("必须提供 --cr 和 --output");
  const config = await readJson("project.config.json");
  const registry = await readJson(config.paths.requirements);
  const item = registry.items.find((candidate) => candidate.id === args.cr);
  if (!item) throw new Error(`未找到需求：${args.cr}`);
  const checkReportEvaluation = await evaluateReviewReport(args.report, { target: args.cr });
  const outputPath = safePath(ROOT, args.output);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, renderReviewPackage(item, { checkReportEvaluation, outputPath: args.output }), "utf8");
  console.log(`评审包已生成：${path.relative(ROOT, outputPath)}`);
}
