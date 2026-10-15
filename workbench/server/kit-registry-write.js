import fs from "node:fs";
import path from "node:path";
import {randomUUID,createHash} from "node:crypto";
import {renderRequirements,validateRegistryData} from "../../scripts/workflow-v3-lib.mjs";

export const registryHash=text=>createHash("sha256").update(text).digest("hex");

export function updateKitRegistry(projectRoot,runtimeRoot,projectId,expectedSha,mutate){
  const root=fs.realpathSync(projectRoot),registryPath=path.join(root,"docs/requirements/registry.json"),
    summaryPath=path.join(root,"docs/requirements/requirements.md"),lock=path.join(runtimeRoot,`${projectId}-registry.lock`);
  for(const file of [registryPath,summaryPath])if(!fs.lstatSync(file).isFile()||!fs.realpathSync(file).startsWith(root+path.sep))
    throw Error("UNSAFE_REGISTRY");
  fs.mkdirSync(runtimeRoot,{recursive:true,mode:0o700});
  fs.closeSync(fs.openSync(lock,"wx",0o600));let registryTemp,summaryTemp;
  try{
    const before=fs.readFileSync(registryPath,"utf8"),summaryBefore=fs.readFileSync(summaryPath,"utf8");
    if(registryHash(before)!==expectedSha)throw Error("REGISTRY_CHANGED");
    const registry=JSON.parse(before),next=mutate(registry);
    const errors=validateRegistryData(next);
    if(errors.length)throw Error(`REGISTRY_INVALID:${errors.slice(0,3).join("|")}`);
    const suffix=randomUUID(),nextRegistry=JSON.stringify(next,null,2)+"\n",nextSummary=renderRequirements(next);
    registryTemp=`${registryPath}.${suffix}.tmp`;summaryTemp=`${summaryPath}.${suffix}.tmp`;
    fs.writeFileSync(path.join(runtimeRoot,`${projectId}-${suffix}-registry-backup.json`),JSON.stringify({registry:before,summary:summaryBefore}),{flag:"wx",mode:0o600});
    fs.writeFileSync(registryTemp,nextRegistry,{flag:"wx"});fs.writeFileSync(summaryTemp,nextSummary,{flag:"wx"});
    if(fs.readFileSync(registryPath,"utf8")!==before||fs.readFileSync(summaryPath,"utf8")!==summaryBefore)
      throw Error("REGISTRY_CHANGED_BEFORE_SAVE");
    try{fs.renameSync(registryTemp,registryPath);fs.renameSync(summaryTemp,summaryPath);}
    catch{
      if(fs.readFileSync(registryPath,"utf8")===nextRegistry)fs.writeFileSync(registryPath,before);
      if(fs.readFileSync(summaryPath,"utf8")===nextSummary)fs.writeFileSync(summaryPath,summaryBefore);
      throw Error("PARTIAL_REGISTRY_SAVE");
    }
    return {registry:next,sha256:registryHash(nextRegistry)};
  }finally{
    for(const file of [registryTemp,summaryTemp])if(file)try{fs.unlinkSync(file);}catch{}
    try{fs.unlinkSync(lock);}catch{/* preserve lock for manual audit */}
  }
}
