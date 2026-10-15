import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { buildDetailSnapshot } from "../src/requirement-detail-model.js";
import { validateSourceSnapshot } from "../src/source-refresh.js";
import {resolvePageGuide,writePageGuide} from "./page-guide-source.js";

export const PAGE_GUIDE_ENDPOINT="/api/read-only/cx-recycle/requirements/CR-029/page-guide";
const PAGE_GUIDE_HEADING="## 16. CR-029";
const pageGuideVersion=raw=>createHash("sha256").update(raw).digest("hex");

async function readBody(req){
  let raw="";
  for await(const chunk of req){raw+=chunk;if(raw.length>200_000)throw Error("BODY_TOO_LARGE");}
  return JSON.parse(raw||"{}");
}

async function readPageGuide(projectRoot){
  const file=path.join(projectRoot,"docs/courier-page-guides/01-小哥H5推广流程-页面功能说明.md");
  const raw=await fs.readFile(file,"utf8"),start=raw.indexOf(PAGE_GUIDE_HEADING);
  if(start<0)throw Error("SECTION_MISSING");
  return {file,raw,start,content:raw.slice(start).trim(),version:pageGuideVersion(raw)};
}

export async function readSourceSnapshot(projectRoot) {
  const root=await fs.realpath(projectRoot);
  const registryPath=await fs.realpath(path.join(root,"docs/requirements/registry.json"));
  if (!registryPath.startsWith(root+path.sep)) throw new Error("OUTSIDE_PROJECT");
  const handle=await fs.open(registryPath,"r");
  let raw;
  try { if ((await handle.stat()).size > 5*1024*1024) throw new Error("SOURCE_TOO_LARGE"); raw=await handle.readFile("utf8"); }
  finally {await handle.close();}
  const registry=JSON.parse(raw);
  if (registry.project?.id !== "cx-recycle" || !Array.isArray(registry.requirements)) throw new Error("INVALID_SOURCE");
  const snapshot=buildDetailSnapshot(registry,{source:"docs/requirements/registry.json",readAt:new Date().toISOString(),sha256:createHash("sha256").update(raw).digest("hex")});
  for (const item of snapshot.items) for (const evidence of item.evidence) {
    if (evidence.type !== "file") continue;
    const target=path.resolve(root,evidence.reference);
    evidence.exists=null;
    if (!target.startsWith(root+path.sep)) continue;
    try {const real=await fs.realpath(target);if(real.startsWith(root+path.sep))evidence.exists=(await fs.stat(real)).isFile();}
    catch(error) {if(error.code === "ENOENT")evidence.exists=false;else throw error;}
  }
  return validateSourceSnapshot(snapshot);
}

export function sourceReaderPlugin(projectRoot) {
  const register = server => {
    server.middlewares.use(async (req,res,next) => {
      const url=new URL(req.url,"http://localhost");
      const guideMatch=/^\/api\/read-only\/cx-recycle\/requirements\/(CR-\d{3,})\/page-guide$/.exec(url.pathname);
      if(url.pathname!=="/api/read-only/cx-recycle/requirements"&&!guideMatch) return next();
      res.setHeader("Content-Type","application/json; charset=utf-8");
      res.setHeader("Cache-Control","no-store");
      res.setHeader("X-Content-Type-Options","nosniff");
      const host=req.headers.host || "";
      const local=/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host);
      if(!local || (req.headers.origin && req.headers.origin !== `http://${host}`) || req.headers["sec-fetch-site"] === "cross-site") {res.statusCode=403;res.end(JSON.stringify({error:"LOCAL_ONLY"}));return;}
      if(url.search) {res.statusCode=400;res.end(JSON.stringify({error:"FIXED_SOURCE_ONLY"}));return;}
      try {
        if(guideMatch){
          const requirementId=guideMatch[1];
          if(req.method==="GET"){
            const guide=resolvePageGuide(projectRoot,requirementId);
            res.end(JSON.stringify({title:guide.title,source:guide.source,content:guide.content,version:guide.version}));return;
          }
          if(req.method==="POST"){
            if(req.headers.origin!==`http://${host}`||!String(req.headers["content-type"]||"").startsWith("application/json")){res.statusCode=403;res.end(JSON.stringify({error:"WORKBENCH_ONLY",message:"请从本机工作台保存页面说明。"}));return;}
            const body=await readBody(req),guide=resolvePageGuide(projectRoot,requirementId),content=String(body.content||"").trim();
            if(body.confirmPageGuideEdit!==true||typeof body.requestId!=="string") {res.statusCode=400;res.end(JSON.stringify({error:"CONFIRMATION_REQUIRED",message:"请明确保存本次页面说明修改。"}));return;}
            if(body.version!==guide.version){res.statusCode=409;res.end(JSON.stringify({error:"VERSION_CONFLICT",message:"页面说明已更新，请重新打开后再修改。"}));return;}
            if(content.length<40||content.length>100_000||!content.includes(requirementId)){res.statusCode=400;res.end(JSON.stringify({error:"INVALID_CONTENT",message:`请保留 ${requirementId} 标题并填写完整页面说明。`}));return;}
            const saved=writePageGuide(guide,content);
            res.end(JSON.stringify({title:saved.title,source:saved.source,content:saved.content,version:saved.version,savedAt:new Date().toISOString()}));return;
          }
          res.statusCode=405;res.setHeader("Allow","GET, POST");res.end(JSON.stringify({error:"METHOD_NOT_ALLOWED"}));return;
        }
        if(req.method !== "GET") {res.statusCode=405;res.setHeader("Allow","GET");res.end(JSON.stringify({error:"READ_ONLY"}));return;}
        res.end(JSON.stringify(await readSourceSnapshot(projectRoot)));
      }
      catch {res.statusCode=503;res.end(JSON.stringify({error:"SOURCE_UNAVAILABLE",message:"台账无法读取或格式异常，请保留上一份数据后重试。"}));}
    });
  };
  return {name:"cx-source-reader",configureServer:register,configurePreviewServer:register};
}
