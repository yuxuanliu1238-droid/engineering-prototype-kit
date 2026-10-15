const formatTime=value=>{
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"时间待核对":date.toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",hour12:false,
    year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"});
};

function ProgressItems({events}){
  return <ol className="kit-progress-list">{events.map(event=><li key={event.id}>
    <time dateTime={event.at}>{formatTime(event.at)}</time>
    <div><strong>{event.action}</strong><span>{event.actor}</span><p>{event.result}</p>
      {event.authorization&&<small>形成实施授权</small>}<small>下一步：{event.nextActor}</small></div>
  </li>)}</ol>;
}

export default function KitProgress({item}){
  const events=[...(item.workbenchProgress||[])].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
  if(!events.length)return null;
  return <section className="kit-progress" aria-label="处理进度">
    <div className="kit-progress-heading"><strong>处理进度</strong><span>{events.length} 条记录</span></div>
    <ProgressItems events={events.slice(0,3)}/>
    {events.length>3&&<details><summary>查看较早的 {events.length-3} 条</summary><ProgressItems events={events.slice(3)}/></details>}
  </section>;
}
