import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {discoverKitProjects} from "../server/project-discovery.js";
import {makeEmptyRegistry} from "../../scripts/workflow-v3-lib.mjs";

const root=fs.mkdtempSync(path.join(os.tmpdir(),"kit-project-discovery-"));
try{
  for(const [name,mode] of [["快速验证项目","rapid-validation"],["持续迭代项目","continuous-iteration"]]){
    const directory=path.join(root,name);fs.mkdirSync(path.join(directory,"docs/requirements"),{recursive:true});
    fs.writeFileSync(path.join(directory,"project.config.json"),JSON.stringify({schemaVersion:2,instanceKind:"business-project",projectName:name}));
    fs.writeFileSync(path.join(directory,"project-status.json"),JSON.stringify({schemaVersion:2,currentMode:mode}));
    fs.writeFileSync(path.join(directory,"docs/requirements/registry.json"),JSON.stringify(makeEmptyRegistry()));
  }
  const projects=discoverKitProjects(root);
  assert.deepEqual(projects.map(project=>project.mode).sort(),["continuous-iteration","rapid-validation"]);
  assert(projects.every(project=>project.valid&&project.requirementCount===0));
  console.log("PASS: workbench discovers valid rapid-validation and continuous-iteration Kit projects");
}finally{fs.rmSync(root,{recursive:true,force:true});}
