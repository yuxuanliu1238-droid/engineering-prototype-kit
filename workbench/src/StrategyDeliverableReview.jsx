import {useEffect,useId,useRef,useState} from "react";

export default function StrategyDeliverableReview({requirementId}){
  const endpoint=`/api/analysis/cx-recycle/${requirementId}/strategy-acceptance`;
  const [state,setState]=useState(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [draft,setDraft]=useState(""),[sameScope,setSameScope]=useState(false);
  const modal=useRef(null),lock=useRef(false),title=useId();
  async function load(){try{const response=await fetch(endpoint,{cache:"no-store",signal:AbortSignal.timeout(10000)}),data=await response.json();if(!response.ok)throw Error(data.message);setState(data);setError("");}catch(error){setError(error.message||"成果状态暂时无法读取。");}}
  useEffect(()=>{load();},[requirementId]);
  useEffect(()=>{if(open&&!modal.current?.open)modal.current?.showModal();if(!open&&modal.current?.open)modal.current.close();},[open]);
  async function accept(){if(lock.current||!state?.ready)return;lock.current=true;setBusy(true);try{
    const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmStrategyAccepted:true,requestId:crypto.randomUUID(),version:state.version}),signal:AbortSignal.timeout(15000)}),data=await response.json();
    if(!response.ok)throw Error(data.message);setState(previous=>({...previous,ready:false,accepted:true}));setOpen(false);
  }catch(error){setError((error.name==="TimeoutError"?"验收回执暂未返回。":error.message)+" 请刷新核查，不会自动重复提交。");}
  finally{lock.current=false;setBusy(false);}}
  async function adjust(){if(lock.current||!state?.adjustment?.ready||!draft.trim()||!sameScope)return;
    lock.current=true;setBusy(true);try{
      const response=await fetch(`${endpoint}/adjust`,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({requestId:crypto.randomUUID(),text:draft.trim(),confirmSameScope:true,
          basis:state.adjustment.basis,version:state.adjustment.version}),signal:AbortSignal.timeout(15000)}),data=await response.json();
      if(!response.ok)throw Error(data.message);setState(previous=>({...previous,ready:false,job:data.job,adjustment:null}));
      setDraft("");setSameScope(false);setOpen(false);
    }catch(error){setError((error.name==="TimeoutError"?"调整回执暂未返回。":error.message)+" 请刷新核查，不会自动重复提交。");}
    finally{lock.current=false;setBusy(false);}}
  return <section className="scope-header-control">
    <button className="button primary" onClick={()=>{setOpen(true);load();}}>{state?.accepted?"查看已验收成果":"查看并验收需求成果"}</button>
    <dialog ref={modal} className="scope-dialog business-dialog" aria-labelledby={title} onCancel={event=>{if(busy)event.preventDefault();else setOpen(false);}} onClose={()=>setOpen(false)}>
      <span className="section-kicker">本轮交付物</span><h2 id={title}>查看需求成果</h2>
      <p>{state?.job?.result?.summary||"正在读取本轮成果。"}</p>
      {error&&<p role="alert">{error}</p>}
      {(state?.files||[]).map(file=><details key={file.path} open={state.files.length===1} className="production-section"><summary>{file.path}</summary><pre style={{whiteSpace:"pre-wrap",maxHeight:"45vh",overflow:"auto"}}>{file.content||"文件暂时无法读取，请核查。"}</pre></details>)}
      <p className="snapshot-note">本轮只验收上述本地需求成果；不代表正式开发、联调或发布完成。</p>
      {state?.ready&&<div className="production-section"><label htmlFor={`${title}-adjust`}>需要调整？</label>
        <textarea id={`${title}-adjust`} maxLength={4000} value={draft} onChange={event=>setDraft(event.target.value)} placeholder="写下本轮成果需要改动的业务内容"/>
        <label className="implementation-consent"><input type="checkbox" checked={sameScope} onChange={event=>setSameScope(event.target.checked)}/>
          我确认仍在本轮已授权的业务范围和文件范围内；如扩大范围，先重新确认业务方案。</label></div>}
      <div className="analysis-actions"><button className="button secondary" disabled={busy} onClick={()=>setOpen(false)}>稍后处理</button>{state?.ready&&<><button className="button secondary" disabled={busy||!draft.trim()||!sameScope||Boolean(error)} onClick={adjust}>{busy?"正在提交调整…":"确认调整并继续"}</button><button className="button primary" disabled={busy||Boolean(error)||state.files?.some(file=>file.content==null)} onClick={accept}>{busy?"正在保存验收…":"验收通过并完成"}</button></>}</div>
    </dialog>
  </section>;
}
