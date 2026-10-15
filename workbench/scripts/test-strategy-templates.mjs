import assert from "node:assert/strict";
import {REQUIREMENT_TYPES,IMPACT_TAGS,buildRequirementTemplateSnapshot} from "../../scripts/workflow/model.mjs";
import {makeRecordedRequirement} from "../../scripts/workflow/policy.mjs";
import {requirementTemplates,commonLifecycleStages} from "../src/requirement-templates.js";

assert.deepEqual(requirementTemplates.map(template=>template.id).sort(),Object.keys(REQUIREMENT_TYPES).sort());
assert.equal(commonLifecycleStages.length,6);
for(const template of requirementTemplates){
  assert.equal(template.name,REQUIREMENT_TYPES[template.id].label);
  assert.deepEqual(template.stages,commonLifecycleStages);
  assert(template.defaultImpactTags.every(tag=>IMPACT_TAGS[tag]));
  assert(template.questionPolicy.ask.length>0);
  assert(template.defaultAcceptance.length>0);
  assert(template.executionStrategy.analyze.length>0);
  assert(template.executionStrategy.outputs.length>0);
}
for(const type of ["business-rule-validation","state-data-definition","interface-integration","document-workflow-governance"]){
  const template=requirementTemplates.find(item=>item.id===type);
  assert.equal(template.deliveryMode,"strategy-artifact");
  assert(!template.requiredStages.includes("prototype-update"));
}
const snapshot=buildRequirementTemplateSnapshot("business-rule-validation",["backend-logic","external-interface","requirement-document"]);
assert.equal(snapshot.version,1);assert.equal(snapshot.requirementType,"business-rule-validation");
assert.equal(snapshot.deliveryMode,"strategy-artifact");
assert.deepEqual(snapshot.impactBranches.map(item=>item.id),["backend-logic","external-interface","requirement-document"]);
assert(snapshot.outputs.includes("判断表"));assert(snapshot.outputs.includes("接口字段与兼容影响说明"));
assert(snapshot.authorization.requiresSeparateConfirmation);assert(snapshot.splitRule.includes("独立实施"));
const recorded=makeRecordedRequirement({id:"CR-901",description:"调整黑名单判断并同步外部接口",requirementType:"business-rule-validation",
  impactTags:["backend-logic","external-interface","requirement-document"],requestId:"test-template"});
assert.deepEqual(recorded.workbenchTemplate,snapshot,"registration must freeze the selected template and branches");
assert.equal(buildRequirementTemplateSnapshot("existing-page-adjustment",["frontend-page"]).deliveryMode,"prototype");
console.log("PASS: six workbench templates match the project-neutral Kit catalog");
