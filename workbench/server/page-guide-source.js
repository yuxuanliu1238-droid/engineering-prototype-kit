import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";

export const pageGuideVersion=raw=>createHash("sha256").update(raw).digest("hex");
export function resolvePageGuide(projectRoot,requirementId){
  const registry=JSON.parse(fs.readFileSync(path.join(projectRoot,"docs/requirements/registry.json"),"utf8"));
  const record=registry.requirements.find(item=>item.id===requirementId);if(!record)throw Error("REQUIREMENT_MISSING");
  const legacy="docs/courier-page-guides/01-小哥H5推广流程-页面功能说明.md";
  const source=requirementId==="CR-029"?legacy:(record.workbenchImplementationAuthorization?.plan?.targets||record.workbenchAnalysis?.result?.targets||[]).find(file=>file.endsWith(".md")&&file.includes("page-guides"));
  if(!source)throw Error("PAGE_GUIDE_MISSING");
  const root=fs.realpathSync(projectRoot),file=fs.realpathSync(path.join(root,source));if(!file.startsWith(root+path.sep))throw Error("UNSAFE_PAGE_GUIDE");
  const stat=fs.statSync(file);if(!stat.isFile()||stat.size>1024*1024)throw Error("PAGE_GUIDE_TOO_LARGE");
  const raw=fs.readFileSync(file,"utf8"),pattern=new RegExp(`^##[^\\n]*${requirementId}[^\\n]*$`,`m`),match=raw.match(pattern);
  const start=match?.index??0,next=match?raw.slice(start+match[0].length).search(/\n##\s/):-1,end=match&&next>=0?start+match[0].length+next:raw.length;
  return {file,source,raw,start,end,content:raw.slice(start,end).trim(),version:pageGuideVersion(raw),title:`${requirementId} · 页面需求说明`,requirementId};
}
export function writePageGuide(guide,content){
  const suffix=guide.raw.slice(guide.end),next=`${guide.raw.slice(0,guide.start)}${content.trim()}${suffix?"\n":""}${suffix.replace(/^\n/,"")}`;
  const temp=`${guide.file}.${process.pid}.tmp`;fs.writeFileSync(temp,next,{flag:"wx"});fs.renameSync(temp,guide.file);return {...guide,raw:next,content:content.trim(),version:pageGuideVersion(next)};
}
