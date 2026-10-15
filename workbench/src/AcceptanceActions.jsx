import {useEffect,useId,useRef,useState} from "react";
import {useRefreshParticipant} from "./UnifiedRefresh";

const endpoint="/api/analysis/cx-recycle/CR-029/acceptance";
const suggestion="保持现有排序与统计逻辑不变；按已确认视觉稿还原排行榜的卡片布局、金银铜奖牌、脱敏姓名、字段顺序、渐变背景、留白、更新时间和演示数据。视觉稿作为本轮视觉验收基准。";
export default function AcceptanceActions(){
 const [state,setState]=useState(null),[open,setOpen]=useState(false),[text,setText]=useState(suggestion),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const dialog=useRef(null),mounted=useRef(false),loading=useRef(false),title=useId();
 async function load(){if(loading.current)return;loading.current=true;try{const response=await fetch(endpoint,{cache:"no-store",signal:AbortSignal.timeout(10000)}),data=await response.json();if(!response.ok)throw Error(data.message);if(mounted.current){setState(data);setError("");}}catch(error){if(mounted.current)setError(error.message||"验收状态暂时无法读取。");}finally{loading.current=false;}}
 useRefreshParticipant(load,busy);
 useEffect(()=>{mounted.current=true;load();const timer=setInterval(load,4000);return()=>{mounted.current=false;clearInterval(timer);};},[]);
 useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();if(!open&&dialog.current?.open)dialog.current.close();},[open]);
 async function save(){if(busy||(!state?.ready&&!state?.adjustment)||(!state?.adjustment&&!text.trim()))return;setBusy(true);setError("");try{const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(state.adjustment?{adjustmentId:state.adjustment.requestId,version:state.version,confirmAdjustmentAndContinue:true}:{requestId:crypto.randomUUID(),version:state.version,text,confirmAdjustmentAndContinue:true}),signal:AbortSignal.timeout(15000)}),data=await response.json();if(!response.ok)throw Error(data.message);if(mounted.current){setState(data);setOpen(false);}}catch(error){if(mounted.current)setError((error.name==="TimeoutError"?"提交回执暂未返回。":error.message)+" 请刷新核查，不会自动再次提交。");}finally{if(mounted.current)setBusy(false);}}
 if(!state)return null;
 const adjustmentReady=state.adjustment?.status==="awaiting-review";
 return <>
  {state.job?<><button className="button secondary" onClick={()=>setOpen(true)}>查看调整进展</button><small>{state.job.message}</small></>:adjustmentReady?<><button className="button secondary" onClick={()=>setOpen(true)}>查看调整结果</button><small>调整已完成 · 待你预览确认</small></>:state.adjustment?<><button className="button primary" onClick={()=>setOpen(true)}>确认调整并继续</button><small>调整意见已保存 · 确认后直接继续</small></>:state.ready&&<button className="button secondary" onClick={()=>setOpen(true)}>需要调整</button>}
  <dialog ref={dialog} className="scope-dialog acceptance-dialog" aria-labelledby={title} onCancel={()=>!busy&&setOpen(false)} onClose={()=>setOpen(false)}>
   <h2 id={title}>{state.job?"调整进展":adjustmentReady?"调整结果":state.adjustment?"确认调整并继续":"提出调整"}</h2><p>{state.job?state.job.message:adjustmentReady?"原型调整已完成并通过检查，等待你预览确认。":"同范围调整确认后直接继续，不重复原型制作授权。"}</p>{error&&<p role="alert">{error}</p>}
   <label htmlFor={`${title}-text`}>调整意见</label><textarea id={`${title}-text`} value={state.adjustment?.text||text} readOnly={Boolean(state.adjustment)} onChange={event=>setText(event.target.value)} rows="7"/>
   <div className="analysis-actions"><button className="button secondary" disabled={busy} onClick={()=>setOpen(false)}>关闭</button>{!state.job&&!adjustmentReady&&<button className="button primary" disabled={busy||(!state.adjustment&&!text.trim())} onClick={save}>{busy?"正在提交…":"确认调整并继续"}</button>}</div>
  </dialog>
 </>;
}
