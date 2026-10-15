import {useEffect,useRef,useState} from "react";

export default function KitReviewCard({projectId,item,onSaved}){
  const [review,setReview]=useState(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),
    [previewOpen,setPreviewOpen]=useState(false),[previewed,setPreviewed]=useState(false),
    [adjusting,setAdjusting]=useState(false),[adjustmentText,setAdjustmentText]=useState(""),[adjustmentJob,setAdjustmentJob]=useState(null);
  const requestId=useRef(null),endpoint=`/api/projects/${projectId}/requirements/${item.id}/review`;
  const adjustmentId=useRef(null),adjustmentEndpoint=`/api/projects/${projectId}/requirements/${item.id}/adjustment`;
  async function load(){try{const response=await fetch(endpoint,{cache:"no-store",signal:AbortSignal.timeout(10000)}),data=await response.json();
    if(!response.ok)throw Error(data.message||"交付物暂时无法核查。");setReview(data.review);setError("");
  }catch(cause){setError(cause.message);}}
  const scopeExpanded=item.workbenchAdjustmentRequests?.at(-1)?.status==="scope-expansion";
  useEffect(()=>{if(item.stageId==="awaiting-review"&&!scopeExpanded)load();},[endpoint,item.stageId,scopeExpanded]);
  useEffect(()=>{let active=true;const loadAdjustment=async()=>{try{const response=await fetch(adjustmentEndpoint,{cache:"no-store",signal:AbortSignal.timeout(10000)}),data=await response.json();
      if(response.ok&&active){setAdjustmentJob(data.job);if(data.job&&["completed","needs-attention"].includes(data.job.status))await onSaved?.();}}
      catch{/* 保留当前验收内容 */}};loadAdjustment();return()=>{active=false;};},[adjustmentEndpoint]);
  useEffect(()=>{if(!adjustmentJob||!["submitted","running"].includes(adjustmentJob.status))return;
    const timer=setInterval(async()=>{try{const response=await fetch(adjustmentEndpoint,{cache:"no-store"}),data=await response.json();if(response.ok){setAdjustmentJob(data.job);
      if(data.job&&["completed","needs-attention"].includes(data.job.status))await onSaved?.();}}catch{}},3000);return()=>clearInterval(timer);},[adjustmentJob?.id,adjustmentJob?.status,adjustmentEndpoint]);
  async function accept(){if(busy||!review||review.previewUrl&&!previewed)return;
    requestId.current ||= crypto.randomUUID();setBusy(true);setError("");
    try{const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({requestId:requestId.current,outcome:"approved",confirmAcceptanceOnly:true,
        reviewDigest:review.reviewDigest,previewAcknowledged:previewed}),signal:AbortSignal.timeout(15000)}),data=await response.json();
      if(!response.ok)throw Error(data.message||"验收未能保存。");await onSaved?.();
    }catch(cause){setError(cause.message+" 请刷新台账核查，不会自动重复验收。");await load();}
    finally{setBusy(false);}}
  async function adjust(){if(busy||!review||adjustmentText.trim().length<2||["submitted","running"].includes(adjustmentJob?.status))return;
    adjustmentId.current ||= crypto.randomUUID();setBusy(true);setError("");
    try{const response=await fetch(adjustmentEndpoint,{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({requestId:adjustmentId.current,text:adjustmentText.trim(),reviewDigest:review.reviewDigest,
        confirmSameScope:true,confirmAdjustmentAndContinue:true}),signal:AbortSignal.timeout(15000)}),data=await response.json();
      if(!response.ok)throw Error(data.message||"调整未能提交。");setAdjustmentJob(data.job);setAdjusting(false);
    }catch(cause){setError(cause.message+" 不会自动重复提交或扩大授权范围。");}
    finally{setBusy(false);}}
  if(item.stageId!=="awaiting-review"||scopeExpanded)return null;
  return <section className="kit-review-card" aria-label="本轮工程化交付验收">
    <strong>{scopeExpanded?"调整已超出本轮范围 · 需重新确认方案":"当前需要你 · 验收本轮交付"}</strong><p>{scopeExpanded?"旧成果已保留，但不能沿用原授权继续或验收。请重新分析扩大的业务目标、确认范围并单独授权。":review?.summary||"正在读取最新交付结果…"}</p>
    {review&&<><div className="kit-review-actions">{review.previewUrl&&<button className="button secondary" onClick={()=>setPreviewOpen(true)}>预览原型</button>}
      <details><summary>查看需求成果与检查结论</summary><pre>{review.deliveryMarkdown}</pre><p>修改文件：{review.files.map(file=>file.path).join("、")}</p>
        <p>工程检查：{review.checks.join("、")}</p><p>验收标准：{review.acceptance.join("；")}</p></details></div>
      {review.previewUrl&&<label className="implementation-consent"><input type="checkbox" checked={previewed} disabled={!previewed} readOnly/>已打开本轮原型预览</label>}
      {adjustmentJob&&["submitted","running"].includes(adjustmentJob.status)&&<p className="type-recommendation-running" role="status"><span className="running-dot"/>{adjustmentJob.message}</p>}
    {adjustmentJob?.status==="needs-attention"&&<p className="form-error">{adjustmentJob.message}</p>}
      {adjusting&&<div className="kit-adjustment-editor"><label>调整意见<textarea value={adjustmentText} maxLength={3000} onChange={event=>setAdjustmentText(event.target.value)} placeholder="说明需要修改的结果，不要扩大原业务目标或授权文件范围"/></label>
        <p>提交后 AI 会先核对是否仍在原范围。同范围自动继续；扩大范围则停下，要求重新确认方案和授权。</p>
        <div className="action-buttons"><button className="button primary" disabled={busy||adjustmentText.trim().length<2} onClick={adjust}>确认调整并继续</button><button className="button secondary" disabled={busy} onClick={()=>setAdjusting(false)}>取消</button></div></div>}
      {!scopeExpanded&&!adjusting&&!["submitted","running"].includes(adjustmentJob?.status)&&<button className="button secondary" disabled={busy} onClick={()=>{adjustmentId.current=null;setAdjustmentText("");setAdjusting(true);}}>需要调整</button>}
      {!scopeExpanded&&<button className="button primary" disabled={busy||Boolean(review.previewUrl&&!previewed)||["submitted","running"].includes(adjustmentJob?.status)} onClick={accept}>{busy?"正在保存…":"验收通过并完成"}</button>}
      <small>只完成本轮工程化交付，不代表生产系统上线。</small></>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    {previewOpen&&review?.previewUrl&&<div className="kit-preview-overlay" role="dialog" aria-modal="true" aria-label="预览本轮原型">
      <div className="kit-preview-dialog"><div className="kit-preview-heading"><strong>{item.title} · 原型预览</strong><button className="button secondary" onClick={()=>setPreviewOpen(false)}>关闭</button></div>
        <iframe title={`${item.title} 原型预览`} src={review.previewUrl} sandbox="allow-scripts" onLoad={()=>setPreviewed(true)}/><p>关闭预览后可验收；如有问题，应提出调整而非直接完成。</p></div></div>}
  </section>;
}
