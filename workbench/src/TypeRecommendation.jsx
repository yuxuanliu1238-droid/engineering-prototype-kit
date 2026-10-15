import {useEffect,useRef,useState} from "react";
import {getRequirementTemplate} from "./requirement-templates";

const tagNames={"frontend-page":"前端页面","backend-logic":"后台业务逻辑","state-data":"状态与数据","external-interface":"外部接口","requirement-document":"需求文档"};

export default function TypeRecommendation({description,projectName,onAdopt,disabled=false}){
  const [job,setJob]=useState(null),[error,setError]=useState("");
  const requestId=useRef(null),submittedText=useRef("");
  const clean=description.trim();
  const stale=Boolean(job&&submittedText.current!==clean);
  const running=job&&["submitted","running"].includes(job.status);
  useEffect(()=>{
    if(!running)return;
    let active=true;
    const poll=async()=>{try{const response=await fetch(`/api/type-recommendations/${job.id}`,{cache:"no-store",signal:AbortSignal.timeout(8000)}),data=await response.json();if(active&&response.ok)setJob(data.job);}catch{if(active)setError("建议状态暂时无法读取，草稿仍在页面。");}};
    const timer=setInterval(poll,3000);poll();return()=>{active=false;clearInterval(timer);};
  },[job?.id,job?.status]);
  async function request(){
    if(running||disabled||clean.length<2)return;
    if(submittedText.current!==clean)requestId.current=crypto.randomUUID();
    requestId.current ||= crypto.randomUUID();submittedText.current=clean;setError("");
    try{const response=await fetch("/api/type-recommendations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId:requestId.current,description:clean,projectName,confirmRecommendationOnly:true}),signal:AbortSignal.timeout(15000)}),data=await response.json();
      if(!response.ok)throw Error(data.message||"暂时无法获取建议。");setJob(data.job);
    }catch(cause){setError(cause.message);}
  }
  const recommendation=job?.status==="completed"&&!stale?job.recommendation:null;
  const template=recommendation&&getRequirementTemplate(recommendation.mainType);
  return <section className="type-recommendation" aria-label="AI 需求分类建议">
    <div className="type-recommendation-heading"><div><strong>不确定选哪类？</strong><p>AI 可以只看描述，建议主类型和影响范围。</p></div><button className="button secondary" type="button" onClick={request} disabled={disabled||running||clean.length<2}>{running?"AI 正在判断…":stale?"按新描述重新建议":"获取 AI 建议"}</button></div>
    <small>这一步会消耗 Codex 额度；不登记需求，也不启动项目执行。建议由你决定是否采用。</small>
    {running&&<p className="type-recommendation-running" role="status"><span className="running-dot"/>AI 正在判断需求核心变化</p>}
    {stale&&<p className="snapshot-note">需求描述已改变，原建议不再适用。</p>}
    {recommendation&&<div className="type-recommendation-result"><p><strong>建议：{template?.name||recommendation.mainType}</strong><span>影响：{recommendation.impactTags.map(tag=>tagNames[tag]||tag).join("、")||"暂无"}</span></p><p>{recommendation.reason}</p>{recommendation.suggestSplit&&<div className="split-suggestion"><strong>建议拆成可独立验收的需求</strong><ul>{recommendation.parts.map(part=><li key={part.name}>{part.name}</li>)}</ul><small>依据：这些事项能够分别实施、回滚和验收；最终仍由你决定是否拆分。</small></div>}<button className="button primary" type="button" disabled={disabled} onClick={()=>onAdopt(recommendation)}>采用 AI 建议</button></div>}
    {job?.status==="needs-attention"&&<p role="alert" className="form-error">{job.message}。你仍可手动选择。</p>}
    {error&&<p role="alert" className="form-error">{error}</p>}
  </section>;
}
