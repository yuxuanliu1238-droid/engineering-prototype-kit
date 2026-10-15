import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawn} from "node:child_process";
import {randomUUID,createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {makeEmptyRegistry,makeRecordedRequirement,renderRequirements} from "../../scripts/workflow-v3-lib.mjs";
import {discoverKitProjects} from "../server/project-discovery.js";
import {kitAnalysisPlugin} from "../server/kit-analysis-api.js";
import {kitSchemePlugin} from "../server/kit-scheme-api.js";
import {kitAuthorizationPlugin} from "../server/kit-authorization-api.js";
import {kitImplementationPlugin} from "../server/kit-implementation-api.js";
import {kitPreviewPlugin} from "../server/kit-preview-api.js";
import {kitReviewPlugin} from "../server/kit-review-api.js";
import {kitAdjustmentPlugin} from "../server/kit-adjustment-api.js";
import {kitReplanPlugin} from "../server/kit-replan-api.js";
import {confirmKitScheme} from "../server/kit-scheme-core.js";
import {buildKitAuthorizationPlan,authorizeKitRequirement} from "../server/kit-authorization-core.js";
import {validateRegistryData} from "../../scripts/workflow-v3-lib.mjs";

const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"kit-analysis-test-"))),projectRoot=path.join(root,"业务规则项目"),runtime=path.join(root,"runtime");
fs.mkdirSync(path.join(projectRoot,"docs/requirements"),{recursive:true});
fs.writeFileSync(path.join(projectRoot,"project.config.json"),JSON.stringify({instanceKind:"business-project",projectName:"业务规则项目"}));
fs.writeFileSync(path.join(projectRoot,"project-status.json"),JSON.stringify({currentMode:"continuous-iteration"}));
const registry=makeEmptyRegistry();registry.items.push(makeRecordedRequirement({id:"CR-001",description:"把已有订单状态标签重新分组显示",requirementType:"existing-page-adjustment",impactTags:["frontend-page"],requestId:randomUUID()}));
const registryPath=path.join(projectRoot,"docs/requirements/registry.json"),source=JSON.stringify(registry,null,2)+"\n";
fs.writeFileSync(registryPath,source);fs.writeFileSync(path.join(projectRoot,"docs/requirements/requirements.md"),renderRequirements(registry));
fs.mkdirSync(path.join(projectRoot,"prototype/src"),{recursive:true});fs.writeFileSync(path.join(projectRoot,"prototype/src/OrderPage.jsx"),"// 订单状态标签\nexport default function OrderPage(){return null}\n");
const project=discoverKitProjects(root)[0];assert.equal(project.valid,true);
const fake=fileURLToPath(new URL("./fixtures/fake-kit-analysis-cli.mjs",import.meta.url)),cli=path.join(root,"fake-cli");
fs.copyFileSync(fake,cli);fs.chmodSync(cli,0o700);
let handler,args,dispatches=0;
kitAnalysisPlugin(root,runtime,{cli,dispatch:(...values)=>{args=values;dispatches++;return {on(){},unref(){}};}})
  .configureServer({middlewares:{use(fn){handler=fn;}}});
