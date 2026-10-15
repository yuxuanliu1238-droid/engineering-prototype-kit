import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {fileURLToPath} from "node:url";
import {getRequirementTemplate} from "../src/requirement-templates.js";
import {makeRequirementRecord} from "../server/requirement-create.js";
import {canStart,validateResult} from "../server/analysis-core.js";
import {questionReview} from "../server/question-answers.js";
import {businessReview,saveBusinessDecisions} from "../server/business-decisions.js";
import {implementationTargets} from "../server/implementation-core.js";

const projectRoot=fileURLToPath(new URL("../../../cx回收/",import.meta.url));
const template=getRequirementTemplate("frontend-feature");

function genericRecord(){
 const record=makeRequirementRecord({id:"CR-030",description:"在小哥首页新增回收进度入口",materials:"",requestId:randomUUID(),template,now:new Date("2026-09-15T02:00:00.000Z")});
 const result=validateResult({summary:"新增入口并补齐页面反馈。",facts:["首页已有导航区域。"],questions:[],acceptance:["首页可进入回收进度页。"],evidence:["prototype/src/courier/HomePage.jsx"],scope:["新增回收进度入口"],excluded:["不接生产接口"],targets:["prototype/src/courier/HomePage.jsx","docs/courier-page-guides/01-小哥H5推广流程-页面功能说明.md","../outside.js"]});
 record.currentStageId="impact-analysis";record.taskControl.aiPolicy="planning-only";record.taskControl.executionState="waiting-human";
 record.workbenchAnalysis={id:randomUUID(),status:"completed",result};
 record.stageResults["impact-analysis"]={status:"waiting_user",updatedAt:"2026-09-15",recordedAt:"2026-09-15T02:01:00.000Z",note:"AI 已完成分析。"};
 return record;
}

test("new capability uses the common six-state requirement lifecycle",()=>{
 assert(template);
 assert.deepEqual(template.stages.map(item=>item.label),["待分析","待确认方案","待授权","执行中","待验收","已完成"]);
 assert(template.questionPolicy.ask.includes("业务规则"));
 assert(template.questionPolicy.decide.includes("视觉一致性"));
 assert(template.defaultAcceptance.length>=5);
});

test("new registration is record-only and may start analysis only after an explicit action",()=>{
 const record=genericRecord(),fresh=makeRequirementRecord({id:"CR-030",description:"在小哥首页新增回收进度入口",materials:"",requestId:randomUUID(),template});
 assert.equal(fresh.requirementType,"frontend-feature");
 assert.equal(fresh.taskControl.executionScope.mode,"record-only");
 assert.equal(fresh.taskControl.executionState,"locked");
 assert.equal(canStart(fresh),true);
 assert.equal(fresh.workbenchAnalysis,undefined);
 assert(record.workbenchTemplate.prototypeAuthorization.excludes.some(item=>item.includes("部署和发布")));
});

test("a chosen main type and impact tags are saved separately, not reduced to template defaults",()=>{
 const existing=getRequirementTemplate("existing-page-adjustment");
 const record=makeRequirementRecord({id:"CR-031",description:"把已有订单状态改成六个展示标签",materials:"",requestId:randomUUID(),template:existing,
  impactTags:["frontend-page","state-data","requirement-document"]});
 assert.equal(record.requirementType,"existing-page-adjustment");
 assert.deepEqual(record.impactTags,["frontend-page","state-data","requirement-document"]);
 assert.notDeepEqual(record.impactTags,existing.defaultImpactTags);
 assert.equal(record.taskControl.executionState,"locked");
});

test("a generic no-question analysis can confirm business but still cannot implement without a separate authorization",()=>{
 const record=genericRecord(),answers=questionReview(record),review=businessReview(record);
 assert.equal(answers.questions.length,0);assert.equal(review.eligible,true);assert.equal(review.receipt,null);
 const saved=saveBusinessDecisions(record,{version:review.version,basis:review.basis,requestId:randomUUID(),confirmDecisionsOnly:true,items:review.recommendations.map(item=>({id:item.id,choice:"adopt"}))});
 assert(saved.workbenchBusinessDecisions.length===1);
 assert.equal(saved.taskControl.aiPolicy,"planning-only");
 assert.equal(saved.taskControl.readinessChecklist.find(item=>item.id==="authorization-confirmed").status,"not-assessed");
 const safe=implementationTargets(saved);
 assert(safe.includes("prototype/src/courier/HomePage.jsx"));
 assert(!safe.includes("../outside.js"));
 for(const file of safe)assert(fs.existsSync(path.join(projectRoot,file)),file);
});
