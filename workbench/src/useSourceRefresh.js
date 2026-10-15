import { useEffect, useRef, useState } from "react";
import { readCachedSource, fetchAndSaveSource } from "./source-refresh.js";

export function useSourceRefresh(fallback) {
  const [initial] = useState(()=>{
    if(typeof window === "undefined")return {snapshot:fallback,warning:""};
    try{return readCachedSource(window.localStorage,fallback);}catch{return {snapshot:fallback,warning:"浏览器存储不可用，正在显示内置快照。"};}
  });
  const [snapshot,setSnapshot]=useState(initial.snapshot);
  const [error,setError]=useState(initial.warning);
  const [changes,setChanges]=useState(null);
  const [refreshing,setRefreshing]=useState(false);
  const controller=useRef(null);
  const inFlight=useRef(null);
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort();};},[]);
  async function refresh({silent=false}={}) {
    if(inFlight.current)return inFlight.current;
    const abort=new AbortController();
    controller.current=abort;
    if(!silent){setRefreshing(true);setError("");setChanges(null);}
    const timeout=setTimeout(()=>abort.abort(),10000);
    const task=(async()=>{try {
      const result=await fetchAndSaveSource({fetcher:window.fetch.bind(window),storage:window.localStorage,previous:snapshot,signal:abort.signal});
      if(!alive.current)return null;
      const changed=result.changes.added.length+result.changes.updated.length+result.changes.removed.length>0;
      if(changed)setSnapshot(result.snapshot);
      if(!silent)setChanges(result.changes);
      return result.snapshot;
    } catch(err) {
      if(alive.current&&!silent)setError(err.name === "AbortError" ? "读取超时，已保留上一份数据，可重试。" : "刷新失败：台账、读取服务或本地保存不可用。已保留上一份数据，可重试。");
      return null;
    } finally {
      clearTimeout(timeout);controller.current=null;
      if(alive.current&&!silent)setRefreshing(false);
    }})();
    inFlight.current=task;
    try{return await task;}finally{inFlight.current=null;}
  }
  return {snapshot,error,changes,refreshing,refresh};
}
