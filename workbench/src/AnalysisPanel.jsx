import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./analysis.css";
import QuestionAnswers from "./QuestionAnswers";

const labels={submitted:"等待 AI 开始",running:"正在分析",completed:"待你审阅",failed:"处理失败","needs-attention":"需要核查"};
const sectionLabels={facts:"已有事实",scope:"建议范围",excluded:"本轮不做",questions:"待确认问题",acceptance:"验收建议",evidence:"分析依据"};

export default function AnalysisPanel({record,onRefresh,actionTarget,noticeTarget,compact=false}) {
  const endpoint=`/api/analysis/cx-recycle/${record?.id}`;
  const [job,setJob]=useState(null);
  const [questionState,setQuestionState]=useState(null);
  const [execution,setExecution]=useState(null);
  const [business,setBusiness]=useState(null);
  const [loaded,setLoaded]=useState(false);
  const [available,setAvailable]=useState(false);
  const [confirm,setConfirm]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const inflight=useRef(false);
  const mounted=useRef(true);
  useEffect(()=>{
    mounted.current=true;
    let timer;
    const controller=new AbortController();
    async function poll() {
      try {
        const response=await fetch(endpoint,{cache:"no-store",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
        if(!response.ok) throw Error("处理进度暂时无法读取。");
        const data=await response.json();
        if(!controller.signal.aborted) {setJob(previous=>JSON.stringify(previous)===JSON.stringify(data.job)?previous:data.job);setAvailable(data.available);setLoaded(true);setError(previous=>previous.startsWith("处理进度暂时") ? "" : previous);}
      } catch(e) {if(mounted.current && !controller.signal.aborted) {setError("处理进度暂时无法读取，启动已锁定；正在重新核查。");setLoaded(false);}}
      if(!controller.signal.aborted) timer=setTimeout(poll,4000);
    }
    poll();
    return ()=>{mounted.current=false;controller.abort();clearTimeout(timer);};
  },[]);
  async function start() {
    if(inflight.current) return;
    inflight.current=true;setBusy(true);setError("");
    try {
      const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sourceHash:record.sha256,confirmAnalysisOnly:true}),signal:AbortSignal.timeout(15000)});
      const data=await response.json();
      if(!response.ok) throw Error(data.message || "未能提交分析。");
      if(mounted.current) {setJob(data.job);setConfirm(false);}
    } catch(e) {if(mounted.current)setError(e.name==="TimeoutError" ? "提交回执暂未返回，正在核查处理进度；不会自动再次提交。" : e.message);}
    finally {inflight.current=false;if(mounted.current)setBusy(false);}
  }
  if(!record) return null;
  const artifact=record.workbenchTemplate?.deliveryMode==="strategy-artifact";
  if(record.stageId==="synced"&&record.executionState==="completed") return null;
  const eligible=record.stageId==="waiting-start" && record.executionState==="locked";
  const activeJob=execution?.job||job;
  const running=!execution?.error&&["submitted","running"].includes(activeJob?.status);
  const headline=running ? "AI 正在处理 · 暂无需操作" : "当前需要你";
  const notices=<>
    {business?.receipt?<><div className={`execution-overview ${["submitted","running"].includes(business.implementation?.job?.status)?"is-running":""}`}><div className="overview-heading"><span className="section-kicker">业务方案已确认</span><strong role="status">{business.implementation?.job?business.implementation.job.status==="completed"?artifact?"需求成果已生成 · 待你验收":"原型已生成 · 待你预览":business.implementation.job.status==="needs-attention"?"执行需要核查":business.implementation.job.status==="submitted"?"已授权 · 等待开始":"AI 正在执行":business.implementation?.ready?`待你授权${artifact?"整理需求成果":"制作原型"}`:"执行准备待完成"}</strong></div><p>{business.implementation?.job?.message||`业务方案已保存，无需重复确认。下一步由你决定是否授权${artifact?"整理需求成果":"制作原型"}。`}</p><small>{artifact?"只整理本轮本地需求成果":"仅制作工程化原型"}，不包含正式开发、发布或生产接入。</small></div></>:<>
    <div className={`execution-overview ${running?"is-running":""}`}><div className="overview-heading"><span className="section-kicker">{headline}</span><strong role="status">{execution?.error ? "处理状态需核查" : running ? execution?.job ? "AI 正在核对" : "AI 正在分析" : execution?.job ? execution.stale ? "旧核对记录 · 待核查变化" : "核对结束 · 待确认业务方案" : job ? labels[job.status] : loaded ? "尚未启动" : "正在读取最新状态…"}</strong></div>{activeJob?.updatedAt&&<small>最近进展 · {new Date(activeJob.updatedAt).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",hour12:false})}</small>}</div>
    <p>{questionState ? questionState.submission ? "全部回答已提交；AI 核对进展见顶部，尚未授权执行。" : `已保存 ${questionState.answered}/${questionState.questions.length} 项回答，尚未提交；尚未授权执行。` : job?.status==="completed" ? "AI 已整理业务范围、问题和验收建议，请从顶部回答业务问题。" : job?.message || "整理范围、业务问题与验收建议，不实施项目修改。"}</p>
    </>}
    {error && <p role="alert" className="refresh-feedback">{error}</p>}
    {job && ["needs-attention","failed"].includes(job.status) && <p role="alert">请将这条任务的状态反馈给我核查，无需重新登记需求。</p>}
    {!business?.receipt&&job?.result?.questions.length > 0 && <details className="top-questions"><summary>业务问题 · {job.result.questions.length} 项{questionState ? ` · ${questionState.questions.length-questionState.answered} 项未回答` : ""}</summary><ul>{questionState ? questionState.questions.map(item=><li key={item.id}>{item.text}<strong> · {item.savedAt ? "已回答，待核对" : "未回答"}</strong></li>) : job.result.questions.map((question,i)=><li key={i}>{question}</li>)}</ul><p className="snapshot-note">从顶部“回答业务问题”逐项填写；保存回答不等于确认业务方案。</p></details>}
  </>;
  const actions=<div className={actionTarget ? "scope-header-control" : "analysis-actions"}>
    {!job && !confirm && <button className="button primary" disabled={!eligible||!loaded||!available||busy} onClick={()=>setConfirm(true)}>让 AI 分析需求</button>}
    {!job && loaded && !available && <p className="snapshot-note">本机 AI 处理能力暂不可用。</p>}
    {!job && !eligible && <p className="snapshot-note">当前台账状态不允许从头启动。请核查已有进展。</p>}
    {!job && confirm && <div className="analysis-confirm"><strong>让 AI 整理这条需求？</strong><p>AI 会整理业务范围、需要你决定的问题和验收标准；不会制作原型，也不会进入正式开发。</p><div className="analysis-actions"><button className="button primary" disabled={busy||!loaded||!available} onClick={start}>{busy ? "正在提交…" : "确认并开始分析"}</button><button className="button secondary" disabled={busy} onClick={()=>setConfirm(false)}>暂不开始</button></div></div>}
  </div>;
  return <>
    {noticeTarget ? createPortal(notices,noticeTarget) : <section className="requirement-top-notices">{notices}</section>}
    {actionTarget ? createPortal(actions,actionTarget) : actions}
    {job?.status === "completed" && <QuestionAnswers requirementId={record.id} actionTarget={actionTarget} onReview={setQuestionState} onExecution={setExecution} onBusiness={setBusiness} />}
    {!compact&&<section className="analysis-panel" aria-label={`${record.id} 需求分析`}><span className="section-kicker">分析结果</span><h3>{job?.result?.summary || record.title}</h3>
    {job && <><ol className="analysis-events">{job.events.map((event,i)=><li key={i}><time>{new Date(event.time).toLocaleString("zh-CN",{hour12:false,timeZone:"Asia/Shanghai"})}</time><span>{event.label}</span></li>)}</ol><small className="snapshot-note">记录 {job.id.slice(0,8)} · {job.registrySaved ? "已写入需求台账" : "处理记录已保存；台账以最新同步结果为准"}</small></>}
    {job?.result && <div className="analysis-result">{Object.entries(sectionLabels).filter(([key])=>key!=="questions").map(([key,label])=><details key={key} open={key==="scope"}><summary>{label} · {job.result[key].length}</summary>{job.result[key].length ? <ul>{job.result[key].map((text,i)=><li key={i}>{text}</li>)}</ul> : <p>本次未列出；不代表已确认或已检查通过。</p>}</details>)}</div>}
    </section>}
  </>;
}
