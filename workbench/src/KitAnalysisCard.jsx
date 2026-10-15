import {useEffect,useRef,useState} from "react";

export default function KitAnalysisCard({projectId,item,registrySha256,onSaved}){
  const [job,setJob]=useState(null),[history,setHistory]=useState([]),[stale,setStale]=useState(false),[error,setError]=useState("");
  const [answers,setAnswers]=useState([]),[adoptAll,setAdoptAll]=useState(false),[confirming,setConfirming]=useState(false);
  const requestId=useRef(null),busy=useRef(false);
  const endpoint=`/api/projects/${projectId}/requirements/${item.id}/analysis`;
  async function load(){try{const response=await fetch(endpoint,{cache:"no-store",signal:AbortSignal.timeout(10000)}),data=await response.json();
    if(!response.ok)throw Error(data.message||"分析状态暂时无法读取。");setJob(data.job);setHistory(data.history||[]);setStale(data.stale);setError("");
  }catch(cause){setError(cause.message);}}
  useEffect(()=>{load();},[endpoint,registrySha256]);
  useEffect(()=>{if(!job||!["submitted","running"].includes(job.status))return;
    const timer=setInterval(load,3000);return()=>clearInterval(timer);},[job?.status,endpoint]);
  async function start(){if(busy.current||job&&job.status!=="needs-attention"||item.stageId!=="recorded")return;
    requestId.current=crypto.randomUUID();busy.current=true;setError("");
    try{const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({requestId:requestId.current,registrySha256,confirmAnalysisOnly:true}),signal:AbortSignal.timeout(15000)}),data=await response.json();
      if(!response.ok)throw Error(data.message||"分析未能启动。");setJob(data.job);
    }catch(cause){setError(cause.message+" 请先查看当前状态，不会自动重复启动。");await load();}
    finally{busy.current=false;}}
  async function confirmScheme(){if(busy.current||confirming||!job||job.status!=="completed"||stale||
      (!adoptAll&&answers.filter(answer=>answer?.trim()).length!==job.result.questions.length))return;
    requestId.current=crypto.randomUUID();busy.current=true;setConfirming(true);setError("");
    try{const response=await fetch(`/api/projects/${projectId}/requirements/${item.id}/scheme`,{method:"POST",
      headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId:requestId.current,analysisId:job.id,
        registrySha256,confirmSchemeOnly:true,adoptAllRecommendations:adoptAll,answers:adoptAll?[]:answers.map(answer=>answer.trim())}),
      signal:AbortSignal.timeout(15000)}),data=await response.json();
      if(!response.ok)throw Error(data.message||"方案未能确认。");await onSaved?.();
    }catch(cause){setError(cause.message+" 请刷新项目台账核查，不会自动重复确认或授权实施。");}
    finally{busy.current=false;setConfirming(false);}}
  const running=job&&["submitted","running"].includes(job.status);
  if(item.workbenchAdjustmentRequests?.at(-1)?.status==="scope-expansion"||item.workbenchAuthorization)return null;
  return <div className="kit-analysis-card">
    {item.workbenchScheme&&<div className="kit-analysis-result"><strong>业务方案已确认{item.workbenchAuthorization?"":" · 待你授权实施"}</strong><p>{item.workbenchScheme.summary}</p><small>确认时间：{new Date(item.workbenchScheme.confirmedAt).toLocaleString("zh-CN",{hour12:false})}；{item.workbenchAuthorization?"本轮授权已单独记录。":"尚未授权修改项目。"}</small></div>}
    {!job&&item.stageId==="recorded"&&<div className="analysis-actions"><button className="button primary" onClick={start}>AI 分析需求</button><small>只读分析项目材料；会消耗 Codex 额度，不修改项目，也不授权实施。</small></div>}
    {running&&<p className="type-recommendation-running" role="status"><span className="running-dot"/>AI 正在分析 · {job.message}</p>}
    {job?.status==="completed"&&!item.workbenchScheme&&<div className="kit-analysis-result"><strong>分析建议已形成 · 待你确认方案</strong><p>{job.result.summary}</p>
      {!stale&&<div className="kit-scheme-actions"><h5>确认业务方案</h5><p>这一步只确认做什么、规则和验收方式；不修改项目。</p>
        {job.result.questions.length>0&&<><label className="implementation-consent"><input type="checkbox" checked={adoptAll} onChange={event=>setAdoptAll(event.target.checked)}/>全部采用下列 AI 建议</label>
          {!adoptAll&&job.result.questions.map((question,index)=><label key={`answer-${index}`}>{question.question}<small>AI 建议：{question.recommendation} · 影响：{question.impact}</small>
            <textarea value={answers[index]||""} onChange={event=>setAnswers(previous=>{const next=[...previous];next[index]=event.target.value;return next;})} maxLength={1000} placeholder="填写你的业务决定"/></label>)}</>}
        <button className="button primary" disabled={confirming||(!adoptAll&&answers.filter(answer=>answer?.trim()).length!==job.result.questions.length)} onClick={confirmScheme}>{confirming?"正在确认…":"确认业务方案"}</button>
      </div>}
      <details><summary>查看范围、业务问题与验收建议</summary><h5>建议范围</h5>{job.result.scope.map((text,index)=><p key={`scope-${index}`}>{text}</p>)}
        {job.result.excluded.length>0&&<><h5>本轮不做</h5>{job.result.excluded.map((text,index)=><p key={`excluded-${index}`}>{text}</p>)}</>}
        {job.result.questions.length>0&&<><h5>需要你决定</h5>{job.result.questions.map((item,index)=><p key={`question-${index}`}>{item.question} · AI 建议：{item.recommendation} · 影响：{item.impact}</p>)}</>}
        <h5>验收建议</h5>{job.result.acceptance.map((text,index)=><p key={`acceptance-${index}`}>{text}</p>)}
        <h5>材料依据</h5>{job.result.evidence.map((text,index)=><p key={`evidence-${index}`}>{text}</p>)}</details>
      <small>建议关联文件：{job.result.targets.length?job.result.targets.join("、"):"尚未定位"}</small>
      <small>这是 AI 建议，不是已确认业务方案。确认和授权操作仍需分别进行。</small></div>}
    {stale&&!item.workbenchScheme&&<p className="form-error" role="alert">项目台账已变化，请核查分析依据；不会自动采纳旧结论。</p>}
    {job?.status==="needs-attention"&&item.stageId==="recorded"&&<div className="analysis-actions"><p className="form-error" role="alert">{job.message}</p>
      <button className="button secondary" disabled={busy.current} onClick={start}>核查后重试分析</button><small>旧失败记录会保留；再次启动会消耗 Codex 额度，不会自动实施。</small></div>}
    {history.length>0&&<details><summary>查看此前失败分析 · {history.length} 次</summary>{history.map(previous=><p key={previous.id}>
      {previous.endedAt?new Date(previous.endedAt).toLocaleString("zh-CN",{hour12:false}):"时间待核对"} · {previous.message}</p>)}</details>}
    {error&&<p className="form-error" role="alert">{error}</p>}
  </div>;
}
