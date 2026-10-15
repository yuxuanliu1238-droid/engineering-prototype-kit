import {useEffect,useId,useRef,useState} from "react";

export default function PrototypePreview({requirementId="CR-029",plan}){
 const targets=plan?.targets||[],surface=targets.some(file=>file.includes("/admin"))?"admin":targets.some(file=>file.includes("/mobile"))?"mobile":"courier";
 const previewUrl=`/prototype-preview/${surface}.html`+(surface==="courier"&&requirementId==="CR-029"?"#page=courier.home":"");
 const [open,setOpen]=useState(false),[review,setReview]=useState(null),[text,setText]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),dialog=useRef(null),title=useId();
 useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();if(!open&&dialog.current?.open)dialog.current.close();},[open]);
 useEffect(()=>{if(!open)return;let active=true;const load=async()=>{try{const response=await fetch(`/api/analysis/cx-recycle/${requirementId}/acceptance`,{cache:"no-store"}),data=await response.json();if(active&&response.ok)setReview(previous=>JSON.stringify(previous)===JSON.stringify(data)?previous:data);}catch{}};load();const timer=setInterval(load,4000);return()=>{active=false;clearInterval(timer);};},[open,requirementId]);
 async function submitAdjustment(){if(busy||!text.trim()||!review?.ready)return;setBusy(true);setMessage("");try{const response=await fetch(`/api/analysis/cx-recycle/${requirementId}/acceptance`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId:crypto.randomUUID(),version:review.version,text:text.trim(),confirmAdjustmentAndContinue:true}),signal:AbortSignal.timeout(15000)}),data=await response.json();if(!response.ok)throw Error(data.message);setReview(data);setText("");setMessage("调整意见已提交，AI 正在继续处理。");}catch(error){setMessage(`${error.name==="TimeoutError"?"提交回执暂未返回":error.message}。请刷新核查，不会自动重复提交。`);}finally{setBusy(false);}}
 async function acceptPrototype(){if(busy||!review?.ready||text.trim())return;setBusy(true);setMessage("");try{const response=await fetch(`/api/analysis/cx-recycle/${requirementId}/acceptance`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId:crypto.randomUUID(),version:review.version,confirmPrototypeAccepted:true}),signal:AbortSignal.timeout(15000)}),data=await response.json();if(!response.ok)throw Error(data.message);setReview(data);setMessage("原型已确认，本轮原型验证完成。未发布或接入生产。");}catch(error){const reason=error.name==="TimeoutError"?"确认回执暂未返回":String(error.message||"确认失败").replace(/[。；;]+$/u,"");setMessage(`${reason}。请刷新核查，不会自动重复提交。`);}finally{setBusy(false);}}
 function showCompletion(){setOpen(false);setTimeout(()=>document.dispatchEvent(new CustomEvent("product-os:open-requirement",{detail:{key:`cx-recycle:${requirementId}`}})),0);}
 return <>
  <button className="button primary" onClick={()=>setOpen(true)}>预览原型</button>
  <dialog ref={dialog} className="scope-dialog prototype-preview-dialog" aria-labelledby={title} onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)}>
   <header><div><span className="section-kicker">本轮修改结果</span><h2 id={title}>{requirementId} · {surface==="admin"?"运营后台":surface==="mobile"?"用户端":"小哥端"}</h2></div><button className="text-button" onClick={()=>setOpen(false)} aria-label="关闭原型预览">关闭</button></header>
   <p className="snapshot-note">本机演示数据 · 不代表生产效果</p>
   <div className="prototype-device"><iframe src={previewUrl} title={`${requirementId} 前端原型`}/></div>
   <section className="prototype-feedback" aria-label={review?.accepted?"原型确认结果":"原型调整意见"}>
    {review?.accepted?<><label>本轮已完成</label><p>原型已经确认，完成记录已写入需求台账。未发布或接入生产。</p></>:<><label htmlFor={`${title}-feedback`}>需要调整</label><p>直接写下你看到的问题。同范围调整可直接继续，不重复原型制作授权。</p><textarea id={`${title}-feedback`} rows="3" value={text} onChange={event=>setText(event.target.value)} placeholder="例如：奖牌里的数字需要垂直居中，第四名以后只显示数字" disabled={busy||Boolean(review?.job)}/></>}
    {message&&<small role="status">{message}</small>}
    {review?.job&&<small role="status">{review.job.message}</small>}
   </section>
   <div className="analysis-actions prototype-preview-actions"><a className="button secondary" href={previewUrl} target="_blank" rel="noreferrer">新窗口打开</a>{review?.accepted?<button className="button primary" onClick={showCompletion}>返回需求查看完成记录</button>:<><button className="button secondary" onClick={()=>setOpen(false)}>返回需求</button><button className="button secondary" disabled={busy||Boolean(text.trim())||!review?.ready||Boolean(review?.job)} onClick={acceptPrototype}>确认原型并完成本轮</button><button className="button primary" disabled={busy||!text.trim()||!review?.ready||Boolean(review?.job)} onClick={submitAdjustment}>{busy?"正在提交…":"确认调整并继续"}</button></>}</div>
  </dialog>
 </>;
}
