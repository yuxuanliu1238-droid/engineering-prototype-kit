import {useEffect,useId,useRef,useState} from "react";
import {useRefreshParticipant} from "./UnifiedRefresh";
import Implementation from "./Implementation";
export default function BusinessDecisions({requirementId,answers,blocked=false,onState}){
  const endpoint=`/api/analysis/cx-recycle/${requirementId}/decisions`;
  const [review,setReview]=useState(null),[choices,setChoices]=useState({}),[mode,setMode]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [implementation,setImplementation]=useState(null);
  const alive=useRef(false),lock=useRef(false),request=useRef(null),generation=useRef(0),modal=useRef(null),title=useId();
  async function load(){if(lock.current)return;const epoch=++generation.current;try{const res=await fetch(endpoint,{cache:"no-store",signal:AbortSignal.timeout(10000)});const data=await res.json();if(!res.ok)throw Error(data.message);if(alive.current&&generation.current===epoch){setReview(previous=>JSON.stringify(previous)===JSON.stringify(data.review)?previous:data.review);setError("");}}catch(e){if(alive.current&&generation.current===epoch)setError(e.message||"请使用顶部刷新核查。");}}
  useRefreshParticipant(load,busy);
  useEffect(()=>{onState?.(review?{...review,implementation}:null);},[review,implementation,onState]);
  useEffect(()=>{alive.current=true;load();return()=>{alive.current=false;generation.current++;};},[answers.answersDigest]);
  useEffect(()=>{if(mode&&!modal.current?.open)modal.current?.showModal();if(!mode&&modal.current?.open)modal.current.close();},[mode]);
  const complete=review?.recommendations.every(item=>choices[item.id]?.choice==="adopt"||(choices[item.id]?.choice==="custom"&&choices[item.id].text?.trim()));
  async function save(){
    if(lock.current||!complete||blocked||!review?.eligible||error)return;
    lock.current=true;generation.current++;setBusy(true);
    const items=review.recommendations.map(item=>({id:item.id,...choices[item.id]}));
    const signature=JSON.stringify([review.basis,items]);if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()};
    try{const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({version:review.version,basis:review.basis,requestId:request.current.id,confirmDecisionsOnly:true,items}),signal:AbortSignal.timeout(15000)});const data=await res.json();if(!res.ok)throw Error(data.message);if(alive.current){setReview(data.review);setMode(null);setChoices({});}}
    catch(e){if(alive.current)setError((e.name==="TimeoutError"?"保存回执暂未返回。":e.message)+" 输入已保留，请关闭弹窗后使用顶部刷新核查。");}
    finally{lock.current=false;if(alive.current)setBusy(false);}
  }
  function show(next){setMode(next);load();}
  return <section className="scope-header-control business-controls">
    <button className={`button ${review?.receipt ? "secondary":"primary"}`} disabled={busy||blocked} onClick={()=>show("decisions")}>{review?.receipt ? "查看业务方案":"确认业务方案"}</button>
    {review?.receipt&&<Implementation requirementId={requirementId} blocked={busy||blocked} onState={setImplementation}/>}
    {review?.receipt&&<small>业务已确认</small>}
    {error&&!mode&&<p role="alert">{error}</p>}
    <dialog ref={modal} className="scope-dialog business-dialog" aria-labelledby={title} onCancel={event=>{if(busy)event.preventDefault();else setMode(null);}} onClose={()=>setMode(null)}>
      <h2 id={title}>确认业务方案</h2>
      {error&&<p role="alert">{error}</p>}
      {!review&&<p>正在读取…</p>}
      {review&&mode==="decisions"&&<>
        <p>{review.plan?.label||"只确认影响业务结果的选择；确认后仍需单独授权执行。"}</p>
        {review.receipt?<><p role="status">已保存 · {new Date(review.receipt.confirmedAt).toLocaleString("zh-CN")}</p>{review.receipt.items.map(item=><article className="business-card" key={item.id}><h3>{item.title}</h3><p>{item.text}</p><small>{item.choice==="adopt"?"已采纳 AI 建议":"你的修改意见 · 待重新核对"}</small></article>)}<button className="text-button" onClick={()=>{setChoices(Object.fromEntries(review.receipt.items.map(item=>[item.id,{choice:item.choice,text:item.text}])));setReview({...review,receipt:null});}}>修改本轮决定</button></>:<>
          <button className="text-button" onClick={()=>setChoices(Object.fromEntries(review.recommendations.map(item=>[item.id,{choice:"adopt"}])))}>全部采用建议（待保存）</button>
          {review.recommendations.map(item=><article className="business-card" key={item.id}><h3>{item.title}</h3>{item.context&&<small>{item.context}</small>}<p><strong>AI 建议</strong><br/>{item.recommendation}</p><p className="snapshot-note">影响：{item.impact}</p><div className="business-choice"><button className="button secondary" aria-pressed={choices[item.id]?.choice==="adopt"} onClick={()=>setChoices({...choices,[item.id]:{choice:"adopt"}})}>采纳建议</button><button className="text-button" aria-pressed={choices[item.id]?.choice==="custom"} onClick={()=>setChoices({...choices,[item.id]:{choice:"custom",text:choices[item.id]?.text||""}})}>修改意见</button></div>{choices[item.id]?.choice==="custom"&&<textarea aria-label={`${item.title}的修改意见`} maxLength={2000} value={choices[item.id].text} onChange={event=>setChoices({...choices,[item.id]:{choice:"custom",text:event.target.value}})}/>}</article>)}
        </>}
        <details><summary>AI 自行设计 · 无需逐项确认</summary><ul>{review.delegatedDesign.map(text=><li key={text}>{text}</li>)}</ul></details>
        <details><summary>执行前自动检查 · 无需你回答</summary><ul>{review.engineeringChecks.map(text=><li key={text}>{text}</li>)}</ul></details>
      </>}
      <div className="analysis-actions"><button className="button secondary" autoFocus disabled={busy} onClick={()=>setMode(null)}>关闭</button>{mode==="decisions"&&!review?.receipt&&<button className="button primary" disabled={busy||!complete||!review?.eligible||blocked||Boolean(error)} onClick={save}>{busy?"正在保存…":"确认业务方案"}</button>}</div>
    </dialog>
  </section>;
}