async function request(method,input={},origin="http://127.0.0.1:5174"){
  let data;const req={url:`/api/projects/${project.id}/requirements/CR-001/analysis`,method,
    headers:{host:"127.0.0.1:5174",origin,"content-type":"application/json"},
    async *[Symbol.asyncIterator](){yield JSON.stringify(input);}},res={setHeader(){},end(value){data=JSON.parse(value);}};
  await handler(req,res,()=>assert.fail("analysis route not matched"));return {status:res.statusCode,data};
}
let input={requestId:randomUUID(),registrySha256:createHash("sha256").update(source).digest("hex"),confirmAnalysisOnly:true};
assert.equal((await request("GET")).data.job,null);
assert.equal((await request("POST",input,"https://foreign.test")).status,403);
assert.equal((await request("POST",{...input,confirmAnalysisOnly:false})).status,409);
assert.equal((await request("POST",input)).status,202);
assert.equal((await request("POST",input)).status,200);assert.equal(dispatches,1);
assert.equal((await request("POST",{...input,requestId:randomUUID()})).status,409,"active analysis cannot be duplicated");
const firstAnalysisId=input.requestId,analysisDirectory=path.join(runtime,"kit-analysis",project.id,"CR-001");
const failedJob=JSON.parse(fs.readFileSync(path.join(analysisDirectory,"run.json"),"utf8"));
failedJob.status="needs-attention";failedJob.message="执行端未能启动；需要核查。";
fs.writeFileSync(path.join(analysisDirectory,"run.json"),JSON.stringify(failedJob));
input={...input,requestId:randomUUID()};
assert.equal((await request("POST",input)).status,202,"failed analysis requires a new explicit request");
assert.equal(dispatches,2);
assert(fs.existsSync(path.join(runtime,"kit-analysis-history",project.id,"CR-001",firstAnalysisId,"run.json")),"failed analysis receipt must be preserved");
assert.equal((await request("GET")).data.history[0].id,firstAnalysisId);
const child=spawn(args[0],args[1],{stdio:"pipe"});let diagnostics="";child.stderr.on("data",chunk=>diagnostics+=chunk);
assert.equal(await new Promise(resolve=>child.on("close",resolve)),0,diagnostics);
const result=await request("GET");assert.equal(result.data.job.status,"completed");
assert.equal(result.data.job.result.questions[0].recommendation,"保留");
assert.equal(fs.readFileSync(registryPath,"utf8"),source,"analysis must not modify project registry");
let schemeHandler;kitSchemePlugin(root,runtime).configureServer({middlewares:{use(fn){schemeHandler=fn;}}});
async function schemeRequest(input,origin="http://127.0.0.1:5174"){
  let data;const req={url:`/api/projects/${project.id}/requirements/CR-001/scheme`,method:"POST",
    headers:{host:"127.0.0.1:5174",origin,"content-type":"application/json"},
    async *[Symbol.asyncIterator](){yield JSON.stringify(input);}},res={setHeader(){},end(value){data=JSON.parse(value);}};
  await schemeHandler(req,res,()=>assert.fail("scheme route not matched"));return {status:res.statusCode,data};
}
const scheme={requestId:randomUUID(),analysisId:input.requestId,registrySha256:input.registrySha256,
  confirmSchemeOnly:true,adoptAllRecommendations:true,answers:[]};
assert.equal((await schemeRequest(scheme,"https://foreign.test")).status,403);
assert.equal((await schemeRequest({...scheme,adoptAllRecommendations:false})).status,400);
const confirmed=await schemeRequest(scheme);assert.equal(confirmed.status,201,JSON.stringify(confirmed.data));
assert.equal((await schemeRequest(scheme)).status,200);
const after=JSON.parse(fs.readFileSync(registryPath,"utf8"));assert.deepEqual(validateRegistryData(after),[]);
const record=after.items[0];assert.equal(record.currentStageId,"awaiting-authorization");
assert.equal(record.workbenchScheme.decisions[0].choice,"保留");
assert.equal(record.workbenchScheme.implementationAuthorized,false);
assert.equal(record.readinessChecklist.find(check=>check.id==="authorization-confirmed").status,"not-assessed");
assert.equal(record.aiPolicy,"planning-only");
let authorizationHandler;kitAuthorizationPlugin(root,runtime).configureServer({middlewares:{use(fn){authorizationHandler=fn;}}});
async function authorizationRequest(method,input={},origin="http://127.0.0.1:5174"){
  let data;const req={url:`/api/projects/${project.id}/requirements/CR-001/authorization`,method,
    headers:{host:"127.0.0.1:5174",origin,"content-type":"application/json"},
    async *[Symbol.asyncIterator](){yield JSON.stringify(input);}},res={setHeader(){},end(value){data=JSON.parse(value);}};
  await authorizationHandler(req,res,()=>assert.fail("authorization route not matched"));return {status:res.statusCode,data};
}
const proposed=await authorizationRequest("GET");assert.equal(proposed.status,200);
assert.equal(proposed.data.plan.canAuthorize,true,JSON.stringify(proposed.data.plan));
assert(proposed.data.plan.existingFiles.some(file=>file.path==="prototype/src/OrderPage.jsx"));
const auth={requestId:randomUUID(),planHash:proposed.data.plan.planHash,
  registrySha256:proposed.data.registrySha256,confirmAuthorizationOnly:true};
