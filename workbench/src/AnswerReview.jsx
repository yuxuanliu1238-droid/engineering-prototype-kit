import {useEffect,useId,useRef,useState} from "react";
import {useRefreshParticipant} from "./UnifiedRefresh";
const sections={facts:"逐项核对",questions:"需要补充",acceptance:"验收建议",evidence:"关联依据",scope:"已确认范围",excluded:"排除项"};
export default function AnswerReview({requirementId,answers,dirty,onExecution,historyOnly=false}) {
  const endpoint=`/api/analysis/cx-recycle/${requirementId}/review`;
  const [state,setState]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[open,setOpen]=useState(false);
  const alive=useRef(false),lock=useRef(false),reading=useRef(false),generation=useRef(0),modal=useRef(null),title=useId();
  async function load(){
    if(reading.current||lock.current)return;
    reading.current=true;const epoch=generation.current;
    try{const response=await fetch(endpoint,{cache:"no-store",signal:AbortSignal.timeout(10000)});const data=await response.json();if(!response.ok)throw Error(data.message);if(alive.current&&epoch===generation.current){setState(previous=>JSON.stringify(previous)===JSON.stringify(data)?previous:data);setError("");}}
    catch(e){if(alive.current&&epoch===generation.current){setError(e.message||"核对状态暂不可用，请使用顶部刷新核查。");}}
    finally{reading.current=false;}
  }
  useRefreshParticipant(load,busy);
  useEffect(()=>{alive.current=true;generation.current++;setState(null);load();const timer=setInterval(load,4000);return()=>{alive.current=false;generation.current++;clearInterval(timer);};},[answers.answersDigest,answers.submission?.requestId]);
  useEffect(()=>{if(open&&!modal.current?.open)modal.current?.showModal();if(!open&&modal.current?.open)modal.current.close();},[open]);
  async function start(){
    if(historyOnly||lock.current||!state?.canStart||dirty||error)return;
    lock.current=true;setBusy(true);generation.current++;
    try{const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmReviewOnly:true,key:state.key,version:state.version}),signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw Error(data.message);if(alive.current){setState(data);setOpen(false);}}
    catch(e){if(alive.current){setState(null);setError("启动回执需核查，不会自动再次提交。请使用顶部刷新。");}}
    finally{lock.current=false;if(alive.current)setBusy(false);}
  }
  const job=state?.job,running=job&&["submitted","running"].includes(job.status);
  useEffect(()=>{onExecution?.({job,stale:state?.stale,error});},[job,state?.stale,error,onExecution]);
  const status=state?.stale ? "核对材料已变化，结果已过期" : running ? job.status==="submitted" ? "等待 AI 开始核对" : "AI 正在核对" : job?.status==="completed" ? job.result?.questions.length ? "核对完成 · 需要补充" : "核对完成 · 待你确认业务方案" : job ? "核对中断 · 需要关注" : "回答已提交 · 待继续核对";
  return <section className="scope-header-control" aria-label="回答一致性核对">
    {!historyOnly&&<small className={running?"execution-badge is-running":"execution-badge"} role="status">{status}</small>}
    {!historyOnly&&!job&&<button className="button primary" disabled={!state?.canStart||busy||dirty||Boolean(error)} onClick={start}>继续核对</button>}
    {job&&<button className={historyOnly?"text-button":"button secondary"} onClick={()=>setOpen(true)}>{historyOnly?"历史回答核对":running ? "查看核对进展" : "查看核对结果"}</button>}
    {dirty&&<small>请先保存并重新提交修改后的回答。</small>}
    {error&&<p role="alert">{error}</p>}
    {state&&!state.available&&!job&&<p role="alert">本机 AI 处理能力暂不可用，尚未开始核对。</p>}
    <dialog ref={modal} className="scope-dialog" aria-labelledby={title} onCancel={event=>{if(busy)event.preventDefault();else setOpen(false);}} onClose={()=>setOpen(false)}>
      <h2 id={title}>{job ? "业务方案核对" : "继续核对"}</h2>
      <p>{historyOnly?"这是业务方案确认前的历史记录，不要求你再次确认。以已确认业务方案为准。":job ? status : "核对本次提交的回答、范围与验收建议。只分析，不制作原型。"}</p>
      {error&&<p role="alert">{error}</p>}
      {state?.stale&&<p role="alert">以下仅为旧材料的记录，不能作为当前结论。请核查变化后再决定下一步。</p>}
      {job&&<><p>{job.message}</p><ol className="analysis-events">{job.events.map((event,index)=><li key={index}><time>{new Date(event.time).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",hour12:false})}</time><span>{event.label}</span></li>)}</ol></>}
      {job?.status==="completed"&&job.result&&<section className="analysis-result"><p>{job.result.summary}</p>{Object.entries(sections).map(([key,label])=><details key={key} open={key==="questions"&&job.result[key].length>0}><summary>{label} · {job.result[key].length}</summary><ul>{job.result[key].map((text,index)=><li key={index}>{text}</li>)}</ul></details>)}<p>这是 AI 核对建议，仍需你确认业务方案；尚未制作原型。</p></section>}
      <div className="analysis-actions"><button className="button secondary" autoFocus disabled={busy} onClick={()=>setOpen(false)}>关闭</button></div>
    </dialog>
  </section>;
}
