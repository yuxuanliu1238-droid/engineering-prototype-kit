import {makeRequirementTemplatePreview} from "./requirement-template-preview";

export default function RequirementTemplatePreview({type,impactTags=[]}){
  const preview=makeRequirementTemplatePreview(type,impactTags);
  if(!preview)return null;
  return <details className="requirement-template-preview" open>
    <summary>该类型会自动准备什么</summary>
    <div className="template-preview-grid">
      <section><span>AI 重点分析</span><p>{preview.analyze.join("、")}</p></section>
      <section><span>默认交付</span><p>{preview.outputs.join("、")}</p></section>
      <section><span>只问业务问题</span><p>{preview.questions.join("、")}</p></section>
    </div>
    <div className="template-branches"><span>当前影响支线</span><p>{preview.branches.length?preview.branches.map(item=>`${item.label}：${item.output}`).join("；"):"尚未选择；不会额外加载支线。"}</p></div>
    <small>登记时会把当前模板版本写入需求；以后模板升级，不会悄悄改变这条需求的执行依据。</small>
  </details>;
}
