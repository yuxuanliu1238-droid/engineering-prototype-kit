import assert from "node:assert/strict";
import { promises as fs } from "node:fs";

const matrixExpectations = [
  {
    file: "skills/business-discovery/references/discovery-checklist.md",
    tokens: ["confirmed-record", "meeting-notes", "raw-transcript", "screenshot-or-prototype", "interface-note-or-log"],
  },
  {
    file: "skills/decision-and-domain/references/decision-state-checklist.md",
    tokens: ["source-state", "display-state", "external-evidence", "responsibility-owner", "immutable-rule"],
  },
  {
    file: "skills/page-contract-and-spec/references/contract-spec-format.md",
    tokens: ["page", "action", "state"],
  },
  {
    file: "skills/change-and-delivery-governance/references/change-delivery-workflow.md",
    tokens: ["record-only", "read-only-analysis", "prototype-only", "full-sync", "read-only-review", "formal-delivery"],
  },
  {
    file: "skills/requirement-quality-review/references/audit-format.md",
    tokens: ["stale-fingerprint", "incomplete-covered-files", "failed-or-not-run-report", "retired-id-active-residue", "retired-id-history-trace"],
  },
];

function tableTokens(markdown) {
  return [...markdown.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]);
}

for (const expectation of matrixExpectations) {
  const markdown = await fs.readFile(new URL(`../${expectation.file}`, import.meta.url), "utf8");
  const actual = new Set(tableTokens(markdown));
  for (const token of expectation.tokens) {
    assert.equal(actual.has(token), true, `${expectation.file} 缺少矩阵类别：${token}`);
  }
}

const governance = await fs.readFile(new URL("../skills/change-and-delivery-governance/SKILL.md", import.meta.url), "utf8");
assert.equal(governance.includes("$scenario-evidence-capture"), true);
assert.equal(governance.includes("$prototype-change-retrospective"), true);

const combined = (await Promise.all(matrixExpectations.map(({ file }) => (
  fs.readFile(new URL(`../${file}`, import.meta.url), "utf8")
)))).join("\n");
for (const forbidden of ["固定业务状态", "特定角色端", "固定领域规则", "项目专属文案", "固定接口地址"]) {
  assert.equal(combined.includes(forbidden), false, `通用 Skill 参考材料不得包含项目专属内容：${forbidden}`);
}

console.log("五个现有 Skill 增强测试通过：来源、状态证据责任、ID 退役、授权范围和新鲜度残留矩阵完整。");
