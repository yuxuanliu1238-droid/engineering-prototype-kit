import assert from "node:assert/strict";
import {
  collectRequirementReferences,
  selectRelatedChangedFiles,
} from "../skills/prototype-change-retrospective/scripts/collect-scope.mjs";

const selectedRequirement = {
  id: "CR-900",
  documents: ["docs/review/CR-900.md"],
  artifacts: [
    {
      location: "skills/prototype-change-retrospective/SKILL.md",
      sourceRefs: [{ location: "docs/requirements/registry.json" }],
    },
  ],
  evidence: [
    { reference: "registry:CR-900.evidence.authorization" },
    { reference: "docs/review/check-reports/CR-900.json" },
    { reference: "检查通过但评审/交付仍须分离。" },
  ],
  taskControl: {
    readinessChecklist: [
      { evidence: ["docs/review/CR-900.md", "用户明确授权"] },
    ],
  },
};

const references = collectRequirementReferences(selectedRequirement);
assert.deepEqual(references, [
  "docs/requirements/registry.json",
  "docs/review/CR-900.md",
  "docs/review/check-reports/CR-900.json",
  "skills/prototype-change-retrospective/SKILL.md",
]);

const related = selectRelatedChangedFiles(references, [
  "docs/review/CR-901.md",
  "skills/prototype-change-retrospective/SKILL.md",
  "docs/requirements/registry.json",
  "skills/prototype-change-retrospective/SKILL.md",
]);
assert.deepEqual(related, [
  "docs/requirements/registry.json",
  "skills/prototype-change-retrospective/SKILL.md",
]);

console.log("prototype-change-retrospective 范围测试通过：只保留指定 CR 的引用和相关差异，不读取无关 CR 正文。");
