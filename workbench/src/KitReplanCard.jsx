import {useEffect,useRef,useState} from "react";
import {requirementTemplates} from "./requirement-templates";

const TAGS=[["frontend-page","前端页面"],["backend-logic","后台业务逻辑"],["state-data","状态与数据"],["external-interface","外部接口"],["requirement-document","需求文档"]];

export default function KitReplanCard({projectId,item,registrySha256,onSaved}){
  const expanded=item.workbenchAdjustmentRequests?.at(-1);
  const active=expanded?.status==="scope-expansion"&&item.stageId==="awaiting-review";
  const [description,setDescription]=useState(expanded?.text||""),[type,setType]=useState(item.requirementType),
    [tags,setTags]=useState(item.impactTags||[]),[job,setJob]=useState(null),[answers,setAnswers]=useState([]),
    [adoptAll,setAdoptAll]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const requestId=useRef(null),endpoint=`/api/projects/${projectId}/requirements/${item.id}/replan`;
  async function load(){try{const response=await fetch(endpoint,{cache:"no-store",signal:AbortSignal.timeout(10000)}),data=await response.json();
    if(!response.ok)throw Error(data.message||"重新分析状态暂时无法读取。");setJob(data.job);setError("");
  }catch(cause){setError(cause.message);}}
  useEffect(()=>{if(active)load();},[active,endpoint,registrySha256]);
  useEffect(()=>{if(!active||!["submitted","running"].includes(job?.status))return;
    const timer=setInterval(load,3000);return()=>clearInterval(timer);},[active,job?.status,endpoint]);
  if(!active)return null;
  async function start(){if(busy||job&&job.status!=="needs-attention")return;requestId.current=crypto.randomUUID();setBusy(true);setError("");
    try{const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({requestId:requestId.current,registrySha256,confirmReadOnlyAnalysis:true,
        expandedDescription:description.trim(),requirementType:type,impactTags:tags}),signal:AbortSignal.timeout(15000)}),data=await response.json();
      if(!response.ok)throw Error(data.message||"重新分析未能启动。");setJob(data.job);
    }catch(cause){setError(cause.message+" 请核查当前状态，不会自动重复启动。");await load();}finally{setBusy(false);}}
  async function confirm(){if(busy||job?.status!=="completed"||(!adoptAll&&answers.filter(answer=>answer?.trim()).length!==job.result.questions.length))return;
    setBusy(true);setError("");try{const response=await fetch(`${endpoint}/confirm`,{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({requestId:crypto.randomUUID(),analysisId:job.id,registrySha256,confirmReplannedSchemeOnly:true,
        adoptAllRecommendations:adoptAll,answers:adoptAll?[]:answers.map(answer=>answer.trim())}),signal:AbortSignal.timeout(15000)}),data=await response.json();
      if(!response.ok)throw Error(data.message||"新方案未能确认。");await onSaved?.();
    }catch(cause){setError(cause.message+" 请核查台账，不会自动授权实施。");}finally{setBusy(false);}}
  return <section className="kit-analysis-card kit-replan-card" aria-label="扩大范围重新确认">
    <strong>调整超出原授权 · 需要重新确认</strong><p>旧成果与授权保留为历史，本轮先重新分析和确认业务方案，再单独授权。</p>
    {(!job||job.status==="needs-attention")&&<><label>本轮扩大范围的目标<textarea value={description} maxLength={3000} onChange={event=>setDescription(event.target.value)}/></label>
      <label>主类型<select value={type} onChange={event=>setType(event.target.value)}>{requirementTemplates.map(template=><option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
      <details><summary>影响范围 · {tags.length} 项</summary>{TAGS.map(([id,label])=><label key={id}><input type="checkbox" checked={tags.includes(id)} onChange={event=>setTags(previous=>event.target.checked?[...previous,id]:previous.filter(tag=>tag!==id))}/>{label}</label>)}</details>
      <button className="button primary" disabled={busy||description.trim().length<2||(type==="existing-page-adjustment"&&!tags.includes("frontend-page"))} onClick={start}>{job?"检查后重新分析":"重新分析调整范围"}</button>
      <small>只读分析，会消耗 Codex 额度；不修改项目，不继承旧授权。</small></>}
    {["submitted","running"].includes(job?.status)&&<p className="type-recommendation-running" role="status"><span className="running-dot"/>AI 正在重新分析 · {job.message}</p>}
    {job?.status==="completed"&&<div className="kit-analysis-result"><strong>新业务方案待确认</strong><p>{job.result.summary}</p>
      <details open><summary>本轮范围与验收</summary>{job.result.scope.map((text,index)=><p key={`scope-${index}`}>{text}</p>)}
        {job.result.excluded.map((text,index)=><p key={`excluded-${index}`}>不包含：{text}</p>)}
        {job.result.acceptance.map((text,index)=><p key={`acceptance-${index}`}>验收：{text}</p>)}
        <small>建议修改：{job.result.targets.join("、")||"尚未定位"}</small></details>
      {job.result.questions.length>0&&<><label className="implementation-consent"><input type="checkbox" checked={adoptAll} onChange={event=>setAdoptAll(event.target.checked)}/>全部采用 AI 建议</label>
        {!adoptAll&&job.result.questions.map((question,index)=><label key={index}>{question.question}<small>建议：{question.recommendation} · 影响：{question.impact}</small>
          <textarea value={answers[index]||""} maxLength={1000} onChange={event=>setAnswers(previous=>{const next=[...previous];next[index]=event.target.value;return next;})}/></label>)}</>}
      <button className="button primary" disabled={busy||(!adoptAll&&answers.filter(answer=>answer?.trim()).length!==job.result.questions.length)} onClick={confirm}>{busy?"正在确认…":"确认新业务方案"}</button>
      <small>确认后仍需单独授权本轮实施。</small></div>}
    {job?.status==="needs-attention"&&<p className="form-error" role="alert">{job.message}</p>}
    {error&&<p className="form-error" role="alert">{error}</p>}
  </section>;
}
