import {getRequirementTemplate} from "./requirement-templates.js";

const branchRules={
  "frontend-page":{label:"前端页面",output:"页面影响、原型与契约"},
  "backend-logic":{label:"后台业务逻辑",output:"后台逻辑影响"},
  "state-data":{label:"状态与数据",output:"状态与数据影响"},
  "external-interface":{label:"外部接口",output:"字段与兼容影响"},
  "requirement-document":{label:"需求文档",output:"产品需求说明"},
};

export function makeRequirementTemplatePreview(type,impactTags=[]){
  const template=getRequirementTemplate(type);
  if(!template)return null;
  return {analyze:[...template.executionStrategy.analyze],outputs:[...template.executionStrategy.outputs],
    questions:template.questionPolicy.ask.slice(0,3),branches:impactTags.map(tag=>branchRules[tag]).filter(Boolean)};
}
