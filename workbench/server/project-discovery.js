import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {validateRegistryData} from "../../scripts/workflow-v3-lib.mjs";

const digest=value=>createHash("sha256").update(value).digest("hex");
const ignored=new Set(["node_modules",".git","dist",".local-analysis",".pnpm-store"]);

export function discoverKitProjects(workspaceRoot,{maxDepth=2}={}){
  const root=fs.realpathSync(workspaceRoot),found=[];
  function visit(directory,depth){
    if(depth>maxDepth)return;
    const entries=fs.readdirSync(directory,{withFileTypes:true});
    const names=new Set(entries.map(entry=>entry.name));
    if(names.has("project.config.json")&&names.has("project-status.json")){
      try{
        const configPath=path.join(directory,"project.config.json"),statusPath=path.join(directory,"project-status.json");
        const registryPath=path.join(directory,"docs/requirements/registry.json");
        for(const file of [configPath,statusPath,registryPath]){
          if(!fs.lstatSync(file).isFile()||!fs.realpathSync(file).startsWith(root+path.sep))throw Error("UNSAFE_PROJECT_FILE");
        }
        const config=JSON.parse(fs.readFileSync(configPath,"utf8"));
        const status=JSON.parse(fs.readFileSync(statusPath,"utf8"));
        if(config.instanceKind==="business-project"&&["rapid-validation","continuous-iteration"].includes(status.currentMode)&&
          fs.lstatSync(registryPath).isFile()){
          const source=fs.readFileSync(registryPath,"utf8"),registry=JSON.parse(source);
          if(registry.schemaVersion===3&&Array.isArray(registry.items)){
            found.push({id:`kit:${digest(path.relative(root,directory)).slice(0,12)}`,
              name:config.projectName||path.basename(directory),relativePath:path.relative(root,directory),
              mode:status.currentMode,adapter:"kit-v3",requirementCount:registry.items.length,
              registrySha256:digest(source),valid:validateRegistryData(registry).length===0});
          }
        }
      }catch{/* Invalid or partial project is not a connected workbench project. */}
    }
    for(const entry of entries){
      if(!entry.isDirectory()||ignored.has(entry.name)||entry.name.startsWith("."))continue;
      const child=path.join(directory,entry.name),real=fs.realpathSync(child);
      if(real===root||!real.startsWith(root+path.sep))continue;
      visit(child,depth+1);
    }
  }
  visit(root,0);
  return found.sort((a,b)=>a.name.localeCompare(b.name,"zh-CN"));
}

export function projectDiscoveryPlugin(workspaceRoot){
  return {name:"project-discovery",configureServer(server){server.middlewares.use("/api/projects",(req,res)=>{
    res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");
    const host=req.headers.host||"";
    if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)||
      (req.headers.origin&&req.headers.origin!==`http://${host}`)||req.headers["sec-fetch-site"]==="cross-site"){
      res.statusCode=403;return res.end(JSON.stringify({message:"仅允许本机工作台读取。"}));
    }
    if(req.method!=="GET"){res.statusCode=405;return res.end(JSON.stringify({message:"只允许查看。"}));}
    try{
      const url=new URL(req.url,"http://localhost"),projects=discoverKitProjects(workspaceRoot);
      if(url.search){res.statusCode=400;return res.end(JSON.stringify({message:"不支持查询参数。"}));}
      if(url.pathname==="/"||url.pathname==="")return res.end(JSON.stringify({projects}));
      const match=/^\/(kit:[a-f0-9]{12})\/requirements(?:\/(CR-\d{3,}))?$/.exec(url.pathname);
      const selected=projects.find(project=>project.id===match?.[1]);
      if(!selected){res.statusCode=404;return res.end(JSON.stringify({message:"项目未连接或不是连续需求项目。"}));}
      const root=fs.realpathSync(workspaceRoot),registryPath=path.join(root,selected.relativePath,"docs/requirements/registry.json");
      if(!fs.realpathSync(registryPath).startsWith(root+path.sep))throw Error("UNSAFE_REGISTRY");
      const raw=fs.readFileSync(registryPath,"utf8"),registry=JSON.parse(raw),errors=validateRegistryData(registry);
      if(errors.length){res.statusCode=422;return res.end(JSON.stringify({message:"项目台账校验未通过。",errors:errors.slice(0,10)}));}
      const items=registry.items.map(item=>({id:item.id,title:item.summary,originalRequest:item.originalRequest,
        stageId:item.currentStageId,executionState:item.executionState,requirementType:item.requirementType||null,
        impactTags:item.impactTags||[],pageIds:item.pageIds||[],documents:item.documents||[],
        activities:item.activities||[],artifacts:item.artifacts||[],openQuestions:item.openQuestions||[]}));
      for(const item of items){const source=registry.items.find(record=>record.id===item.id);
        item.workbenchScheme=source.workbenchScheme||null;item.workbenchAuthorization=source.workbenchAuthorization||null;
        item.workbenchImplementation=source.workbenchImplementation||null;}
      for(const item of items){const source=registry.items.find(record=>record.id===item.id);
        item.workbenchAcceptance=source.workbenchAcceptance||null;
        item.workbenchAdjustmentRequests=source.workbenchAdjustmentRequests||[];
        item.workbenchProgress=source.workbenchProgress||[];
        item.workbenchLifecycle=source.workbenchLifecycle||null;}
      const requirement=items.find(item=>item.id===match[2]);
      if(match[2]&&!requirement){res.statusCode=404;return res.end(JSON.stringify({message:"需求不在当前项目台账中。"}));}
      return res.end(JSON.stringify({project:selected,readAt:new Date().toISOString(),sha256:digest(raw),
        items:match[2]?[requirement]:items}));
    }
    catch{res.statusCode=503;return res.end(JSON.stringify({message:"本地项目暂时无法读取。"}));}
  });}};
}