assert.equal((await authorizationRequest("POST",auth,"https://foreign.test")).status,403);
assert.equal((await authorizationRequest("POST",{...auth,planHash:"stale"})).status,409);
const authorized=await authorizationRequest("POST",auth);assert.equal(authorized.status,201,JSON.stringify(authorized.data));
assert.equal((await authorizationRequest("POST",auth)).status,200);
const finalRegistry=JSON.parse(fs.readFileSync(registryPath,"utf8"));assert.deepEqual(validateRegistryData(finalRegistry),[]);
const authorizedRecord=finalRegistry.items[0];assert.equal(authorizedRecord.currentStageId,"awaiting-authorization");
assert.equal(authorizedRecord.executionState,"ready");
assert.equal(authorizedRecord.workbenchAuthorization.implementationStarted,false);
assert.equal(authorizedRecord.readinessChecklist.find(check=>check.id==="authorization-confirmed").status,"met");
assert.equal(fs.readFileSync(path.join(projectRoot,"prototype/src/OrderPage.jsx"),"utf8"),"// 订单状态标签\nexport default function OrderPage(){return null}\n");
const backend=makeRecordedRequirement({id:"CR-002",description:"调整后台黑名单校验逻辑",requirementType:"business-rule-validation",
  impactTags:["backend-logic","requirement-document"]});
const backendScheme=confirmKitScheme(backend,{summary:"只调整校验规则定义",scope:["黑名单判断"],excluded:["不改页面"],
  questions:[],acceptance:["正反例判断表可复核"],targets:[],risk:{level:"standard",triggers:["product-outcome"],rationale:"会改变拒绝结果"}},
  {requestId:randomUUID()});
const backendPlan=buildKitAuthorizationPlan(projectRoot,backendScheme);assert.equal(backendPlan.canAuthorize,true);
assert(backendPlan.outputs.includes("判断表"));assert(backendPlan.branches.includes("后台业务逻辑"));
const backendAuthorized=authorizeKitRequirement(backendScheme,backendPlan,{requestId:randomUUID()});
const check=makeEmptyRegistry();check.items.push(backendAuthorized);assert.deepEqual(validateRegistryData(check),[]);
assert(!backendAuthorized.workbenchAuthorization.existingFiles.some(file=>file.path.startsWith("prototype/")));
fs.writeFileSync(path.join(projectRoot,"prototype/package.json"),JSON.stringify({name:"test-prototype",private:true,scripts:{build:"vite build"}}));
const vite=path.join(projectRoot,"prototype/node_modules/.bin/vite");fs.mkdirSync(path.dirname(vite),{recursive:true});
fs.writeFileSync(vite,"#!/usr/bin/env node\nconst fs=require('fs');const path=require('path');const args=process.argv;const out=args[args.indexOf('--outDir')+1];fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'index.html'),'<html>test</html>');console.log('vite build passed');\n");fs.chmodSync(vite,0o700);
const implementationFixture=fileURLToPath(new URL("./fixtures/fake-kit-implementation-cli.mjs",import.meta.url)),implementationCli=path.join(root,"fake-implementation-cli");
fs.copyFileSync(implementationFixture,implementationCli);fs.chmodSync(implementationCli,0o700);
let implementationHandler,implementationArgs,implementationDispatches=0;
kitImplementationPlugin(root,runtime,{cli:implementationCli,dispatch:(...values)=>{implementationArgs=values;implementationDispatches++;return {on(){},unref(){}};}})
  .configureServer({middlewares:{use(fn){implementationHandler=fn;}}});
async function implementationRequest(method,input={},origin="http://127.0.0.1:5174",requirementId="CR-001",retry=false){
  let data;const req={url:`/api/projects/${project.id}/requirements/${requirementId}/implementation${retry?"/retry":""}`,method,
    headers:{host:"127.0.0.1:5174",origin,"content-type":"application/json"},
    async *[Symbol.asyncIterator](){yield JSON.stringify(input);}},res={setHeader(){},end(value){data=JSON.parse(value);}};
  await implementationHandler(req,res,()=>assert.fail("implementation route not matched"));return {status:res.statusCode,data};
}
const current=await implementationRequest("GET"),start={requestId:randomUUID(),registrySha256:current.data.registrySha256,
  authorizationPlanHash:authorizedRecord.workbenchAuthorization.planHash,confirmImplementationStart:true};
