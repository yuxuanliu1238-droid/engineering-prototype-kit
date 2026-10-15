import {useEffect,useRef,useState} from "react";
import {useRefreshParticipant} from "./UnifiedRefresh";
import {buildRequirementActivity,formatActivityTime} from "./requirement-activity";

export default function RequirementActivity({record}){
 const base=`/api/analysis/cx-recycle/${record.id}`,endpoints=[base,`${base}/questions`,`${base}/review`,`${base}/decisions`,`${base}/implementation`,`${base}/acceptance`,`${base}/prototype-delivery`];
 const [sources,setSources]=useState([]),[error,setError]=useState("");
 const mounted=useRef(false),loading=useRef(false);
 async function load(){if(loading.current)return;loading.current=true;try{const values=await Promise.all(endpoints.map(async endpoint=>{const response=await fetch(endpoint,{cache:"no-store",signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();return response.json();}));if(mounted.current){setSources(previous=>JSON.stringify(previous)===JSON.stringify(values)?previous:values);setError("");}}catch{if(mounted.current)setError("部分工作台进度暂时无法读取，请使用顶部刷新。已显示台账记录。");}finally{loading.current=false;}}
 useRefreshParticipant(load,false);
 useEffect(()=>{mounted.current=true;load();const timer=setInterval(load,4000);return()=>{mounted.current=false;clearInterval(timer);};},[record.id]);
 const [analysis,questions,review,business,implementation,acceptance,productionPreparation]=sources;
 const rows=buildRequirementActivity({record,analysis,questions,review,business,implementation,acceptance,productionPreparation});
 return <aside className="stage-rail activity-rail" aria-label="处理进度时间轴"><div className="section-kicker">处理进度</div>{error&&<p role="status" className="activity-warning">{error}</p>}<ol>{rows.map(item=>{const time=formatActivityTime(item.time);return <li key={item.id} className={`activity-${item.kind}`}><div className="activity-entry"><span className="stage-marker"/><strong>{item.title}</strong><time dateTime={item.time||undefined}>{time.date}</time><small>{time.time}</small>{item.detail&&<p>{item.detail}</p>}{item.items.length>0&&<details><summary>查看 {item.items.length} 项回答</summary>{item.items.map((child,index)=>{const childTime=formatActivityTime(child.time);return <p key={index}>{childTime.time} · {child.label}</p>;})}</details>}</div></li>;})}</ol></aside>;
}
