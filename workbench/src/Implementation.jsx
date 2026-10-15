import {useEffect,useId,useRef,useState} from "react";
import {useRefreshParticipant} from "./UnifiedRefresh";
import PrototypePreview from "./PrototypePreview";
import StrategyDeliverableReview from "./StrategyDeliverableReview";
export default function Implementation({requirementId,blocked=false,onState}){
 const endpoint=`/api/analysis/cx-recycle/${requirementId}/implementation`;
 const [state,setState]=useState(null),[open,setOpen]=useState(false),[accept,setAccept]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const modal=useRef(null),alive=useRef(false),lock=useRef(false),loading=useRef(false),epoch=useRef(0),title=useId();
 async function load(){if(lock.current||loading.current)return;loading.current=true;const version=epoch.current;try{const res=await fetch(endpoint,{cache:"no-store",signal:AbortSignal.timeout(10000)}),data=await res.json();if(!res.ok)throw Error(data.message);if(alive.current&&version===epoch.current){setState(previous=>JSON.stringify(previous)===JSON.stringify(data)?previous:data);setError("");}}catch(e){if(alive.current&&version===epoch.current)setError(e.message||"请使用顶部刷新核查。");}finally{loading.current=false;}}
 useRefreshParticipant(load,busy);
 useEffect(()=>{alive.current=true;load();const timer=setInterval(load,4000);return()=>{alive.current=false;epoch.current++;clearInterval(timer);};},[]);
 useEffect(()=>{onState?.(state);},[state,onState]);
 useEffect(()=>{if(open&&!modal.current?.open)modal.current?.showModal();if(!open&&modal.current?.open)modal.current.close();},[open]);
 // Never retain consent across a changed plan.
 useEffect(()=>{setAccept(false);},[state?.basis]);
 async function authorize(){if(lock.current||!accept||!state?.ready||blocked||error)return;lock.current=true;epoch.current++;setBusy(true);try{const artifact=state.plan?.mode==="strategy-artifact",res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({basis:state.basis,version:state.version,confirmPrototypeImplementation:!artifact,confirmStrategyArtifact:artifact,acceptScopeAndRisk:true}),signal:AbortSignal.timeout(15000)}),data=await res.json();if(!res.ok)throw Error(data.message);if(alive.current){setState(data);setAccept(false);}}catch(e){if(alive.current){setError((e.name==="TimeoutError"?"授权回执暂未返回。":e.message)+" 请关闭弹窗并刷新核查，不会自动再次提交。");setAccept(false);}}finally{lock.current=false;if(alive.current)setBusy(false);}}
 const job=state?.job,running=job&&["submitted","running"].includes(job.status),plan=state?.plan||state?.authorization?.plan;
 const artifact=plan?.mode==="strategy-artifact";
 return <section className="scope-header-control">
  <button className={`button ${job?"secondary":"primary"}`} disabled={busy||blocked} onClick={()=>{setOpen(true);setAccept(false);load();}}>{job?`查看${artifact?"需求成果":"原型制作"}进展`:state?.ready?`授权${artifact?"整理需求成果":"制作原型"}`:"查看执行准备"}</button>
  {!artifact&&job?.status==="completed"&&<PrototypePreview requirementId={requirementId} plan={plan}/>}
  {artifact&&job?.status==="completed"&&<StrategyDeliverableReview requirementId={requirementId}/>}
  <small className={running?"execution-badge is-running":"execution-badge"} role="status">{job?job.message:state?.ready?`业务方案已确认 · 可以授权${artifact?"整理需求成果":"制作原型"}`:state?.blockers?.length?"执行准备有待处理项":"正在核对执行准备"}</small>
  {error&&!open&&<p role="alert">{error}</p>}
  <dialog ref={modal} className="scope-dialog business-dialog" aria-labelledby={title} onCancel={event=>{if(busy)event.preventDefault();else setOpen(false);}} onClose={()=>setOpen(false)}>
   <h2 id={title}>{job?`${artifact?"需求成果":"原型制作"}进展`:`授权${artifact?"整理需求成果":"制作原型"}`}</h2>
   {error&&<p role="alert">{error}</p>}
   {job&&<><p role="status">{job.message}</p><ol className="analysis-events">{job.events.map((item,index)=><li key={index}><time>{new Date(item.time).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",hour12:false})}</time><span>{item.label}</span></li>)}</ol>{state.changedFiles?.length>0&&<details open><summary>已修改文件</summary><ul>{state.changedFiles.map(file=><li key={file}>{file}</li>)}</ul></details>}{job.result&&<p>{job.result.summary}</p>}</>}
   {plan&&<><p>{plan.title}</p>{[["本轮做什么",plan.scope],["不在本轮范围",plan.excluded],["如何验收",plan.acceptance],["允许修改的文件",plan.targets]].map(([label,items])=><details key={label} open={label==="本轮做什么"||label==="不在本轮范围"}><summary>{label}</summary><ul>{items.map(item=><li key={item}>{item}</li>)}</ul></details>)}<p>{plan.dependency}</p><p>风险与保护：{plan.risk}</p></>}
   {!job&&state?.blockers?.length>0&&<div role="alert"><h3>尚需处理</h3><ul>{state.blockers.map(item=><li key={item}>{item}</li>)}</ul></div>}
   {!job&&state?.ready&&<label className="implementation-consent"><input type="checkbox" checked={accept} disabled={busy} onChange={event=>setAccept(event.target.checked)}/>我确认按以上业务方案{artifact?"整理本轮本地需求成果":"制作本轮工程化原型"}；不包含正式开发、发布或生产接入。</label>}
   <div className="analysis-actions"><button className="button secondary" autoFocus disabled={busy} onClick={()=>setOpen(false)}>{job?"关闭":"暂不授权"}</button>{!job&&<button className="button primary" disabled={!state?.ready||!accept||busy||blocked||Boolean(error)} onClick={authorize}>{busy?"正在保存授权…":`授权并开始${artifact?"整理需求成果":"制作原型"}`}</button>}</div>
  </dialog>
 </section>;
}
