import assert from "node:assert/strict";
import {requirementTemplates} from "../src/requirement-templates.js";
import {makeRequirementTemplatePreview} from "../src/requirement-template-preview.js";

for(const template of requirementTemplates){
  const preview=makeRequirementTemplatePreview(template.id,template.defaultImpactTags);
  assert(preview.analyze.length);assert(preview.outputs.length);assert(preview.questions.length);
}
const mixed=makeRequirementTemplatePreview("business-rule-validation",["backend-logic","external-interface","requirement-document"]);
assert.deepEqual(mixed.branches.map(item=>`${item.label}：${item.output}`),
  ["后台业务逻辑：后台逻辑影响","外部接口：字段与兼容影响","需求文档：产品需求说明"]);
console.log("PASS: all six requirement templates expose concise analysis, output, question and branch previews");