assert.equal((await implementationRequest("POST",start,"https://foreign.test")).status,403);
assert.equal((await implementationRequest("POST",{...start,authorizationPlanHash:"stale"})).status,409);
assert.equal((await implementationRequest("POST",start)).status,202);
assert.equal((await implementationRequest("POST",start)).status,200);assert.equal(implementationDispatches,1);
const implementationChild=spawn(implementationArgs[0],implementationArgs[1],{stdio:"pipe"});let implementationDiagnostics="";
implementationChild.stderr.on("data",chunk=>implementationDiagnostics+=chunk);
assert.equal(await new Promise(resolve=>implementationChild.on("close",resolve)),0,implementationDiagnostics);
const implemented=await implementationRequest("GET");assert.equal(implemented.data.job.status,"completed",JSON.stringify(implemented.data));
const afterImplementation=JSON.parse(fs.readFileSync(registryPath,"utf8"));assert.deepEqual(validateRegistryData(afterImplementation),[]);
assert.equal(afterImplementation.items[0].currentStageId,"awaiting-review");
assert.equal(afterImplementation.items[0].executionState,"waiting-human");
assert(afterImplementation.items[0].artifacts.some(item=>item.type==="prototype"));
assert(afterImplementation.items[0].artifacts.some(item=>item.type==="test-report"));
assert(fs.readFileSync(path.join(projectRoot,"prototype/src/OrderPage.jsx"),"utf8").includes("六个展示分组"));
assert(fs.existsSync(path.join(projectRoot,"docs/review/CR-001-existing-page-adjustment-delivery.md")));
assert(!fs.existsSync(path.join(projectRoot,"prototype/dist")),"build output must not be written into unlisted project directories");
let previewHandler;kitPreviewPlugin(root,runtime).configureServer({middlewares:{use(fn){previewHandler=fn;}}});
function previewRequest(origin="http://127.0.0.1:5174",previewUrl=implemented.data.job.result.previewUrl){
  let content;const req={url:previewUrl,method:"GET",
    headers:{host:"127.0.0.1:5174",origin}},res={setHeader(){},end(value){content=value;}};
  previewHandler(req,res,()=>assert.fail("preview route not matched"));return {status:res.statusCode||200,content:String(content)};
}
assert.equal(previewRequest("https://foreign.test").status,403);
assert.equal(previewRequest().status,200);assert(previewRequest().content.includes("<html>"));
let reviewHandler;kitReviewPlugin(root,runtime).configureServer({middlewares:{use(fn){reviewHandler=fn;}}});
async function reviewRequest(requirementId,method,input={},origin="http://127.0.0.1:5174"){
  let data;const req={url:`/api/projects/${project.id}/requirements/${requirementId}/review`,method,
    headers:{host:"127.0.0.1:5174",origin,"content-type":"application/json"},
    async *[Symbol.asyncIterator](){yield JSON.stringify(input);}},res={setHeader(){},end(value){data=JSON.parse(value);}};
  await reviewHandler(req,res,()=>assert.fail("review route not matched"));return {status:res.statusCode,data};
}
const frontendReview=await reviewRequest("CR-001","GET");assert.equal(frontendReview.status,200);
assert(frontendReview.data.review.previewUrl);
let adjustmentHandler,adjustmentArgs,adjustmentDispatches=0;
kitAdjustmentPlugin(root,runtime,{cli:implementationCli,dispatch:(...values)=>{adjustmentArgs=values;adjustmentDispatches++;return {on(){},unref(){}};}})
  .configureServer({middlewares:{use(fn){adjustmentHandler=fn;}}});
async function adjustmentRequest(method,input={},origin="http://127.0.0.1:5174"){
  let data;const req={url:`/api/projects/${project.id}/requirements/CR-001/adjustment`,method,
    headers:{host:"127.0.0.1:5174",origin,"content-type":"application/json"},
    async *[Symbol.asyncIterator](){yield JSON.stringify(input);}},res={setHeader(){},end(value){data=JSON.parse(value);}};
  await adjustmentHandler(req,res,()=>assert.fail("adjustment route not matched"));return {status:res.statusCode,data};
}
const adjustment={requestId:randomUUID(),text:"优化六个标签的选中态，业务规则保持不变",reviewDigest:frontendReview.data.review.reviewDigest,
  confirmSameScope:true,confirmAdjustmentAndContinue:true};
