import { useEffect,useId,useRef,useState } from "react";
import { createPortal } from "react-dom";
import {useRefreshParticipant} from "./UnifiedRefresh";
import AnswerReview from "./AnswerReview";
import BusinessDecisions from "./BusinessDecisions";

export default function QuestionAnswers({requirementId,actionTarget,onReview,onExecution,onBusiness}) {
  const endpoint=`/api/analysis/cx-recycle/${requirementId}/questions`;
  const [review,setReview]=useState(null),[drafts,setDrafts]=useState({}),[selected,setSelected]=useState("");
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[uncertain,setUncertain]=useState(false);
  const [error,setError]=useState(""),[message,setMessage]=useState("");
  const [submitting,setSubmitting]=useState(false),[confirmSubmit,setConfirmSubmit]=useState(false);
  const [business,setBusiness]=useState(null);
  const [reviewExecution,setReviewExecution]=useState(null);
  useEffect(()=>{onBusiness?.(business);},[business,onBusiness]);
  const modal=useRef(null),alive=useRef(true),inFlight=useRef(false),request=useRef(null),generation=useRef(0);
  const title=useId(),field=useId();
  const question=review?.questions.find(item=>item.id===selected) || review?.questions[0];
  const value=question ? drafts[question.id] ?? question.answer : "";
  const dirty=review?.questions.some(item=>drafts[item.id]!==undefined && drafts[item.id]!==item.answer);
  const allSaved=review?.questions.length>0 && review.answered===review.questions.length;
  useRefreshParticipant(load,busy||loading);
  function accept(next) {setReview(next);onReview?.(next);setSelected(previous=>next.questions.some(item=>item.id===previous) ? previous : next.questions.find(item=>!item.savedAt)?.id || next.questions[0]?.id || "");}
  async function load() {
    const current=++generation.current;setLoading(true);setError("");
    try {const response=await fetch(endpoint,{cache:"no-store",signal:AbortSignal.timeout(10000)});const data=await response.json();if(!response.ok)throw Error(data.message);if(alive.current&&generation.current===current){accept(data.review);setUncertain(false);}}
    catch(e){if(alive.current&&generation.current===current){setError(e.message || "问题无法读取，请稍后重试。");setUncertain(true);}}
    finally{if(alive.current&&generation.current===current)setLoading(false);}
  }
  useEffect(()=>{alive.current=true;load();return()=>{alive.current=false;generation.current++;};},[]);
  useEffect(()=>{if(open&&!modal.current?.open)modal.current?.showModal();if(!open&&modal.current?.open)modal.current.close();},[open,actionTarget]);
  useEffect(()=>{if(!dirty)return;const warn=event=>{event.preventDefault();event.returnValue="";};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[dirty]);
  async function save() {
    if(inFlight.current || !question || !review?.canAnswer || !value.trim() || uncertain)return;
    inFlight.current=true;setBusy(true);setError("");setMessage("");
    const signature=JSON.stringify([review.version,question.id,value]);
    if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()};
    const id=question.id;
    try {
      const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({version:review.version,analysisId:review.analysisId,resultHash:review.resultHash,questionId:id,answer:value,requestId:request.current.id,confirmAnswerOnly:true}),signal:AbortSignal.timeout(15000)});
      const data=await response.json();if(!response.ok)throw Error(data.message);
      if(alive.current){accept(data.review);setDrafts(previous=>{const next={...previous};delete next[id];return next;});const items=data.review.questions,index=items.findIndex(item=>item.id===id);const next=[...items.slice(index+1),...items.slice(0,index)].find(item=>!item.savedAt);if(next)setSelected(next.id);setMessage(next ? "已保存，已切换到下一个未回答问题。" : "全部回答已保存，请提交并让 AI 核对。尚未授权执行。");}
    } catch(e) {if(alive.current){setError((e.name==="TimeoutError" ? "回执暂未返回。" : e.message)+" 输入已保留，请关闭弹窗后使用顶部刷新核查。");setUncertain(true);}}
    finally{inFlight.current=false;if(alive.current)setBusy(false);}
  }
  async function submit() {
    if(inFlight.current||dirty||!allSaved||uncertain||!review.canAnswer||review.submission)return;
    inFlight.current=true;setBusy(true);setSubmitting(true);setError("");
    const signature=JSON.stringify(["submit",review.answersDigest]);
    if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()};
    let answersSubmitted=false;
    try {
      const response=await fetch(`${endpoint}/submit`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({version:review.version,analysisId:review.analysisId,resultHash:review.resultHash,answersDigest:review.answersDigest,requestId:request.current.id,confirmSubmissionOnly:true}),signal:AbortSignal.timeout(15000)});
      const data=await response.json();if(!response.ok)throw Error(data.message);
      answersSubmitted=true;if(alive.current)accept(data.review);
      const reviewResponse=await fetch(`/api/analysis/cx-recycle/${requirementId}/review`,{cache:"no-store",signal:AbortSignal.timeout(10000)});
      const reviewState=await reviewResponse.json();if(!reviewResponse.ok)throw Error(reviewState.message);
      const startResponse=await fetch(`/api/analysis/cx-recycle/${requirementId}/review`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmReviewOnly:true,key:reviewState.key,version:reviewState.version}),signal:AbortSignal.timeout(15000)});
      const started=await startResponse.json();if(!startResponse.ok)throw Error(started.message);
      if(alive.current){setConfirmSubmit(false);setOpen(false);setReviewExecution({job:started.job,stale:started.stale,error:""});setMessage("回答已提交，AI 正在核对；未授权执行。");}
    }catch(e){if(alive.current){setError(answersSubmitted ? "回答已提交；核对启动结果需核查。请使用顶部刷新，不会重复提交回答。" : "提交结果需核查，请关闭弹窗后使用顶部刷新。"+(e.name==="TimeoutError" ? "" : e.message));setUncertain(true);}}
    finally{inFlight.current=false;if(alive.current){setBusy(false);setSubmitting(false);}}
  }
  const content=<section className="scope-header-control" aria-label="回答分析问题">
    <button className={`button ${allSaved ? "secondary" : "primary"}`} aria-haspopup="dialog" onClick={()=>{setConfirmSubmit(false);setOpen(true);}}>{allSaved ? "查看／修改回答" : "回答问题"}</button>
    {allSaved&&!review.submission&&<button className="button primary" disabled={busy||loading||uncertain||dirty||!review.canAnswer} onClick={()=>{setConfirmSubmit(true);setOpen(true);}}>提交并让 AI 核对</button>}
    <small role="status">{review ? `已回答 ${review.answered} / ${review.questions.length} 项 · ${business?.receipt ? "已归入业务方案" : review.submission ? reviewExecution?.job?.status==="completed" ? "核对完成" : "AI 正在核对" : "尚未提交"}` : "正在读取问题…"}</small>
    {error&&!open&&<p role="alert">{error}</p>}
    {review?.questions.length===0&&<BusinessDecisions requirementId={requirementId} answers={review} blocked={busy} onState={setBusiness}/>}
    {review?.submission&&<><AnswerReview requirementId={requirementId} answers={review} dirty={dirty} historyOnly={Boolean(business?.receipt)} onExecution={state=>{setReviewExecution(state);onExecution?.(state);}}/>{reviewExecution?.job?.status==="completed"&&!reviewExecution.stale&&!reviewExecution.error&&<BusinessDecisions requirementId={requirementId} answers={review} blocked={dirty||busy} onState={setBusiness}/>}</>}
    <dialog ref={modal} className="scope-dialog question-dialog" aria-labelledby={title} onCancel={event=>{if(busy)event.preventDefault();else setOpen(false);}} onClose={()=>setOpen(false)}>
      <h2 id={title}>回答业务问题</h2><p>只记录影响业务结果的决定；常规设计由 AI 给出建议。不启动项目修改。</p>
      <div className="overview-heading"><span>{review ? `已回答 ${review.answered} / ${review.questions.length} 项` : "读取中"}</span></div>
      {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
      {review&&!review.canAnswer&&<p role="alert">当前范围或台账状态已变化，暂不能保存回答。输入仍保留。</p>}
      {confirmSubmit ? <section className="answer-submit-review"><h3>提交并核对</h3><p>提交当前已保存的 {review?.answered} 项回答，并让 AI 自动核对业务方案；不会修改项目内容。</p>{review?.questions.map((item,index)=><details key={item.id}><summary>问题 {index+1} · {item.text}</summary><p>{item.answer}</p></details>)}</section> : question&&<><details className="question-picker"><summary>问题 {review.questions.indexOf(question)+1} · {question.savedAt ? "已回答" : "未回答"} · 切换问题</summary><div aria-label="选择问题">{review.questions.map((item,index)=><button type="button" className={item.savedAt ? "answered" : "unanswered"} aria-current={item.id===question.id ? "true" : undefined} key={item.id} disabled={busy} onClick={event=>{setSelected(item.id);setMessage("");const picker=event.currentTarget.closest("details");picker.open=false;picker.querySelector("summary").focus();}}>问题 {index+1} · {item.savedAt ? "已回答" : "未回答"}{drafts[item.id]!==undefined&&drafts[item.id]!==item.answer ? " · 有草稿" : ""}</button>)}</div></details>
        <p className="question-text">{question.text}</p><label htmlFor={field}>你的回答</label><textarea id={field} rows={6} maxLength={4000} value={value} disabled={busy} onChange={event=>setDrafts({...drafts,[question.id]:event.target.value})} placeholder="填写你的决定；暂不确定的部分可明确写出。" />
        <small>{value.length} / 4000 字{question.savedAt ? ` · 最近保存 ${new Date(question.savedAt).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",hour12:false})}` : " · 尚未保存"}</small>
        {question.revisions.length>0&&<details><summary>已保存记录 · {question.revisions.length} 次</summary>{question.revisions.map((item,index)=><div className="answer-revision" key={index}><time>{new Date(item.savedAt).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",hour12:false})}</time><p>{item.answer}</p></div>)}</details>}
      </>}
      {dirty&&<p className="snapshot-note">有未保存输入。关闭弹窗仍保留，离开此页面前请保存。</p>}
      <div className="analysis-actions"><button className="button secondary" autoFocus disabled={busy} onClick={()=>confirmSubmit ? setConfirmSubmit(false) : setOpen(false)}>{confirmSubmit ? "返回修改" : "关闭"}</button>{!confirmSubmit&&<button className="button secondary" disabled={busy||loading||uncertain||!review?.canAnswer||!value.trim()||value===question?.answer} onClick={save}>{busy&&!submitting ? "正在保存…" : "保存本项回答"}</button>}{allSaved&&!review.submission&&<button className="button primary" disabled={busy||loading||uncertain||dirty||!review.canAnswer} onClick={()=>confirmSubmit ? submit() : setConfirmSubmit(true)}>{submitting ? "正在提交并启动核对…" : confirmSubmit ? "确认提交并核对" : "提交并让 AI 核对"}</button>}</div>
    </dialog>
  </section>;
  return actionTarget ? createPortal(content,actionTarget) : content;
}
