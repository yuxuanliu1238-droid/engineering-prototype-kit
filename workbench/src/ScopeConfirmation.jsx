import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {useRefreshParticipant} from "./UnifiedRefresh";

const endpoint="/api/analysis/cx-recycle/CR-029/scope";
export default function ScopeConfirmation({onRefresh,onReview,actionTarget}) {
  const [review,setReview]=useState(null);
  const [error,setError]=useState("");
  const [checking,setChecking]=useState(false);
  const [saving,setSaving]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const inFlight=useRef(false);
  const generation=useRef(0);
  const mounted=useRef(true);
  const dialog=useRef(null);
  const dialogTitle=useId();
  useRefreshParticipant(load,saving||checking);
  useEffect(()=>{
    if(expanded && !dialog.current?.open) dialog.current?.showModal();
    if(!expanded && dialog.current?.open) dialog.current.close();
  },[expanded,actionTarget]);
  async function load() {
    const id=++generation.current;setChecking(true);setError("");
    try {const response=await fetch(endpoint,{cache:"no-store",signal:AbortSignal.timeout(10000)});const data=await response.json();if(!response.ok) throw Error(data.message);if(mounted.current&&id===generation.current){setReview(data.review);onReview?.(Boolean(data.review.confirmation));}}
    catch(e) {if(mounted.current&&id===generation.current){setReview(null);setError(e.message || "确认记录读取失败。");}}
    finally {if(mounted.current&&id===generation.current)setChecking(false);}
  }
  useEffect(()=>{mounted.current=true;load();return()=>{mounted.current=false;generation.current++;};},[]);
  async function confirm() {
    if(inFlight.current || !review?.canConfirm) return;
    inFlight.current=true;generation.current++;setSaving(true);setError("");
    try {
      const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmScopeOnly:true,version:review.version,resultHash:review.resultHash,analysisId:review.analysisId}),signal:AbortSignal.timeout(15000)});
      const data=await response.json();if(!response.ok)throw Error(data.message);
      if(mounted.current){setReview(data.review);onReview?.(Boolean(data.review.confirmation));setExpanded(false);}
    } catch(e) {if(mounted.current){setReview(null);setError(e.name==="TimeoutError" ? "保存回执暂未返回，请关闭弹窗后使用顶部刷新核查。" : e.message);}}
    finally {inFlight.current=false;if(mounted.current)setSaving(false);}
  }
  const content = <section className={actionTarget ? "scope-header-control" : "analysis-confirm"} aria-label="范围确认">
    <div className="overview-heading"><h3>{review?.confirmation ? "范围已确认" : "确认本轮范围"}</h3></div>
    {error && <p role="alert">{error}</p>}
    {checking && <p role="status">正在核对最新台账…</p>}
    {review?.confirmation ? <small role="status">范围已确认</small> : review && <>
      <button className="button primary" aria-haspopup="dialog" disabled={!review.canConfirm||checking||saving} onClick={()=>setExpanded(true)}>确认范围</button>
      <p className="snapshot-note">仅确认范围，不启动实施</p>
      {!review.canConfirm && <p>当前台账状态或分析版本已变化，暂不能确认这份范围。</p>}
    </>}
    <dialog ref={dialog} className="scope-dialog" aria-labelledby={dialogTitle} onCancel={event=>{if(saving)event.preventDefault();else setExpanded(false);}} onClose={()=>setExpanded(false)}>
      <h2 id={dialogTitle}>确认本轮范围</h2><p>只确认做与不做；待确认问题和验收建议不视为已确认。</p>
      {error && <p role="alert">{error}</p>}
      {review && !review.confirmation && <><div className="analysis-result"><details open><summary>本轮范围</summary><ul>{review.result.scope.map((text,i)=><li key={i}>{text}</li>)}</ul></details><details open><summary>排除项</summary><ul>{review.result.excluded.map((text,i)=><li key={i}>{text}</li>)}</ul></details></div><p>另有 {review.result.questions.length} 项分析问题仍待确认。</p></>}
      <div className="analysis-actions"><button className="button secondary" autoFocus disabled={saving} onClick={()=>setExpanded(false)}>暂不确认</button><button className="button primary" disabled={!review?.canConfirm||checking||saving} onClick={confirm}>{saving ? "正在保存…" : "确认并保存范围"}</button></div>
    </dialog>
  </section>;
  return actionTarget ? createPortal(content,actionTarget) : content;
}