assert.equal((await adjustmentRequest("POST",adjustment,"https://foreign.test")).status,403);
assert.equal((await adjustmentRequest("POST",{...adjustment,confirmSameScope:false})).status,400);
assert.equal((await adjustmentRequest("POST",adjustment)).status,202);
assert.equal((await adjustmentRequest("POST",adjustment)).status,200);assert.equal(adjustmentDispatches,1);
const adjustmentChild=spawn(adjustmentArgs[0],adjustmentArgs[1],{stdio:"pipe"});let adjustmentDiagnostics="";
adjustmentChild.stderr.on("data",chunk=>adjustmentDiagnostics+=chunk);
assert.equal(await new Promise(resolve=>adjustmentChild.on("close",resolve)),0,adjustmentDiagnostics);
assert.equal((await adjustmentRequest("GET")).data.job.status,"completed");
const adjustedRegistry=JSON.parse(fs.readFileSync(registryPath,"utf8"));assert.deepEqual(validateRegistryData(adjustedRegistry),[]);
assert.equal(adjustedRegistry.items[0].currentStageId,"awaiting-review");
assert.equal(adjustedRegistry.items[0].workbenchImplementationHistory.length,1);
assert(fs.readFileSync(path.join(projectRoot,"prototype/src/OrderPage.jsx"),"utf8").includes("优化选中态"));
const adjustedReview=await reviewRequest("CR-001","GET");assert.equal(adjustedReview.status,200);
const adjustedSource=fs.readFileSync(path.join(projectRoot,"prototype/src/OrderPage.jsx"),"utf8"),expanded={requestId:randomUUID(),
  text:"新增外部接口并把接口结果展示在这个页面",reviewDigest:adjustedReview.data.review.reviewDigest,
  confirmSameScope:true,confirmAdjustmentAndContinue:true};
assert.equal((await adjustmentRequest("POST",expanded)).status,202);
const expandedChild=spawn(adjustmentArgs[0],adjustmentArgs[1],{stdio:"pipe"});let expandedDiagnostics="";
expandedChild.stderr.on("data",chunk=>expandedDiagnostics+=chunk);
assert.equal(await new Promise(resolve=>expandedChild.on("close",resolve)),0,expandedDiagnostics);
const expandedResult=await adjustmentRequest("GET");assert.equal(expandedResult.data.job.status,"needs-attention");
assert(expandedResult.data.job.message.includes("超出"));
assert.equal(fs.readFileSync(path.join(projectRoot,"prototype/src/OrderPage.jsx"),"utf8"),adjustedSource);
const afterExpanded=JSON.parse(fs.readFileSync(registryPath,"utf8"));assert.deepEqual(validateRegistryData(afterExpanded),[]);
assert.equal(afterExpanded.items[0].currentStageId,"awaiting-review");
assert.equal(afterExpanded.items[0].workbenchAdjustmentRequests.at(-1).status,"scope-expansion");
assert.equal(afterExpanded.items[0].workbenchImplementation.jobId,adjustment.requestId);
const finalFrontendReview=await reviewRequest("CR-001","GET");assert.equal(finalFrontendReview.status,409);
const replanRecord=afterExpanded.items[0];
assert.equal(replanRecord.waitingReason.code,"rule-ambiguity");
let replanHandler,replanArgs,replanDispatches=0;
kitReplanPlugin(root,runtime,{cli,dispatch:(...values)=>{replanArgs=values;replanDispatches++;return {on(){},unref(){}};}})
  .configureServer({middlewares:{use(fn){replanHandler=fn;}}});
async function replanRequest(method,input={},confirm=false,origin="http://127.0.0.1:5174"){
  let data;const req={url:`/api/projects/${project.id}/requirements/CR-001/replan${confirm?"/confirm":""}`,method,
    headers:{host:"127.0.0.1:5174",origin,"content-type":"application/json"},
    async *[Symbol.asyncIterator](){yield JSON.stringify(input);}},res={setHeader(){},end(value){data=JSON.parse(value);}};
  await replanHandler(req,res,()=>assert.fail("replan route not matched"));return {status:res.statusCode,data};
}
const replanInput={requestId:randomUUID(),registrySha256:(await replanRequest("GET")).data.registrySha256,
  confirmReadOnlyAnalysis:true,expandedDescription:"增加对接方接口数据，并在已有订单页展示结果",
  requirementType:"existing-page-adjustment",impactTags:["frontend-page","external-interface","requirement-document"]};
assert.equal((await replanRequest("POST",replanInput,false,"https://foreign.test")).status,403);
assert.equal((await replanRequest("POST",replanInput)).status,202);
assert.equal((await replanRequest("POST",replanInput)).status,200);assert.equal(replanDispatches,1);
const replanChild=spawn(replanArgs[0],replanArgs[1],{stdio:"pipe"});let replanDiagnostics="";
replanChild.stderr.on("data",chunk=>replanDiagnostics+=chunk);
assert.equal(await new Promise(resolve=>replanChild.on("close",resolve)),0,replanDiagnostics);
assert.equal((await replanRequest("GET")).data.job.status,"completed");
const replanConfirm={requestId:randomUUID(),analysisId:replanInput.requestId,
  registrySha256:(await replanRequest("GET")).data.registrySha256,confirmReplannedSchemeOnly:true,
  adoptAllRecommendations:true,answers:[]};
