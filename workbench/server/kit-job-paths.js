import path from "node:path";
import {readJob} from "./analysis-core.js";

export function implementationDirectory(runtimeRoot,projectId,record){
  const version=record.workbenchScheme?.version||1;
  return version===1?path.join(runtimeRoot,"kit-implementation",projectId,record.id):
    path.join(runtimeRoot,"kit-implementation-rounds",projectId,record.id,`v${version}`);
}

export function readCurrentImplementationJob(runtimeRoot,projectId,record){
  const id=record.workbenchImplementation?.jobId;
  if(!id)return null;
  for(const directory of [implementationDirectory(runtimeRoot,projectId,record),
    path.join(runtimeRoot,"kit-adjustment",projectId,record.id,id)]){
    const job=readJob(directory);if(job?.id===id)return job;
  }
  return null;
}
