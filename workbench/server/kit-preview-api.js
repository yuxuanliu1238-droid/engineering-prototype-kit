import fs from "node:fs";
import path from "node:path";
import {discoverKitProjects} from "./project-discovery.js";
import {readCurrentImplementationJob} from "./kit-job-paths.js";
import {validateRegistryData} from "../../scripts/workflow-v3-lib.mjs";

const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",
  ".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".woff2":"font/woff2"};

export function kitPreviewPlugin(workspaceRoot,runtimeRoot){
  return {name:"kit-prototype-preview",configureServer(server){server.middlewares.use((req,res,next)=>{
    const url=new URL(req.url,"http://localhost"),match=/^\/api\/projects\/(kit:[a-f0-9]{12})\/requirements\/(CR-\d{3,})\/preview\/([0-9a-f-]{36})\/(.*)$/i.exec(url.pathname);
    if(!match)return next();
    res.setHeader("Cache-Control","no-store");const reply=(status,text)=>{res.statusCode=status;res.end(text);};
    const host=req.headers.host||"";
    if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)||
      (req.headers.origin&&req.headers.origin!==`http://${host}`)||req.headers["sec-fetch-site"]==="cross-site")
      return reply(403,"仅允许本机工作台预览。");
    if(req.method!=="GET"||url.search)return reply(405,"只允许查看预览。");
    try{
      const project=discoverKitProjects(workspaceRoot).find(item=>item.id===match[1]&&item.valid);
      if(!project)return reply(404,"项目未连接。");
      const registry=JSON.parse(fs.readFileSync(path.join(workspaceRoot,project.relativePath,"docs/requirements/registry.json"),"utf8"));
      if(validateRegistryData(registry).length)return reply(422,"项目台账需核查。");
      const record=registry.items.find(item=>item.id===match[2]);
      if(!record||!["awaiting-review","completed"].includes(record.currentStageId))return reply(404,"原型预览尚未形成。");
      const job=readCurrentImplementationJob(runtimeRoot,project.id,record);
      if(job?.status!=="completed"||job.id!==match[3]||!job.previewUrl)return reply(404,"原型预览尚未形成。");
      const root=fs.realpathSync(path.join(runtimeRoot,"kit-previews",project.id,match[2],job.id));
      const relative=match[4]||"index.html";
      if(relative.includes("..")||relative.includes("\\")||relative.startsWith("/"))return reply(403,"预览路径无效。");
      const target=path.join(root,relative),real=fs.realpathSync(target),stat=fs.lstatSync(target);
      if(!real.startsWith(root+path.sep)||!stat.isFile()||stat.size>5*1024*1024)return reply(403,"预览文件不可读取。");
      res.setHeader("Content-Type",mime[path.extname(target)]||"application/octet-stream");
      res.setHeader("Content-Security-Policy","default-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; frame-ancestors 'self'");
      return res.end(fs.readFileSync(real));
    }catch{return reply(404,"预览文件尚未可用。");}
  });}};
}
