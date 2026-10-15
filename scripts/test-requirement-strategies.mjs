import assert from "node:assert/strict";
import { buildActivityIds, makeActivities } from "./workflow/policy.mjs";
import { makeEmptyRegistry } from "./workflow/policy.mjs";
import { validateRegistryData } from "./workflow/validate.mjs";
import { REQUIREMENT_TYPES, IMPACT_TAGS, recommendMainType, shouldSuggestSplit,validateAITypeRecommendation } from "./workflow/model.mjs";

const risk = { confirmedLevel: "standard", triggers: [] };
assert.equal(Object.keys(REQUIREMENT_TYPES).length, 6);
assert.equal(Object.keys(IMPACT_TAGS).length, 5);
assert.deepEqual(makeEmptyRegistry().stageDefinitions.map(stage=>stage.id),[
  "recorded","analysis-confirmation","awaiting-authorization","implementation","awaiting-review","completed",
]);
assert.deepEqual(validateRegistryData(makeEmptyRegistry()),[]);
assert.deepEqual(validateRegistryData(makeEmptyRegistry({legacyStages:true})),[]);

for (const type of Object.keys(REQUIREMENT_TYPES)) {
  const ids = buildActivityIds(risk, type);
  assert(ids.includes("implementation"));
  assert(ids.includes("product-review"));
  assert(!ids.includes("interactive-prototype"), `${type} 不得仅凭主类型强制原型`);
  assert.deepEqual(makeActivities(risk, type).map(item => item.id), ids);
}

const mixed = buildActivityIds(risk, "business-rule-validation", ["frontend-page", "external-interface"]);
for (const id of ["business-rule-check", "page-contract", "interactive-prototype", "integration-check"]) {
  assert(mixed.includes(id));
}
assert.deepEqual(buildActivityIds(risk), [
  "impact-analysis", "rule-confirmation", "page-contract", "interactive-prototype",
  "consistency-check", "product-review",
]);
assert.deepEqual(recommendMainType([
  {type:"existing-page-adjustment",essential:true,reason:"已有状态只重新分组展示"},
  {type:"state-data-definition",essential:false,reason:"状态本身不变"},
]), {type:"existing-page-adjustment",reason:"已有状态只重新分组展示",alternatives:[]});
assert.equal(recommendMainType([{type:"state-data-definition",essential:true}]), null);
assert.equal(shouldSuggestSplit([{independentlyImplemented:true,independentlyRolledBack:true,independentlyAccepted:true},
  {independentlyImplemented:true,independentlyRolledBack:true,independentlyAccepted:false}]), false);
assert.equal(validateAITypeRecommendation({causes:[{type:"existing-page-adjustment",essential:true,reason:"现有状态只改变展示分组"}],
  impactTags:["frontend-page"],parts:[]}).mainType,"existing-page-adjustment");
assert.throws(()=>validateAITypeRecommendation({causes:[{type:"existing-page-adjustment",essential:true,reason:"现有状态只改变展示分组"}],
  impactTags:["state-data"],parts:[]}),/INVALID_TYPE_RECOMMENDATION/);
console.log("PASS: six project-neutral strategies, five impact branches, legacy compatibility");
