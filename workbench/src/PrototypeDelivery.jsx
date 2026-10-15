import {useEffect,useId,useRef,useState} from "react";

export default function PrototypeDelivery({requirementId="CR-029"}){
 const endpoint=`/api/analysis/cx-recycle/${requirementId}/prototype-delivery`;
 const [open,setOpen]=useState(false),[state,setState]=useState(null),dialog=useRef(null),title=useId();
 useEffect(()=>{let active=true;async function load(){try{const response=await fetch(endpoint,{cache:"no-store",signal:AbortSignal.timeout(10000)}),data=await response.json();if(active&&response.ok)setState(previous=>JSON.stringify(previous)===JSON.stringify(data)?previous:data);}catch{}}load();const timer=setInterval(load,5000);return()=>{active=false;clearInterval(timer);};},[endpoint]);
 useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();if(!open&&dialog.current?.open)dialog.current.close();},[open]);
 const delivery=state?.delivery;
 return <div className="scope-header-control"><button className="button secondary" disabled={!state?.completed} onClick={()=>setOpen(true)}>查看原型交付清单</button><small>工程化原型已完成</small><dialog ref={dialog} className="scope-dialog production-preparation-dialog" aria-labelledby={title} onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)}><span className="section-kicker">本轮交付结果</span><h2 id={title}>{delivery?.title||"工程化原型交付清单"}</h2><p>{delivery?.boundary||"本轮只交付工程化原型和需求说明。"}</p><details className="production-section" open><summary>已交付 · {delivery?.delivered?.length||3}</summary><ul>{(delivery?.delivered||["交互原型已确认","页面需求说明已同步","工程化检查已通过"]).map((item,index)=><li key={index}>{item}</li>)}</ul></details><div className="production-next"><strong>下一步</strong><p>{delivery?.nextAction||"本轮已结束；若需正式开发，请另建需求。"}</p></div><div className="analysis-actions"><button className="button primary" onClick={()=>setOpen(false)}>知道了</button></div></dialog></div>;
}
