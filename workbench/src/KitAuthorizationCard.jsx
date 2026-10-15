import {useEffect,useRef,useState} from "react";

export default function KitAuthorizationCard({projectId,item,onSaved}){
  const [plan,setPlan]=useState(null),[receipt,setReceipt]=useState(item.workbenchAuthorization||null),
    [registrySha256,setRegistrySha256]=useState(""),[checked,setChecked]=useState(false),
    [busy,setBusy]=useState(false),[error,setError]=useState("");
  const requestId=useRef(null),endpoint=`/api/projects/${projectId}/requirements/${item.id}/authorization`;
  async function load(){try{const response=await fetch(endpoint,{cache:"no-store",signal:AbortSignal.timeout(10000)}),data=await response.json();
      if(!response.ok)throw Error(data.message||"授权范围暂时无法读取。");setPlan(data.plan);setReceipt(data.receipt);setRegistrySha256(data.registrySha256);setError("");
    }catch(cause){setError(cause.message);}}
  useEffect(()=>{if(item.stageId==="awaiting-authorization")load();},[endpoint,item.stageId]);
  async function authorize(){if(busy||!checked||!plan?.canAuthorize||!registrySha256)return;
    requestId.current ||= crypto.randomUUID();setBusy(true);setError("");
    try{const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({requestId:requestId.current,planHash:plan.planHash,registrySha256,confirmAuthorizationOnly:true}),
      signal:AbortSignal.timeout(15000)}),data=await response.json();
      if(!response.ok)throw Error(data.message||"授权未能保存。");setReceipt(data.receipt);await onSaved?.();
    }catch(cause){setError(cause.message+" 请刷新台账核查，不会自动重复授权或开工。");await load();}
    finally{setBusy(false);}}
  if(item.stageId!=="awaiting-authorization")return null;
  return <section className="kit-authorization-card" aria-label="本轮独立实施授权">
    {receipt?<><strong>已授权本轮范围 · AI 尚未开工</strong><p>授权于 {new Date(receipt.confirmedAt).toLocaleString("zh-CN",{hour12:false})}；仅限列明的项目交付物。</p><small>下一步由你明确启动实施；授权本身不会自动修改项目。</small></>:
      <><strong>当前需要你 · 授权本轮工程化交付</strong><p>{plan?.objective||"正在核对允许范围…"}</p>
        {plan&&<details open><summary>允许范围与排除项</summary><p>主成果：{plan.outputs?.join("、")||"尚未核对"}</p>
          <p>影响支线：{plan.branches?.join("、")||"无"}</p>
          <p>允许修改：{plan.existingFiles?.map(file=>file.path).join("、")||"无已有文件"}</p>
          <p>允许新建：{plan.createFiles?.join("、")||"无"}</p>
          <p>不包含：{plan.excludes?.join("、")||"无"}</p></details>}
        {plan?.reasons?.map((reason,index)=><p className="form-error" key={index}>{reason}</p>)}
        <label className="implementation-consent"><input type="checkbox" checked={checked} disabled={!plan?.canAuthorize||busy} onChange={event=>setChecked(event.target.checked)}/>
          我确认仅允许列明的交付物；不进入正式生产开发、部署或发布。</label>
        <button className="button primary" disabled={!plan?.canAuthorize||!checked||busy} onClick={authorize}>{busy?"正在保存授权…":"授权实施本轮"}</button>
      </>}
    {error&&<p className="form-error" role="alert">{error}</p>}
  </section>;
}
