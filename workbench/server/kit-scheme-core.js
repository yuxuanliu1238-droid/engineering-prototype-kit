import {makeActivities,EXPECTED_READINESS_CHECK_IDS,REQUIREMENT_TYPES,IMPACT_TAGS} from "../../scripts/workflow-v3-lib.mjs";
import {appendKitProgress} from "./kit-progress.js";
import {advanceKitLifecycle,ensureKitLifecycle} from "./kit-lifecycle.js";

export function confirmKitScheme(record,analysis,{requestId,answers=[],adoptAllRecommendations=false,confirmedBy="产品经理",time=new Date().toISOString(),
  replan=false,requirementType=record.requirementType,impactTags=record.impactTags}={}){
  const expansion=record.workbenchAdjustmentRequests?.at(-1)?.status==="scope-expansion";
  if(!(replan?record.currentStageId==="awaiting-review"&&expansion:record.currentStageId==="recorded"&&record.executionState==="locked")||!analysis||
    !Array.isArray(analysis.questions)||!Array.isArray(analysis.scope)||!analysis.scope.length||
    !Array.isArray(analysis.acceptance)||!analysis.acceptance.length||
    !analysis.risk||!["light","standard","high"].includes(analysis.risk.level))throw Error("SCHEME_NOT_READY");
  if(!REQUIREMENT_TYPES[requirementType]||!Array.isArray(impactTags)||impactTags.some(tag=>!IMPACT_TAGS[tag])||
    new Set(impactTags).size!==impactTags.length||
    (requirementType==="existing-page-adjustment"&&!impactTags.includes("frontend-page")))throw Error("INVALID_CLASSIFICATION");
  if(!Array.isArray(answers)||answers.some(item=>typeof item!=="string")||
    (!adoptAllRecommendations&&answers.length!==analysis.questions.length)||
    (adoptAllRecommendations&&answers.length>0))throw Error("ANSWERS_INCOMPLETE");
  const decisions=adoptAllRecommendations?analysis.questions.map(item=>item.recommendation):answers.map(item=>item.trim());
  if(decisions.some(item=>!item))throw Error("ANSWERS_INCOMPLETE");
  const risk={recommendedLevel:analysis.risk.level,confirmedLevel:analysis.risk.level,
    triggers:[...analysis.risk.triggers],rationale:analysis.risk.rationale,
    proposedBy:"ai",confirmedBy,confirmedAt:time,downgradeReason:null,compensationMeasures:[]};
  const version=replan?(record.workbenchScheme?.version||1)+1:1;
  const evidenceRef=`docs/requirements/registry.json#${record.id}.workbenchScheme.v${version}`;
  const readiness=new Map(["goal-clear","scope-clear","acceptance-testable","rules-confirmed","risk-reviewed"]
    .map(id=>[id,{status:"met",evidence:[evidenceRef]}]));
  const next=structuredClone(record);
  ensureKitLifecycle(next,time);
  if(replan){
    if(next.workbenchLifecycle.state==="awaiting-review")advanceKitLifecycle(next,"awaiting-plan",{time,actor:"AI",event:"扩大范围已重新分析，等待确认新方案"});
  }else if(next.workbenchLifecycle.state==="awaiting-analysis"){
    advanceKitLifecycle(next,"awaiting-plan",{time:analysis.endedAt||time,actor:"AI",event:"需求分析完成，等待确认业务方案"});
  }
  if(replan){
    next.workbenchRoundHistory=[...(next.workbenchRoundHistory||[]),{
      scheme:structuredClone(next.workbenchScheme),authorization:structuredClone(next.workbenchAuthorization),
      implementation:structuredClone(next.workbenchImplementation),closedAt:time,reason:"scope-expansion"}];
    next.workbenchAuthorization=null;next.workbenchImplementation=null;
    next.workbenchAdjustmentRequests.at(-1).status="replanned";
  }
  next.requirementType=requirementType;next.impactTags=[...impactTags];
  next.currentStageId="awaiting-authorization";next.executionState="waiting-human";next.aiPolicy="planning-only";
  next.riskAssessment=risk;next.activities=makeActivities(risk,next.requirementType,next.impactTags);
  next.executionScope={objective:analysis.summary,included:[...analysis.scope],excluded:[...analysis.excluded],
    deferred:["项目实施、修改和发布须另行授权"]};
  next.readinessChecklist=EXPECTED_READINESS_CHECK_IDS.map(id=>({id,...(readiness.get(id)||{status:"not-assessed",evidence:[]})}));
  next.waitingReason={code:"authorization-required",question:"是否授权按已确认方案实施本轮需求？",
    requestedFrom:confirmedBy,impact:"未经单独授权，不修改项目内容。",resumeWhen:"明确本轮实施范围并确认授权"};
  next.openQuestions=[];
  next.workbenchScheme={requestId,version,confirmedAt:time,confirmedBy,analysisId:analysis.id||null,
    summary:analysis.summary,scope:[...analysis.scope],excluded:[...analysis.excluded],acceptance:[...analysis.acceptance],
    targets:[...analysis.targets],
    decisions:analysis.questions.map((question,index)=>({question:question.question,choice:decisions[index],
      aiRecommendation:question.recommendation,impact:question.impact,adoptedAI:adoptAllRecommendations})),
    riskLevel:risk.confirmedLevel,implementationAuthorized:false};
  next.evidence.push({id:`EV-${record.id}-scheme-v${version}`,sourceType:"review",location:evidenceRef,
    originalClaim:"产品经理确认本轮业务方案，不包含实施授权。",aiInterpretation:analysis.summary,
    scope:"业务方案确认",confirmationStatus:"confirmed",occurredAt:time,confirmedBy,confirmedAt:time});
  next.artifacts.push({type:"decision",location:evidenceRef,supports:[analysis.acceptance[0]]});
  appendKitProgress(next,{id:`analysis:${analysis.id||requestId}`,at:analysis.endedAt||time,actor:"AI",
    action:replan?"重新分析扩大范围":"分析需求",result:analysis.summary,authorization:false,nextActor:"产品经理"});
  appendKitProgress(next,{id:`scheme:${requestId}`,at:time,actor:confirmedBy,
    action:replan?"确认新业务方案":"确认业务方案",result:`确认本轮范围与 ${analysis.acceptance.length} 项验收标准；未授权实施。`,
    authorization:false,nextActor:"产品经理"});
  advanceKitLifecycle(next,"awaiting-authorization",{time,actor:confirmedBy,event:"业务方案已确认；尚未授权实施"});
  return next;
}