assert.equal((await replanRequest("POST",replanConfirm,true)).status,201);
const replannedRecord=JSON.parse(fs.readFileSync(registryPath,"utf8")).items[0];
assert.equal(replannedRecord.workbenchScheme.version,2);
assert.equal(replannedRecord.currentStageId,"awaiting-authorization");
assert.equal(replannedRecord.workbenchAuthorization,null);
assert.equal(replannedRecord.workbenchImplementation,null);
assert.equal(replannedRecord.workbenchRoundHistory.length,1);
assert.equal(replannedRecord.workbenchAdjustmentRequests.at(-1).status,"replanned");
assert(replannedRecord.impactTags.includes("external-interface"));
const replanPlan=await authorizationRequest("GET");assert.equal(replanPlan.status,200);
assert.equal(replanPlan.data.plan.canAuthorize,true,JSON.stringify(replanPlan.data));
assert(replanPlan.data.plan.existingFiles.some(file=>file.path==="docs/review/CR-001-existing-page-adjustment-delivery.md"));
assert.deepEqual(replanPlan.data.plan.createFiles,[]);
const replanAuth={requestId:randomUUID(),planHash:replanPlan.data.plan.planHash,
  registrySha256:replanPlan.data.registrySha256,confirmAuthorizationOnly:true};
assert.equal((await authorizationRequest("POST",replanAuth)).status,201);
const reauthorizedRecord=JSON.parse(fs.readFileSync(registryPath,"utf8")).items[0];
assert.notEqual(reauthorizedRecord.workbenchAuthorization.requestId,authorizedRecord.workbenchAuthorization.requestId);
assert.equal(reauthorizedRecord.workbenchAuthorization.implementationStarted,false);
const secondStart={requestId:randomUUID(),registrySha256:(await implementationRequest("GET")).data.registrySha256,
  authorizationPlanHash:reauthorizedRecord.workbenchAuthorization.planHash,confirmImplementationStart:true};
assert.equal((await implementationRequest("GET")).data.job,null,"second round must not reuse first job");
assert.equal((await implementationRequest("POST",secondStart)).status,202);
const secondChild=spawn(implementationArgs[0],implementationArgs[1],{stdio:"pipe"});let secondDiagnostics="";
secondChild.stderr.on("data",chunk=>secondDiagnostics+=chunk);
assert.equal(await new Promise(resolve=>secondChild.on("close",resolve)),0,secondDiagnostics);
assert.equal((await implementationRequest("GET")).data.job.status,"completed");
const secondRecord=JSON.parse(fs.readFileSync(registryPath,"utf8")).items[0];
assert.equal(secondRecord.currentStageId,"awaiting-review");
assert.notEqual(secondRecord.workbenchImplementation.jobId,adjustment.requestId);
assert.equal((await reviewRequest("CR-001","GET")).status,200);
const secondPreview=(await implementationRequest("GET")).data.job.result.previewUrl;
assert.equal(previewRequest("http://127.0.0.1:5174",secondPreview).status,200);
assert.equal(previewRequest().status,404,"first-round preview must not masquerade as current delivery");
// The second authorized round, not the old delivery, is the one eligible for acceptance.
const acceptReview=await reviewRequest("CR-001","GET");assert.equal(acceptReview.status,200);
const frontendAccept={requestId:randomUUID(),outcome:"approved",confirmAcceptanceOnly:true,
  reviewDigest:acceptReview.data.review.reviewDigest,previewAcknowledged:true};
