import { promises as fs } from "node:fs";
import path from "node:path";
import { printResult, ROOT } from "./project-lib.mjs";
import { makeEmptyRegistry, validateRegistryData } from "./workflow-v3-lib.mjs";

const errors = [];
const exampleRoot = path.join(ROOT, "examples/parcel-return-demo");
const required = [
  "README.md",
  "index.html",
  "styles.css",
  "app.js",
  "decisions.md",
  "contracts.json",
  "requirements.json",
];

for (const file of required) {
  try {
    await fs.access(path.join(exampleRoot, file));
  } catch {
    errors.push(`教学示例缺少 ${file}`);
  }
}

const contracts = JSON.parse(
  await fs.readFile(path.join(exampleRoot, "contracts.json"), "utf8"),
);
if (contracts.length !== 3) errors.push("教学示例必须包含三个页面契约");
const pageIds = new Set(contracts.map((contract) => contract.pageId));
if (pageIds.size !== contracts.length) errors.push("教学示例 Page ID 必须唯一");
const actionIds = contracts.flatMap((contract) =>
  contract.actions.map((action) => action.id),
);
if (new Set(actionIds).size !== actionIds.length) errors.push("教学示例 Action ID 必须唯一");

const requirement = JSON.parse(
  await fs.readFile(path.join(exampleRoot, "requirements.json"), "utf8"),
);
if (requirement.currentStageId !== "recorded") {
  errors.push("教学示例 CR 必须保持已记录阶段");
}
if (requirement.executionState !== "locked" || requirement.aiPolicy !== "unassessed") {
  errors.push("教学示例 CR 登记后必须保持 locked + unassessed");
}
if (requirement.waitingReason !== null || requirement.artifacts.length || requirement.activities.length) {
  errors.push("教学示例 CR 未启动时不得预填人工介入或产物");
}
if (requirement.riskAssessment !== null) {
  errors.push("教学示例 CR 未经产品经理确认前不得预填风险等级");
}
if (
  requirement.readinessChecklist.length !== 7 ||
  requirement.readinessChecklist.some((check) => check.status !== "not-assessed")
) {
  errors.push("教学示例 CR 就绪检查必须从未评估开始");
}
errors.push(...validateRegistryData({ ...makeEmptyRegistry(), items: [requirement] }));
if (
  [...requirement.pageIds, ...requirement.actionIds, ...requirement.stateIds].length
) {
  errors.push("教学示例 CR 未影响分析前不得填写影响 ID");
}

const decisions = await fs.readFile(path.join(exampleRoot, "decisions.md"), "utf8");
if (!/只属于本示例/.test(decisions)) errors.push("示例决策缺少隔离声明");

printResult(
  "教学示例校验",
  errors,
  "2 个角色、3 个页面、2 条决策、1 条 Schema v3 已记录且未授权 CR",
);
