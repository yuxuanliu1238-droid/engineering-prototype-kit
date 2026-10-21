import assert from "node:assert/strict";
import { readFile, mkdtemp, symlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createBusinessProject } from "./project-generator-lib.mjs";
import { resolveReview, sourceLink, validateReviewContent } from "../templates/business-project/runtime/prototype/src/comparison-model.js";
const root = path.resolve(new URL("..", import.meta.url).pathname);
const template = JSON.parse(await readFile(path.join(root, "templates/business-project/runtime/prototype/src/comparison-content.json"), "utf8"));
assert.deepEqual(validateReviewContent(template), []);
assert.deepEqual(template.sections, []); // No customer document or invented rules shipped.
const content = { ...template, sections: ["page", "detail", "edit", "engine", "global", "unmapped"].map((id) => ({ id, title:id, body:id })), pageMappings: [
 {page:"records",sectionId:"page",relatedSectionIds:["engine","page","engine"]},
 {page:"records",detail:"present",sectionId:"detail"},
 {page:"records",detail:"present",mode:"edit",sectionId:"edit"},
], actionMappings:[{action:"recalculate",sectionId:"engine"}],globalSectionIds:["global"] };
assert.deepEqual(validateReviewContent(content), []);
assert.equal(resolveReview(content,{page:"records"}).current.id,"page");
assert.equal(resolveReview(content,{page:"records",detailId:"A"}).current.id,"detail");
assert.equal(resolveReview(content,{page:"records",detailId:"A",mode:"edit"}).current.id,"edit");
assert.equal(resolveReview(content,{page:"records"},"recalculate").current.id,"engine");
assert.equal(resolveReview(content,{page:"records"},null).current.id,"page");
assert.equal(resolveReview(content,{page:"unknown"}).current,null);
assert.deepEqual(resolveReview(content,{page:"records"}).related.map(x=>x.id),["engine","page"]);
assert.equal(resolveReview(content,{}).global[0].id,"global");
assert.ok(content.sections.some(x=>x.id==="unmapped"));
assert.ok(validateReviewContent({...content,globalSectionIds:["missing"]}).length);
assert.ok(validateReviewContent({...content,sections:[...content.sections,content.sections[0]]}).length);
assert.equal(sourceLink("javascript:alert(1)"),null);
assert.ok(validateReviewContent({...content,demoEntry:"https://example.com"}).length);
const sandbox = await mkdtemp(path.join(os.tmpdir(),"kit-comparison-test-"));
await createBusinessProject({name:"对照评审测试",output:sandbox,mode:"rapid-validation",recommendationReason:"验证通用对照展示",confirmedBy:"本轮测试",validationFocuses:"prototype-presentation",primaryValidationFocus:"prototype-presentation",validationRecommendationReason:"验证模板入口",inputSufficiency:"partial",inputSufficiencyReason:"仅使用空白通用模板",inputKnown:["入口"],inputMissing:["业务正文"],inputCanProceed:["通用展示"],inputRequiresConfirmation:["业务规则"],inputMustNotDo:["确认业务规则"],reviewCenterEnabled:true,reviewCenterReason:"测试展示"});
const generatedManifest = JSON.parse(await readFile(path.join(sandbox,".prototype-kit/manifest.json"),"utf8"));
for (const name of ["comparison-content.json","comparison-review.jsx","comparison-review.css","comparison-model.js","comparison-bridge.js"]) assert.ok(generatedManifest.files.some(f=>f.path===`prototype/src/${name}` && f.ownership==="business"));
await symlink(path.join(root,"node_modules"),path.join(sandbox,"node_modules"),"dir");
await symlink(path.join(root,"prototype/node_modules"),path.join(sandbox,"prototype/node_modules"),"dir");
execFileSync(process.execPath,[path.join(root,"prototype/node_modules/vite/bin/vite.js"),"build"],{cwd:path.join(sandbox,"prototype"),stdio:"pipe"});
console.log(`对照评审模型、边界、快速验证项目分发和生成项目构建通过：${sandbox}`);
