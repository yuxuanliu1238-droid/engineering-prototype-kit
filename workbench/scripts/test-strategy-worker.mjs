import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {fileURLToPath} from "node:url";
import {getRequirementTemplate} from "../src/requirement-templates.js";
import {makeRequirementRecord} from "../server/requirement-create.js";
import {businessReview,saveBusinessDecisions} from "../server/business-decisions.js";
import {implementationPlugin} from "../server/implementation-api.js";
import {readRecord} from "../server/implementation-core.js";
import {strategyAcceptancePlugin} from "../server/strategy-acceptance-api.js";
import {prepareStrategyAdjustment,startSameScopeStrategyAdjustment} from "../server/strategy-adjustment-core.js";
import {validateWorkflowData} from "../../../cx回收/prototype/scripts/workflow-data.mjs";

const realRoot=fileURLToPath(new URL("../../../cx回收/",import.meta.url));
const fake=fileURLToPath(new URL("./fixtures/fake-strategy-cli.mjs",import.meta.url));
const temp=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"strategy-worker-test-")));
const root=path.join(temp,"project"),runtime=path.join(temp,"runtime"),cli=path.join(temp,"fake-cli");
for(const file of ["AGENTS.md","prototype/AGENTS.md","docs/decisions/NEGATIVE_DECISIONS.md",
  "docs/requirements/registry.json","docs/requirements/page-document-map.json","docs/需求池.md"]){
  fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});
  fs.copyFileSync(path.join(realRoot,file),path.join(root,file));
}
fs.mkdirSync(path.join(root,"docs/review"),{recursive:true});
fs.mkdirSync(path.join(root,"prototype/scripts"),{recursive:true});
fs.symlinkSync(path.join(realRoot,"prototype/scripts/workflow-data.mjs"),path.join(root,"prototype/scripts/workflow-data.mjs"));
fs.copyFileSync(fake,cli);fs.chmodSync(cli,0o700);
const registryPath=path.join(root,"docs/requirements/registry.json"),registry=JSON.parse(fs.readFileSync(registryPath,"utf8"));
let record=makeRequirementRecord({id:"CR-900",description:"调整测试校验规则",materials:"",requestId:randomUUID(),template:getRequirementTemplate("business-rule-validation")});
record.currentStageId="impact-analysis";record.stageResults["waiting-start"].status="completed";
record.stageResults["impact-analysis"]={status:"waiting_user",updatedAt:"2026-09-15",recordedAt:"2026-09-15T00:00:00.000Z",note:"隔离分析已完成"};
record.taskControl.aiPolicy="planning-only";record.taskControl.executionState="waiting-human";
record.workbenchAnalysis={id:randomUUID(),status:"completed",result:{summary:"规则调整",facts:["现有规则已核对"],scope:["调整校验规则说明"],excluded:["不改生产代码"],questions:[],acceptance:["正反例可核对"],evidence:["现有说明"],targets:[]}};
const review=businessReview(record);
assert(review.eligible,JSON.stringify(review.blockers));
record=saveBusinessDecisions(record,{version:review.version,basis:review.basis,requestId:randomUUID(),confirmDecisionsOnly:true,items:review.recommendations.map(item=>({id:item.id,choice:"adopt"}))});
registry.requirements.push(record);fs.writeFileSync(registryPath,JSON.stringify(registry));
let handler,args,dispatches=0;
implementationPlugin(root,runtime,{cli,dispatch:(...values)=>{args=values;dispatches++;return {on(){},unref(){}};}})
  .configureServer({middlewares:{use(fn){handler=fn;}}});
