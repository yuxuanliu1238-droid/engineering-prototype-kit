import {createContext,useContext,useEffect,useRef} from "react";
export const RefreshContext=createContext(null);
export function useRefreshParticipant(load,busy=false) {
  const participants=useContext(RefreshContext),latest=useRef({load,busy});
  latest.current={load,busy};
  useEffect(()=>{
    if(!participants)return;
    const participant={busy:()=>latest.current.busy,load:()=>latest.current.load()};
    participants.add(participant);
    return()=>participants.delete(participant);
  },[participants]);
}
