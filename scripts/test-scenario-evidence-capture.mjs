import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ROOT } from "./project-lib.mjs";
import { validateEvidencePlan } from "../skills/scenario-evidence-capture/scripts/validate-evidence-plan.mjs";

const fixturePath = new URL("../examples/scenario-evidence-isolated.json", import.meta.url);
const isolated = JSON.parse(await fs.readFile(fixturePath, "utf8"));

assert.deepEqual(validateEvidencePlan(isolated), []);

const falseSufficient = structuredClone(isolated);
falseSufficient.sufficiency.status = "sufficient";
assert.equal(
  validateEvidencePlan(falseSufficient).some((error) => error.includes("充分时")),
  true,
  "结构校验必须拒绝缺少必需场景却声称充分的计划",
);

const conflictingCoverage = structuredClone(isolated);
conflictingCoverage.sufficiency.coveredScenarioIds.push("profile-discard-cancel");
assert.equal(
  validateEvidencePlan(conflictingCoverage).some((error) => error.includes("同时标记已覆盖和缺失")),
  true,
  "同一场景不得同时标记已覆盖和缺失",
);

const skill = await fs.readFile(new URL("../skills/scenario-evidence-capture/SKILL.md", import.meta.url), "utf8");
for (const forbidden of ["固定业务状态", "特定角色端", "固定接口", "项目专属文案"]) {
  assert.equal(skill.includes(forbidden), false, `Skill 不得包含项目专属内容：${forbidden}`);
}
assert.equal(skill.includes("脚本不替代风险判断"), true);
assert.equal(path.isAbsolute(ROOT), true);

console.log("scenario-evidence-capture 隔离样本测试通过：风险场景结构有效，并能拒绝虚假的充分性结论。");