async function request(method,body={}){
  let data;const req={url:"/api/analysis/cx-recycle/CR-900/implementation",method,
    headers:{host:"127.0.0.1:5174",origin:"http://127.0.0.1:5174","content-type":"application/json"},
    async *[Symbol.asyncIterator](){yield JSON.stringify(body);}},res={setHeader(){},end(value){data=JSON.parse(value);}};
  await handler(req,res,()=>assert.fail("route not matched"));return {status:res.statusCode,data};
}
const prepared=await request("GET");
assert.equal(prepared.status,200);assert(prepared.data.ready,JSON.stringify(prepared.data.blockers));
assert.equal(prepared.data.plan.mode,"strategy-artifact");
const consent={basis:prepared.data.basis,version:prepared.data.version,confirmStrategyArtifact:true,acceptScopeAndRisk:true};
assert.equal((await request("POST",{...consent,confirmStrategyArtifact:false})).status,400);
const accepted=await request("POST",consent);assert.equal(accepted.status,202,JSON.stringify(accepted.data));
assert.equal(dispatches,1);assert(args[1][0].endsWith("strategy-artifact-worker.js"));
const child=spawn(args[0],args[1],{stdio:"pipe"});let diagnostics="";child.stderr.on("data",chunk=>diagnostics+=chunk);
assert.equal(await new Promise(resolve=>child.on("close",resolve)),0,diagnostics);
const finished=await request("GET");
assert.equal(finished.data.job.status,"completed",finished.data.job.message);
const latest=readRecord(root,"CR-900");
assert.equal(latest.currentStageId,"user-review");
assert.equal(latest.workbenchLifecycle.state,"awaiting-review");
assert.equal(latest.taskControl.executionState,"waiting-human");
assert(fs.existsSync(path.join(root,"docs/review/CR-900-business-rule-validation-delivery.md")));
assert(!fs.existsSync(path.join(realRoot,"docs/review/CR-900-business-rule-validation-delivery.md")));
let acceptanceHandler;
let adjustmentArgs,adjustmentDispatches=0;
strategyAcceptancePlugin(root,runtime,{cli,dispatch:(...values)=>{adjustmentArgs=values;adjustmentDispatches++;return {on(){},unref(){}};}})
  .configureServer({middlewares:{use(fn){acceptanceHandler=fn;}}});
async function acceptanceRequest(method,body={},suffix=""){
  let data;const req={url:`/api/analysis/cx-recycle/CR-900/strategy-acceptance${suffix}`,method,
    headers:{host:"127.0.0.1:5174",origin:"http://127.0.0.1:5174","content-type":"application/json"},
    async *[Symbol.asyncIterator](){yield JSON.stringify(body);}},res={setHeader(){},end(value){data=JSON.parse(value);}};
  await acceptanceHandler(req,res,()=>assert.fail("acceptance route not matched"));return {status:res.statusCode,data};
}
const view=await acceptanceRequest("GET");assert.equal(view.status,200);assert(view.data.ready);
assert(view.data.files[0].content.includes("# 业务规则调整"));
const adjustment={requestId:randomUUID(),text:"在规则说明中补充同范围的异常示例",confirmSameScope:true,
  basis:view.data.adjustment.basis,version:view.data.adjustment.version};
const adjustmentPrepared=prepareStrategyAdjustment(root,readRecord(root,"CR-900"),cli);
const probe=JSON.parse(fs.readFileSync(registryPath,"utf8"));
probe.requirements[probe.requirements.findIndex(item=>item.id==="CR-900")]=startSameScopeStrategyAdjustment(
  readRecord(root,"CR-900"),{...adjustment,jobId:randomUUID()},adjustmentPrepared);
const probeResult=await validateWorkflowData(probe,JSON.parse(fs.readFileSync(path.join(root,"docs/requirements/page-document-map.json"),"utf8")));
assert(probeResult.valid,probeResult.errors.join(";"));
assert.equal((await acceptanceRequest("POST",{...adjustment,confirmSameScope:false},"/adjust")).status,400);
const adjustmentStarted=await acceptanceRequest("POST",adjustment,"/adjust");
assert.equal(adjustmentStarted.status,202,JSON.stringify(adjustmentStarted.data));
assert.equal((await acceptanceRequest("POST",adjustment,"/adjust")).status,200);
assert.equal(adjustmentDispatches,1);
assert.equal((await request("GET")).data.job.status,"submitted");
const adjustmentChild=spawn(adjustmentArgs[0],adjustmentArgs[1],{stdio:"pipe"});let adjustmentDiagnostics="";
adjustmentChild.stderr.on("data",chunk=>adjustmentDiagnostics+=chunk);
assert.equal(await new Promise(resolve=>adjustmentChild.on("close",resolve)),0,adjustmentDiagnostics);
const changed=await acceptanceRequest("GET");assert.equal(changed.status,200);assert(changed.data.ready);
assert.equal((await request("GET")).data.job.status,"completed");
assert(changed.data.files[0].content.includes("## 调整"));
const confirmation={confirmStrategyAccepted:true,requestId:randomUUID(),version:changed.data.version};
assert.equal((await acceptanceRequest("POST",confirmation)).status,200);
assert.equal((await acceptanceRequest("POST",confirmation)).status,200);
assert.equal(readRecord(root,"CR-900").workbenchLifecycle.state,"completed");
assert.equal(readRecord(root,"CR-900").currentStageId,"synced");
console.log("PASS: isolated strategy authorization, worker, exact document write and acceptance");
