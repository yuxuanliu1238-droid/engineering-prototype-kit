import { validateEvidencePolicy } from "./evidence-policy.mjs";
import assert from "node:assert/strict";
import {
  makeEmptyRegistry,
  makeReadiness,
  makeActivities,
  deriveStatusCard,
  validateRegistryData,
} from "./workflow-v3-lib.mjs";
import { renderReviewPackage } from "./review-package.mjs";
const risk = {
  recommendedLevel: "light",
  confirmedLevel: "light",
  triggers: [],
  rationale: "fixture",
  proposedBy: "ai",
  confirmedBy: "fixture",
  confirmedAt: "2026-09-08",
  downgradeReason: null,
  compensationMeasures: [],
};
const item = {
  id: "CR-001",
  summary: "fixture",
  originalRequest: "fixture",
  source: "fixture",
  proposedAt: "2026-09-08",
  currentStageId: "implementation",
  executionState: "locked",
  aiPolicy: "execution-allowed",
  executionScope: { objective: "fixture", included: [], excluded: [], deferred: [] },
  riskAssessment: risk,
  activities: makeActivities(risk),
  readinessChecklist: makeReadiness("met"),
  waitingReason: null,
  pauseReason: null,
  cancellationReason: null,
  artifacts: [],
  reviewConfirmation: null,
  pageIds: [],
  actionIds: [],
  stateIds: [],
  documents: [],
  evidence: [],
  openQuestions: ["REQUIRED_QUESTION"],
};
assert.notEqual(deriveStatusCard(item).verdict, "可以实施");
assert.match(deriveStatusCard({ ...item, executionState: "ready" }).verdict, /证据不足/);
assert.match(
  deriveStatusCard({ ...item, currentStageId: "completed", executionState: "completed" }).verdict,
  /未按新规则验证/,
);
assert.match(renderReviewPackage(item), /REQUIRED_QUESTION/);
for (const field of ["activities", "readinessChecklist"]) {
  const bad = { ...item, [field]: [null] };
  assert.doesNotThrow(() => validateRegistryData({ ...makeEmptyRegistry(), items: [bad] }));
  assert.ok(validateRegistryData({ ...makeEmptyRegistry(), items: [bad] }).length);
}
const skipped = { ...item, activities: item.activities.map((a) => ({ ...a, status: "已跳过" })) };
assert.ok(
  validateRegistryData({ ...makeEmptyRegistry(), items: [skipped] }).some((e) => /跳过/.test(e)),
);
assert.ok(
  validateRegistryData({ ...makeEmptyRegistry(), items: [item] }, { strict: true }).some((e) =>
    /证据|验收/.test(e),
  ),
);
console.log("门禁反例通过：锁定、问题展示、非法成员、跳过、强证据。");

const validEvidence = {
  ...item,
  executionState: "ready",
  acceptanceCriteria: [{ id: "AC-1", text: "visible result" }],
  evidence: [
    {
      id: "EV-1",
      location: "docs/approval.md",
      confirmationStatus: "confirmed",
      confirmedBy: "产品负责人",
      confirmedAt: "2026-09-08",
    },
  ],
  readinessChecklist: item.readinessChecklist.map((c) => ({ ...c, evidence: ["EV-1"] })),
};
assert.deepEqual(validateEvidencePolicy(validEvidence), []);
assert.match(deriveStatusCard(validEvidence).verdict, /实施条件已登记/);
assert.ok(
  validateEvidencePolicy({
    ...validEvidence,
    evidence: [{ ...validEvidence.evidence[0], confirmationStatus: "pending" }],
  }).length,
);