assert.equal((await reviewRequest("CR-001","POST",frontendAccept,"https://foreign.test")).status,403);
assert.equal((await reviewRequest("CR-001","POST",{...frontendAccept,previewAcknowledged:false})).status,400);
assert.equal((await reviewRequest("CR-001","POST",frontendAccept)).status,201);
assert.equal((await reviewRequest("CR-001","POST",frontendAccept)).status,200);
const completedFrontendReview=await reviewRequest("CR-001","GET");
assert.equal(completedFrontendReview.status,200);assert(completedFrontendReview.data.review.deliveryMarkdown);
assert(completedFrontendReview.data.review.previewUrl,"completed frontend result remains previewable");
const acceptedFrontend=JSON.parse(fs.readFileSync(registryPath,"utf8"));assert.deepEqual(validateRegistryData(acceptedFrontend),[]);
assert.equal(acceptedFrontend.items[0].currentStageId,"completed");
assert.equal(acceptedFrontend.items[0].workbenchAcceptance.outcome,"approved");
assert.equal(acceptedFrontend.items[0].workbenchLifecycle.state,"completed");
const lifecycleStates=new Set(["awaiting-analysis","awaiting-plan","awaiting-authorization","executing","awaiting-review","completed"]);
assert(acceptedFrontend.items[0].workbenchLifecycle.history.every(entry=>lifecycleStates.has(entry.state)));
for(const state of lifecycleStates)assert(acceptedFrontend.items[0].workbenchLifecycle.history.some(entry=>entry.state===state),`missing lifecycle state: ${state}`);
const progress=acceptedFrontend.items[0].workbenchProgress;
for(const action of ["登记需求","分析需求","确认业务方案","授权实施","启动本轮实施",
  "完成工程化交付","提交调整并继续","发现调整超出范围","重新分析扩大范围","确认新业务方案","验收通过"])
  assert(progress.some(event=>event.action===action),`missing progress: ${action}`);
assert(progress.every(event=>!Number.isNaN(Date.parse(event.at))&&event.actor&&event.result&&event.nextActor));
assert.equal(progress.filter(event=>event.action==="授权实施"&&event.authorization).length,2);
assert.equal(progress.filter(event=>event.action==="验收通过").length,1,"repeated acceptance must not duplicate progress");
const mixed=JSON.parse(fs.readFileSync(registryPath,"utf8"));mixed.items.push(backendAuthorized);
fs.writeFileSync(registryPath,JSON.stringify(mixed,null,2)+"\n");
fs.writeFileSync(path.join(projectRoot,"docs/requirements/requirements.md"),renderRequirements(mixed));
const backendCurrent=await implementationRequest("GET",{},"http://127.0.0.1:5174","CR-002");
const backendStart={requestId:randomUUID(),registrySha256:backendCurrent.data.registrySha256,
  authorizationPlanHash:backendAuthorized.workbenchAuthorization.planHash,confirmImplementationStart:true};
assert.equal((await implementationRequest("POST",backendStart,"http://127.0.0.1:5174","CR-002")).status,202);
const backendChild=spawn(implementationArgs[0],implementationArgs[1],{stdio:"pipe"});let backendDiagnostics="";
backendChild.stderr.on("data",chunk=>backendDiagnostics+=chunk);
assert.equal(await new Promise(resolve=>backendChild.on("close",resolve)),0,backendDiagnostics);
const backendResult=await implementationRequest("GET",{},"http://127.0.0.1:5174","CR-002");
assert.equal(backendResult.data.job.status,"completed",JSON.stringify(backendResult.data));
const afterBackend=JSON.parse(fs.readFileSync(registryPath,"utf8"));assert.deepEqual(validateRegistryData(afterBackend),[]);
assert.equal(afterBackend.items.find(item=>item.id==="CR-002").currentStageId,"awaiting-review");
assert(fs.existsSync(path.join(projectRoot,"docs/review/CR-002-business-rule-validation-delivery.md")));
assert(!backendResult.data.job.changedFiles.some(file=>file.startsWith("prototype/")));
const backendReview=await reviewRequest("CR-002","GET");assert.equal(backendReview.status,200);
assert.equal(backendReview.data.review.previewUrl,null);
const backendDelivery=path.join(projectRoot,"docs/review/CR-002-business-rule-validation-delivery.md"),checkedText=fs.readFileSync(backendDelivery,"utf8");
fs.writeFileSync(backendDelivery,checkedText+"\n未经工程检查的并发修改\n");
assert.equal((await reviewRequest("CR-002","GET")).status,409);
fs.writeFileSync(backendDelivery,checkedText);
const backendAccept={requestId:randomUUID(),outcome:"approved",confirmAcceptanceOnly:true,
  reviewDigest:backendReview.data.review.reviewDigest,previewAcknowledged:false};
