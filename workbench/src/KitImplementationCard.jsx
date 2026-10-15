import {useEffect,useRef,useState} from "react";

export default function KitImplementationCard({projectId,item,registrySha256,onSaved}){
  const [job,setJob]=useState(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const [previewOpen,setPreviewOpen]=useState(false);
  const requestId=useRef(null),notified=useRef(null),endpoint=`/api/projects/${projectId}/requirements/${item.id}/implementation`;
  async function load(){try{const response=await fetch(endpoint,{cache:"no-store",signal:AbortSignal.timeout(10000)}),data=await response.json();
      if(!response.ok)throw Error(data.message||"实施状态暂时无法读取。");setJob(data.job);setError("");
      if(data.job&&["running","completed","needs-attention"].includes(data.job.status)&&notified.current!==`${data.job.id}:${data.job.status}`){
        notified.current=`${data.job.id}:${data.job.status}`;await onSaved?.();}
    }catch(cause){setError(cause.message);}}
  useEffect(()=>{if(item.workbenchAuthorization)load();},[endpoint,item.workbenchAuthorization?.requestId]);
  useEffect(()=>{if(!job||!["submitted","running"].includes(job.status))return;const timer=setInterval(load,3000);
    return()=>clearInterval(timer);},[job?.id,job?.status]);
  async function start(){if(busy||job||!item.workbenchAuthorization||item.executionState!=="ready")return;
    requestId.current ||= crypto.randomUUID();setBusy(true);setError("");
    try{const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({requestId:requestId.current,registrySha256,
        authorizationPlanHash:item.workbenchAuthorization.planHash,confirmImplementationStart:true}),
      signal:AbortSignal.timeout(15000)}),data=await response.json();
      if(!response.ok)throw Error(data.message||"未能启动实施。");setJob(data.job);
    }catch(cause){setError(cause.message+" 请先核查执行状态；不会自动重复派发。 ");await load();}
    finally{setBusy(false);}}
  async function retry(){if(busy||job?.status!=="needs-attention"||item.workbenchImplementation?.status!=="needs-attention")return;
    requestId.current=crypto.randomUUID();setBusy(true);setError("");
    try{const response=await fetch(`${endpoint}/retry`,{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({requestId:requestId.current,registrySha256,
        authorizationPlanHash:item.workbenchAuthorization.planHash,confirmRetryAfterInspection:true}),
      signal:AbortSignal.timeout(15000)}),data=await response.json();
      if(!response.ok)throw Error(data.message||"重试未能安全启动。");setJob(data.job);await onSaved?.();
    }catch(cause){setError(cause.message+" 请核查授权文件和失败回执；不会自动重复派发。");await load();}
    finally{setBusy(false);}}
  if(!item.workbenchAuthorization||item.stageId==="completed"||item.workbenchAdjustmentRequests?.at(-1)?.status==="scope-expansion")return null;
  return <section className="kit-implementation-card" aria-label="本轮实施进展">
    {!job&&item.executionState==="ready"&&<><strong>已授权 · 等待你启动实施</strong><p>只修改本轮授权文件，不进入生产开发或发布。</p>
      <button className="button primary" disabled={busy} onClick={start}>{busy?"正在派发…":"启动实施"}</button></>}
    {job&&["submitted","running"].includes(job.status)&&<p className="type-recommendation-running" role="status"><span className="running-dot"/>{job.message}</p>}
    {job?.status==="completed"&&item.workbenchImplementation?.jobId===job.id&&<><strong>工程化交付已写入 · 待你验收</strong><p>{job.result?.summary}</p>
      <small>修改：{job.changedFiles.join("、")}</small>{job.result?.previewUrl&&item.stageId!=="awaiting-review"&&<button className="button secondary" onClick={()=>setPreviewOpen(true)}>预览原型</button>}</>}
    {job?.status==="needs-attention"&&<div className="analysis-actions"><p className="form-error" role="alert">{job.message} 请先检查现有文件和备份，不会自动重试。</p>
      {item.workbenchImplementation?.status==="needs-attention"&&<button className="button secondary" disabled={busy} onClick={retry}>{busy?"正在核查…":"检查文件并重试"}</button>}</div>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    {previewOpen&&job?.result?.previewUrl&&<div className="kit-preview-overlay" role="dialog" aria-modal="true" aria-label="预览本轮原型">
      <div className="kit-preview-dialog"><div className="kit-preview-heading"><strong>{item.title} · 原型预览</strong><button className="button secondary" onClick={()=>setPreviewOpen(false)}>关闭</button></div>
        <iframe title={`${item.title} 原型预览`} src={job.result.previewUrl} sandbox="allow-scripts"/>
        <p>这是本轮工程化原型，不代表生产效果；关闭预览后仍需验收或提出调整。</p></div></div>}
  </section>;
}
