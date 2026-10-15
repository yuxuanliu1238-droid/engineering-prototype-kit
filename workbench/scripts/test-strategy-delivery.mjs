import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {makeRequirementRecord} from "../server/requirement-create.js";
import {getRequirementTemplate} from "../src/requirement-templates.js";
import {implementationTargets} from "../server/implementation-core.js";
import {completeStrategyArtifactRecord} from "../server/strategy-artifact-core.js";
import {strategyAcceptanceReview,acceptStrategyArtifactRecord} from "../server/strategy-acceptance-core.js";
import {transitionLifecycle} from "../src/requirement-lifecycle.js";

for(const type of ["business-rule-validation","state-data-definition","interface-integration","document-workflow-governance"]){
  let record=makeRequirementRecord({id:"CR-900",description:"隔离验证需求类型",materials:"",requestId:randomUUID(),template:getRequirementTemplate(type)});
  record.workbenchAnalysis={result:{targets:["prototype/src/courier/HomePage.jsx","docs/review/existing.md","../outside.md"]}};
  const targets=implementationTargets(record);
  assert(targets.includes(`docs/review/CR-900-${type}-delivery.md`));
  assert(!targets.some(target=>target.startsWith("prototype/")||target.includes("..")));
  record.stageResults["waiting-start"].status="completed";
  for(const state of ["awaiting-plan","awaiting-authorization","executing"])record=transitionLifecycle(record,state);
  const authorizationId=randomUUID();record.workbenchImplementationAuthorization={id:authorizationId,status:"authorized"};
  record=completeStrategyArtifactRecord(record,{jobId:randomUUID(),changedFiles:[targets.at(-1)],checks:["结构核对通过"]});
  record=transitionLifecycle(record,"awaiting-review");
  const job={status:"completed",authorization:{id:authorizationId}},review=strategyAcceptanceReview(record,job);
  assert(review.ready);
  record=acceptStrategyArtifactRecord(record,job,{confirmStrategyAccepted:true,requestId:randomUUID(),version:review.version});
  assert.equal(record.workbenchLifecycle.state,"completed");
  assert.equal(record.currentStageId,"synced");
  assert.equal(record.taskControl.executionState,"completed");
}
console.log("PASS: four non-prototype routes use exact doc targets and separate review acceptance");
