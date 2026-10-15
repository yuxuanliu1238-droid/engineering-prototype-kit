import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {acceptPrototypeRecord,acceptanceReview,requestAdjustment,startAdjustmentRecord} from "../server/acceptance-core.js";

const registry=JSON.parse(fs.readFileSync(new URL("../../../cx回收/docs/requirements/registry.json",import.meta.url),"utf8"));
const pageMap=JSON.parse(fs.readFileSync(new URL("../../../cx回收/docs/requirements/page-document-map.json",import.meta.url),"utf8"));
const workflow=await import(new URL("../../../cx回收/prototype/scripts/workflow-data.mjs",import.meta.url));
const source=registry.requirements.find(item=>item.id==="CR-029");
const job={status:"completed",authorization:{id:source.workbenchImplementationAuthorization.id}};
test("confirmed same-scope adjustment continues without a second authorization",()=>{
 const record=structuredClone(source);delete record.workbenchImplementationAdjustments;
 delete record.workbenchPrototypeAcceptance;
 const review=acceptanceReview(record,job);assert.equal(review.ready,true);
 const input={requestId:"12345678-1234-1234-1234-123456789abc",version:review.version,text:"按视觉稿调整",confirmAdjustmentOnly:true};
 const next=requestAdjustment(record,job,input,"2026-09-11T14:00:00.000Z");
 assert.equal(next.workbenchImplementationAdjustments[0].text,"按视觉稿调整");
 assert.equal(next.taskControl.aiPolicy,"planning-only");assert.equal(next.taskControl.executionState,"waiting-human");
 assert.equal(next.workbenchImplementationAuthorization.status,"changes-requested");
 assert.equal(acceptanceReview(next,job).ready,false);
 const started=startAdjustmentRecord(next,input.requestId,"adjustment-job","2026-09-11T14:01:00.000Z");
 assert.equal(started.workbenchImplementationAdjustments[0].status,"submitted");
 assert.equal(started.taskControl.aiPolicy,"execution-allowed");assert.equal(started.taskControl.executionState,"ready");
});
test("an awaiting-review result can receive another explicit adjustment",()=>{
 const record=structuredClone(source);
 delete record.workbenchPrototypeAcceptance;
 record.workbenchImplementationAdjustments=[{requestId:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",authorizationId:source.workbenchImplementationAuthorization.id,text:"第一轮调整",status:"awaiting-review"}];
 const review=acceptanceReview(record,job);assert.equal(review.ready,true);
 const next=requestAdjustment(record,job,{requestId:"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",version:review.version,text:"第二轮调整",confirmAdjustmentOnly:true},"2026-09-12T01:00:00.000Z");
 assert.equal(next.workbenchImplementationAdjustments.length,2);
 assert.equal(next.workbenchImplementationAdjustments[1].status,"awaiting-authorization");
});
test("missing confirmation, stale version and incomplete job fail closed",()=>{
 const record=structuredClone(source);delete record.workbenchImplementationAdjustments;
 delete record.workbenchPrototypeAcceptance;
 const base={requestId:"12345678-1234-1234-1234-123456789abc",version:acceptanceReview(record,job).version,text:"调整",confirmAdjustmentOnly:true};
 assert.throws(()=>requestAdjustment(record,job,{...base,confirmAdjustmentOnly:false}));
 assert.throws(()=>requestAdjustment(record,job,{...base,version:"stale"}));
 assert.throws(()=>requestAdjustment(record,{...job,status:"running"},base));
});
test("prototype acceptance explicitly completes only the prototype round",async()=>{
 const record=structuredClone(source);
 delete record.workbenchPrototypeAcceptance;
 record.workbenchImplementationAdjustments=[{requestId:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",authorizationId:source.workbenchImplementationAuthorization.id,text:"已完成调整",status:"awaiting-review"}];
 const review=acceptanceReview(record,job);assert.equal(review.ready,true);
 const accepted=acceptPrototypeRecord(record,job,{requestId:"cccccccc-cccc-cccc-cccc-cccccccccccc",version:review.version,confirmPrototypeAccepted:true},"2026-09-12T02:00:00.000Z");
 assert.equal(accepted.currentStageId,"synced");assert.equal(accepted.taskControl.executionState,"completed");
 assert.equal(accepted.workbenchImplementationAdjustments[0].status,"accepted");
 assert.equal(accepted.confirmedAt,"2026-09-12");
 assert.equal(accepted.artifacts.at(-1).type,"user-confirmation");
 assert.equal(accepted.evidence.at(-1).type,"note");
 assert.match(accepted.stageResults.synced.note,/未提交、未发布、未接入生产/);
 assert.equal(acceptanceReview(accepted,job).accepted,true);
 assert.equal(acceptanceReview(accepted,job).ready,false);
 const nextRegistry=structuredClone(registry);nextRegistry.requirements[nextRegistry.requirements.findIndex(item=>item.id==="CR-029")]=accepted;
 assert.deepEqual(await workflow.validateWorkflowData(nextRegistry,pageMap),{valid:true,errors:[],warnings:[]});
});