assert.equal((await reviewRequest("CR-002","POST",backendAccept)).status,201);
const acceptedBackend=JSON.parse(fs.readFileSync(registryPath,"utf8"));assert.deepEqual(validateRegistryData(acceptedBackend),[]);
assert.equal(acceptedBackend.items.find(item=>item.id==="CR-002").currentStageId,"completed");
const conflict=makeRecordedRequirement({id:"CR-003",description:"再次调整已有订单状态标签",requirementType:"existing-page-adjustment",
  impactTags:["frontend-page"]});
const conflictScheme=confirmKitScheme(conflict,{summary:"调整旧页面展示",scope:["调整页面"],excluded:["不改状态"],
  questions:[],acceptance:["页面标签可切换"],targets:["prototype/src/OrderPage.jsx"],
  risk:{level:"light",triggers:[],rationale:"仅页面展示"}},{requestId:randomUUID()});
const conflictPlan=buildKitAuthorizationPlan(projectRoot,conflictScheme);assert.equal(conflictPlan.canAuthorize,true);
const conflictAuthorized=authorizeKitRequirement(conflictScheme,conflictPlan,{requestId:randomUUID()});
const beforeConflict=JSON.parse(fs.readFileSync(registryPath,"utf8"));beforeConflict.items.push(conflictAuthorized);
fs.writeFileSync(registryPath,JSON.stringify(beforeConflict,null,2)+"\n");
fs.writeFileSync(path.join(projectRoot,"docs/requirements/requirements.md"),renderRequirements(beforeConflict));
const conflictCurrent=await implementationRequest("GET",{},"http://127.0.0.1:5174","CR-003");
const conflictStart={requestId:randomUUID(),registrySha256:conflictCurrent.data.registrySha256,
  authorizationPlanHash:conflictAuthorized.workbenchAuthorization.planHash,confirmImplementationStart:true};
assert.equal((await implementationRequest("POST",conflictStart,"http://127.0.0.1:5174","CR-003")).status,202);
const sourcePath=path.join(projectRoot,"prototype/src/OrderPage.jsx"),cleanConflictSource=fs.readFileSync(sourcePath,"utf8"),userChange=cleanConflictSource+"// 并发的用户修改\n";
fs.writeFileSync(sourcePath,userChange);
const conflictChild=spawn(implementationArgs[0],implementationArgs[1],{stdio:"pipe"});
assert.equal(await new Promise(resolve=>conflictChild.on("close",resolve)),0);
const conflictResult=await implementationRequest("GET",{},"http://127.0.0.1:5174","CR-003");
assert.equal(conflictResult.data.job.status,"needs-attention");
assert.equal(fs.readFileSync(sourcePath,"utf8"),userChange);
assert(!fs.existsSync(path.join(projectRoot,"docs/review/CR-003-existing-page-adjustment-delivery.md")));
assert.equal(JSON.parse(fs.readFileSync(registryPath,"utf8")).items.find(item=>item.id==="CR-003").currentStageId,"awaiting-authorization");
const unsafeRetry={requestId:randomUUID(),registrySha256:conflictResult.data.registrySha256,
  authorizationPlanHash:conflictAuthorized.workbenchAuthorization.planHash,confirmRetryAfterInspection:true};
assert.equal((await implementationRequest("POST",unsafeRetry,"http://127.0.0.1:5174","CR-003",true)).status,409,"changed source must block retry");
fs.writeFileSync(sourcePath,cleanConflictSource);
const safeRetry={...unsafeRetry,requestId:randomUUID()};
assert.equal((await implementationRequest("POST",safeRetry,"http://127.0.0.1:5174","CR-003",true)).status,202);
const retryChild=spawn(implementationArgs[0],implementationArgs[1],{stdio:"pipe"});let retryDiagnostics="";
retryChild.stderr.on("data",chunk=>retryDiagnostics+=chunk);
assert.equal(await new Promise(resolve=>retryChild.on("close",resolve)),0,retryDiagnostics);
const retriedJob=await implementationRequest("GET",{},"http://127.0.0.1:5174","CR-003");
assert.equal(retriedJob.data.job.status,"completed",JSON.stringify(retriedJob.data));
const retriedRecord=JSON.parse(fs.readFileSync(registryPath,"utf8")).items.find(item=>item.id==="CR-003");
assert.equal(retriedRecord.currentStageId,"awaiting-review");
assert(fs.existsSync(path.join(runtime,"kit-implementation-history",project.id,"CR-003",conflictStart.requestId,"run.json")));
console.log("PASS: isolated Kit classification route through analysis, scheme, authorization, actual prototype edit, build and awaiting review");
