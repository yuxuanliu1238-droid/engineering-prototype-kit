import {useEffect,useState} from "react";

export default function KitCompletedCard({projectId,item}){
  const [state,setState]=useState(null),[error,setError]=useState(""),[previewOpen,setPreviewOpen]=useState(false),
    endpoint=`/api/projects/${projectId}/requirements/${item.id}/review`;
  useEffect(()=>{if(item.stageId!=="completed")return;let active=true;
    (async()=>{try{const response=await fetch(endpoint,{cache:"no-store",signal:AbortSignal.timeout(10000)}),data=await response.json();
      if(!response.ok)throw Error(data.message||"交付结果暂时无法读取。");if(active){setState(data);setError("");}
    }catch(cause){if(active)setError(cause.message);}})();return()=>{active=false;};},[endpoint,item.stageId]);
  if(item.stageId!=="completed")return null;
  return <section className="kit-review-card kit-completed-card" aria-label="已完成交付">
    <strong>工程化需求已完成</strong><p>本轮成果已由产品经理验收；不代表生产系统上线。</p>
    <div className="analysis-actions">{state?.review?.previewUrl&&<button className="button secondary" onClick={()=>setPreviewOpen(true)}>预览原型</button>}
      {state?.review&&<details><summary>查看需求成果与交付清单</summary><pre>{state.review.deliveryMarkdown}</pre>
        <p>交付文件：{state.review.files.map(file=>file.path).join("、")}</p><p>工程检查：{state.review.checks.join("、")}</p>
        <p>验收标准：{state.review.acceptance.join("；")}</p></details>}</div>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {previewOpen&&state?.review?.previewUrl&&<div className="kit-preview-overlay" role="dialog" aria-modal="true" aria-label="查看已验收原型">
      <div className="kit-preview-dialog"><div className="kit-preview-heading"><strong>{item.title} · 已验收原型</strong><button className="button secondary" onClick={()=>setPreviewOpen(false)}>关闭</button></div>
        <iframe title={`${item.title} 已验收原型`} src={state.review.previewUrl} sandbox="allow-scripts"/><p>这是本轮已验收的工程化原型，不代表生产效果。</p></div></div>}
  </section>;
}
