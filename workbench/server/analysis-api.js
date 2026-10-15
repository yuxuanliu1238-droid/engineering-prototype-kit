import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { hash, canStart, readJob, publicJob, atomicJson, validRequirementId } from "./analysis-core.js";

const CLI = "/Applications/ChatGPT.app/Contents/Resources/codex";
export function analysisPlugin(projectRoot, runtimeRoot) {
  const directory = runtimeRoot;
  const worker = path.resolve(runtimeRoot,"../server/analysis-worker.js");
  const register = server => { server.middlewares.use(async (req,res,next) => {
    const url = new URL(req.url, "http://localhost");
    const match=/^\/api\/analysis\/cx-recycle\/(CR-\d{3,})$/.exec(url.pathname);
    if (!match) return next();
    const requirementId=match[1];
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const reply = (code, data) => {res.statusCode=code;res.end(JSON.stringify(data));};
    const host = req.headers.host || "";
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host) || req.headers["sec-fetch-site"] === "cross-site"
      || (req.headers.origin && req.headers.origin !== `http://${host}`)) return reply(403,{message:"仅允许本机工作台访问。"});
    if (url.search) return reply(400,{message:"不接受附加参数。"});
    if (!["GET","POST"].includes(req.method)) return reply(405,{message:"不支持此操作。"});
    try {
      const requirementDirectory=path.join(directory,requirementId);
      const job = readJob(requirementDirectory);
      if (req.method === "GET") return reply(200,{job:publicJob(job),available:fs.existsSync(CLI)});
      if (req.headers.origin !== `http://${host}` || req.headers["content-type"] !== "application/json") return reply(403,{message:"请从工作台确认启动。"});
      let body = "";
      for await (const chunk of req) {body += chunk; if (body.length > 2048) return reply(413,{message:"请求过大。"});}
      const input = JSON.parse(body);
      if (input.confirmAnalysisOnly !== true || !/^[a-f0-9]{64}$/.test(input.sourceHash || "")) return reply(400,{message:"缺少仅分析确认或台账版本。"});
      // The persistent directory is the single-use claim, shared by tabs and server processes.
      if (job) return reply(200,{job:publicJob(job)});
      const raw = fs.readFileSync(path.join(projectRoot,"docs/requirements/registry.json"),"utf8");
      const registry = JSON.parse(raw);
      const record = registry.requirements.find(item=>item.id===requirementId);
      if (registry.project.id !== "cx-recycle" || hash(raw) !== input.sourceHash || !canStart(record)) return reply(409,{message:"台账已变化或当前状态不允许启动，请先刷新需求台账。"});
      if (!fs.existsSync(CLI)) return reply(503,{message:"本机 AI 处理能力暂不可用，尚未开始分析。"});
      if(!validRequirementId(requirementId))return reply(400,{message:"需求编号无效。"});
      fs.mkdirSync(directory,{recursive:true,mode:0o700});
      try {fs.mkdirSync(requirementDirectory,{mode:0o700});} catch(error) {if(error.code === "EEXIST") return reply(409,{message:"已有启动记录，请刷新查看；不会重复派发。"});throw error;}
      const now = new Date().toISOString();
      const pending = {id:randomUUID(),requirementId,status:"submitted",createdAt:now,updatedAt:now,heartbeatAt:now,message:"已提交，等待 AI 开始分析。",events:[{time:now,label:"产品经理启动需求分析"}],sourceHash:input.sourceHash,recordHash:hash(record),projectRoot,cli:CLI};
      atomicJson(path.join(requirementDirectory,"run.json"),pending);
      const child = spawn(process.execPath,[worker,requirementDirectory],{detached:true,stdio:"ignore",env:process.env});
      child.on("error",()=>{atomicJson(path.join(requirementDirectory,"run.json"),{...pending,status:"failed",endedAt:new Date().toISOString(),message:"AI 分析未能启动。记录已保留，不会自动重试。"});});
      child.unref();
      return reply(202,{job:publicJob(pending)});
    } catch {return reply(503,{message:"启动记录或台账无法安全读取。未重复派发，请核查。"});}
  }); };
  return {name:"cx-analysis-dispatch",configureServer:register};
}
