import fs from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {randomUUID} from "node:crypto";
import {hash,atomicJson} from "./analysis-core.js";
import {businessReview} from "./business-decisions.js";
import {transitionLifecycle} from "../src/requirement-lifecycle.js";
export const IMPLEMENT_ENDPOINT="/api/analysis/cx-recycle/CR-029/implementation";
export const implementationEndpoint=id=>`/api/analysis/cx-recycle/${id}/implementation`;
export const targets=["prototype/src/courier/HomePage.jsx","prototype/src/courier/Ranking.jsx","prototype/src/courier/ranking.js","prototype/src/courier/ranking.css","prototype/src/contracts/data/courier.js","docs/decisions/POSITIVE_DECISIONS.md","docs/courier-page-guides/01-小哥H5推广流程-页面功能说明.md"];
export const acceptance=["累计有效激励降序、有效订单数降序、并列1/1/3；工号稳定排序，最多展示三人。","合法0元计订单但零累计金额不参榜；重复订单、待计算、异常、不发放不重复计入。","展示本人数据及前三名允许字段，不新增他人明细入口，不取消身份校验。","覆盖不足三人、无人、本人无排名、加载、失败和更新时间；明确演示数据。","同步首页契约、有限展示例外及页面说明；不改其他业务场景。"];
const fail=message=>Object.assign(Error(message),{status:409});
export function readSafe(root,relative){
 const absolute=path.join(root,relative),parent=fs.realpathSync(path.dirname(absolute));
 if(parent!==path.dirname(absolute)||(parent!==fs.realpathSync(root)&&!parent.startsWith(fs.realpathSync(root)+path.sep)))throw fail("文件路径发生变化，请核查。");
 if(!fs.existsSync(absolute)){try{fs.lstatSync(absolute);throw fail("不允许符号链接。");}catch(e){if(e.code!=="ENOENT")throw e;}return null;}
 const stat=fs.lstatSync(absolute);if(!stat.isFile()||stat.nlink!==1||stat.size>300000)throw fail("目标不是安全的普通文件或过大。");
 return fs.readFileSync(absolute,"utf8");
}
export function readRecord(root,requirementId="CR-029"){return JSON.parse(fs.readFileSync(path.join(root,"docs/requirements/registry.json"),"utf8")).requirements.find(x=>x.id===requirementId);}
export function implementationTargets(record){
 const proposed=record.id==="CR-029"?targets:(record.workbenchAnalysis?.result?.targets||[]);
 if(record.workbenchTemplate?.deliveryMode==="strategy-artifact"){
  const docs=proposed.filter(file=>/^docs\/(?:review|prd|governance|state-machine-design)\/[^/]+\.md$/.test(file));
  return [...new Set([...docs,`docs/review/${record.id}-${record.requirementType}-delivery.md`])];
 }
 return [...new Set(proposed)].filter(file=>/^(prototype\/src\/|docs\/[^/]*(?:page-guides|页面说明)|docs\/[\w-]+-page-guides\/)/.test(file)&&/\.(jsx?|css|md)$/.test(file));
}
export function prepareImplementation(root,cli,requirementId="CR-029"){
 const record=readRecord(root,requirementId);
 if(!record)throw fail("需求不存在");
 const review=businessReview(record),blockers=[];
 const strategyArtifact=record.workbenchTemplate?.deliveryMode==="strategy-artifact";
 if(record.workbenchTemplate&&record.workbenchTemplate.deliveryMode!=="prototype"&&!strategyArtifact)blockers.push("该类型执行策略尚未接入");
 if(!review.receipt)blockers.push("当前业务方案尚未确认或已变化");
 if(review.receipt?.items.some(x=>x.choice!=="adopt"))blockers.push("修改后的业务意见需要 AI 重新核对");
 if(!review.eligible&&!record.workbenchImplementationAuthorization)blockers.push("回答、范围或任务状态已变化");
 if(record.pendingQuestions?.length)blockers.push("仍有业务问题未解决");
 if(!fs.existsSync(cli))blockers.push("本机 AI 处理能力暂不可用");
 const allowedTargets=implementationTargets(record);if(!allowedTargets.length)blockers.push("AI 尚未识别可安全交付的文件");
 const required=new Set(record.workbenchTemplate?.requiredStages||[]);
 if(required.has("prototype-update")&&!allowedTargets.some(file=>file.startsWith("prototype/src/")))blockers.push("本轮原型页面目标尚未确定");
 if(required.has("contract-update")&&!allowedTargets.some(file=>file.includes("/contracts/")))blockers.push("本轮必需的页面契约目标尚未确定");
 if(required.has("page-docs-update")&&!allowedTargets.some(file=>file.endsWith(".md")))blockers.push("本轮必需的页面说明目标尚未确定");
 const files=allowedTargets.map(file=>({path:file,content:readSafe(root,file)}));
 for(const required of allowedTargets)if(files.find(x=>x.path===required).content===null&&!(strategyArtifact&&required.endsWith("-delivery.md")))blockers.push(`缺少 ${required}`);
 const support=["AGENTS.md","prototype/AGENTS.md","docs/decisions/NEGATIVE_DECISIONS.md"].map(file=>({path:file,content:readSafe(root,file)}));
 const snapshot=files.map(x=>({path:x.path,hash:hash(x.content)}));
 const supportSnapshot=support.map(x=>({path:x.path,hash:hash(x.content)}));
 const template=record.workbenchTemplate,adjustment=record.requirementType==="existing-page-adjustment",plan={title:`${record.id} · ${record.title}${strategyArtifact?"需求成果":adjustment?"页面调整":"工程化原型"}`,mode:strategyArtifact?"strategy-artifact":"prototype-only",requirementType:record.requirementType||"frontend-feature",reviewMode:strategyArtifact?"deliverable":adjustment?"before-after":"prototype",scope:review.plan.scope,excluded:[...review.plan.excluded,...(strategyArtifact?template?.implementationAuthorization?.excludes:template?.prototypeAuthorization?.excludes||["不接真实接口、数据库、生产鉴权或服务器","不提交或发布"])],acceptance:record.id==="CR-029"?acceptance:(review.plan.acceptance?.length?review.plan.acceptance:template?.defaultAcceptance||[]),targets:allowedTargets,risk:strategyArtifact?"中等：仅可修改上方精确列出的本地需求成果文档；结果待产品经理验收。":"中等：仅在上方精确文件范围内制作原型；内容变化即停止，完成后必须预览确认。",dependency:"不接入生产数据、真实接口，不提交、部署或发布。"};
 const basis=hash([review.basis,review.receipt,snapshot,supportSnapshot,plan]);
 return {record,files,support,plan,basis,snapshot,supportSnapshot,blockers,ready:blockers.length===0,version:hash(record)};
}
export async function writeRecord(root,runtime,updater,requirementId="CR-029"){
 fs.mkdirSync(runtime,{recursive:true,mode:0o700});const lock=path.join(runtime,"scope-confirmation.lock");
 let fd;try{fd=fs.openSync(lock,"wx",0o600);}catch{throw fail("台账正在保存或需核查旧写锁，请刷新；不会覆盖。");}fs.closeSync(fd);
 try{
  const filename=path.join(root,"docs/requirements/registry.json"),poolPath=path.join(root,"docs/需求池.md"),raw=fs.readFileSync(filename,"utf8"),pool=fs.readFileSync(poolPath,"utf8"),registry=JSON.parse(raw);
  if(registry.project.id!=="cx-recycle")throw fail("项目不匹配");
  const index=registry.requirements.findIndex(x=>x.id===requirementId);if(index<0)throw fail("需求不存在");
  let updated=updater(registry.requirements[index]);
  if(updated.workbenchLifecycle?.state==="executing"&&updated.taskControl?.executionState==="waiting-human"&&updated.workbenchImplementationAuthorization?.status==="awaiting-review"){
   updated=transitionLifecycle(updated,"awaiting-review",{actor:"AI 执行端",event:"本轮成果已写入，等待产品经理验收"});
  }else if(updated.workbenchLifecycle?.state==="executing"&&updated.taskControl?.executionState==="in-progress"&&updated.workbenchLifecycle.activity!=="running"){
   updated=transitionLifecycle(updated,"executing",{activity:"running",actor:"AI 执行端",event:"已开始执行本轮授权任务"});
  }
  registry.requirements[index]=updated;
  const workflow=await import(pathToFileURL(path.join(root,"prototype/scripts/workflow-data.mjs")).href),map=JSON.parse(fs.readFileSync(path.join(root,"docs/requirements/page-document-map.json"),"utf8"));
  const checked=await workflow.validateWorkflowData(registry,map);if(!checked.valid)throw fail("台账校验未通过，未保存本次操作");
  const id=randomUUID();atomicJson(path.join(runtime,`implementation-backup-${id}.json`),{registry:raw,pool});
  if(fs.readFileSync(filename,"utf8")!==raw||fs.readFileSync(poolPath,"utf8")!==pool)throw fail("台账被其他操作修改，已停止。");
  atomicJson(filename,registry);const temp=`${poolPath}.${id}.tmp`;fs.writeFileSync(temp,workflow.renderRequirementPool(registry),{flag:"wx"});fs.renameSync(temp,poolPath);
  return registry.requirements[index];
 }finally{fs.unlinkSync(lock);}
}
export function authorizeRecord(record,prepared,id,time){
 if(hash(record)!==prepared.version||!prepared.ready||record.workbenchImplementationAuthorization)throw fail("原型范围已变化或已存在授权，请刷新核查。");
 const next=structuredClone(record);
 const artifact=prepared.plan.mode==="strategy-artifact";
 next.workbenchImplementationAuthorization={id,basis:prepared.basis,authorizedAt:time,authorizedBy:"产品经理（本机工作台）",plan:prepared.plan,status:"authorized"};
 next.taskControl.aiPolicy="execution-allowed";next.taskControl.executionState="ready";next.taskControl.waitingReason=null;
 next.taskControl.executionScope={mode:"full-sync",label:artifact?`${record.id} 本轮需求成果文档；不接生产`:`${record.id} 本轮前端原型与说明；不接生产`,allowedArtifactTypes:artifact?["plan","decision","review-report","test-report"]:["plan","decision","contract","prototype","page-guide","test-report"],deferredArtifactTypes:["commit","release"],authorizationBasis:[`本机工作台授权 ${id} · ${time} · 精确范围见 workbenchImplementationAuthorization`]};
 const proof={"goal-clear":`本轮仅${artifact?"整理需求成果":"制作工程化原型"}：${record.title}`,"scope-clear":prepared.plan.scope.join("；"),"acceptance-testable":prepared.plan.acceptance.join("；"),"dependencies-clear":prepared.plan.dependency,"rules-confirmed":"当前业务方案已确认；本轮成果按确认方案整理","risk-reviewed":prepared.plan.risk,"authorization-confirmed":`产品经理明确授权本轮${artifact?"需求成果":"原型制作"} ${id}`};
 next.taskControl.readinessChecklist=next.taskControl.readinessChecklist.map(x=>({...x,status:"met",evidence:[`仅本轮授权：${proof[x.id]}`]}));
 next.evidence.push({type:"note",reference:`${artifact?"需求成果":"原型制作"}授权 ${id} · ${time}；仅限本轮精确文件范围，不授权正式研发、生产或发布。`});
 return transitionLifecycle(next,"executing",{time,activity:"submitted",actor:"产品经理",event:`已授权${artifact?"整理需求成果":"制作本轮原型"}`});
}
export function validateEdits(prepared,result){
 if(!result||typeof result.summary!=="string"||!result.summary.trim()||result.summary.length>4000||!Array.isArray(result.edits)||!result.edits.length||result.edits.length>40)throw fail("未返回有效修改方案。");
 if(prepared.plan.reviewMode==="before-after"&&(!Array.isArray(result.comparison)||!result.comparison.length||result.comparison.length>12||result.comparison.some(item=>typeof item?.before!=="string"||typeof item?.after!=="string"||!item.before.trim()||!item.after.trim()||item.before.length>500||item.after.length>500)))throw fail("页面调整缺少可核对的修改前后说明。");
 const output=new Map(prepared.files.map(x=>[x.path,x.content]));
 for(const edit of result.edits){if(!prepared.plan.targets.includes(edit.path)||typeof edit.before!=="string"||typeof edit.after!=="string"||edit.after.length>150000)throw fail("修改超出授权文件范围。");const current=output.get(edit.path);if(current===null){if(edit.before!==""||!edit.after.trim())throw fail("新文件内容无效。");output.set(edit.path,edit.after);}else{if(!edit.before||current.split(edit.before).length!==2)throw fail("修改位置不唯一或已变化。");output.set(edit.path,current.replace(edit.before,()=>edit.after));}}
 return [...output].filter(([file,content])=>content!==prepared.files.find(x=>x.path===file).content).map(([path,content])=>({path,content}));
}
