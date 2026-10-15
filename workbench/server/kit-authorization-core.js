import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {REQUIREMENT_TYPES,IMPACT_TAGS} from "../../scripts/workflow-v3-lib.mjs";
import {appendKitProgress} from "./kit-progress.js";
import {advanceKitLifecycle} from "./kit-lifecycle.js";

const hash=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function buildKitAuthorizationPlan(projectRoot,record){
  const scheme=record.workbenchScheme,profile=REQUIREMENT_TYPES[record.requirementType];
  if(record.currentStageId!=="awaiting-authorization"||!scheme||!profile||record.workbenchAuthorization)
    return {canAuthorize:false,reasons:["需求尚未处于独立实施授权状态。"]};
  const root=fs.realpathSync(projectRoot),reasons=[],existingFiles=[];
  for(const relative of scheme.targets||[]){
    if(typeof relative!=="string"||relative.startsWith("/")||relative.includes("..")||relative.includes("\\")){
      reasons.push("分析目标文件路径不安全。");continue;
    }
    const full=path.join(root,relative);
    try{const real=fs.realpathSync(full),stat=fs.lstatSync(full);
      if(!real.startsWith(root+path.sep)||!stat.isFile())throw Error("UNSAFE_TARGET");
      existingFiles.push({path:relative,sha256:createHash("sha256").update(fs.readFileSync(real)).digest("hex")});
    }catch{reasons.push(`建议目标未能核查：${relative}`);}
  }
  if(record.impactTags?.includes("frontend-page")&&!existingFiles.some(file=>file.path.startsWith("prototype/src/")))
    reasons.push("尚未定位可核查的受影响原型页面，不能授权原型修改。");
  const delivery=`docs/review/${record.id}-${record.requirementType}-delivery.md`;
  const target=path.join(root,delivery);
  const deliveryExists=fs.existsSync(target);
  if(deliveryExists){
    try{const real=fs.realpathSync(target),stat=fs.lstatSync(target);
      if(!real.startsWith(root+path.sep)||!stat.isFile())throw Error("UNSAFE_DELIVERY");
      if(!existingFiles.some(file=>file.path===delivery))existingFiles.push({path:delivery,sha256:createHash("sha256").update(fs.readFileSync(real)).digest("hex")});
    }catch{reasons.push("既有交付说明文件无法安全核查，不能覆盖。");}
  }
  const branches=(record.impactTags||[]).map(tag=>IMPACT_TAGS[tag]?.label).filter(Boolean);
  const plan={requirementId:record.id,requirementType:record.requirementType,impactTags:[...record.impactTags],
    objective:scheme.summary,confirmedScope:[...scheme.scope],excludedScope:[...scheme.excluded],
    acceptance:[...scheme.acceptance],outputs:[...profile.outputs],branches,
    existingFiles,createFiles:deliveryExists?[]:[delivery],deliveryFile:delivery,
    excludes:["未列明的项目文件","正式业务代码、生产接口与数据","提交、部署和发布"]};
  return {...plan,planHash:hash(plan),canAuthorize:reasons.length===0,reasons};
}

export function authorizeKitRequirement(record,plan,{requestId,confirmedBy="产品经理",time=new Date().toISOString()}={}){
  if(!plan?.canAuthorize||record.currentStageId!=="awaiting-authorization"||
    record.executionState!=="waiting-human"||record.workbenchAuthorization||!record.workbenchScheme)
    throw Error("AUTHORIZATION_NOT_READY");
  const next=structuredClone(record),ref=`docs/requirements/registry.json#${record.id}.workbenchAuthorization.v${record.workbenchScheme.version||1}`;
  next.workbenchAuthorization={requestId,confirmedAt:time,confirmedBy,planHash:plan.planHash,
    requirementType:plan.requirementType,impactTags:plan.impactTags,existingFiles:plan.existingFiles,
    createFiles:plan.createFiles,deliveryFile:plan.deliveryFile,allowedOutputs:plan.outputs,acceptance:plan.acceptance,
    scope:plan.confirmedScope,excluded:plan.excludedScope,limits:plan.excludes,
    implementationStarted:false};
  next.workbenchScheme.implementationAuthorized=true;
  next.aiPolicy="execution-allowed";next.executionState="ready";next.waitingReason=null;
  next.readinessChecklist=next.readinessChecklist.map(check=>{
    if(check.id==="authorization-confirmed")return {...check,status:"met",evidence:[ref]};
    if(check.id==="dependencies-clear")return {...check,status:"not-applicable",evidence:["本轮只限本机工程化交付物；生产对接另行授权"]};
    return check;
  });
  next.evidence.push({id:`EV-${record.id}-authorization-v${next.workbenchScheme.version||1}`,sourceType:"review",location:ref,
    originalClaim:"产品经理单独授权本轮列明的工程化交付物，不含生产发布。",
    aiInterpretation:`允许文件：${[...plan.existingFiles.map(file=>file.path),...plan.createFiles].join("、")}`,
    scope:"本轮实施授权",confirmationStatus:"confirmed",occurredAt:time,confirmedBy,confirmedAt:time});
  next.artifacts.push({type:"review-confirmation",location:ref,supports:[plan.acceptance[0]]});
  appendKitProgress(next,{id:`authorization:${requestId}`,at:time,actor:confirmedBy,action:"授权实施",
    result:`仅授权 ${plan.existingFiles.length+plan.createFiles.length} 个列明文件；尚未开工。`,
    authorization:true,nextActor:"产品经理"});
  advanceKitLifecycle(next,"awaiting-authorization",{time,actor:confirmedBy,event:"本轮实施范围已授权；等待明确启动"});
  return next;
}
