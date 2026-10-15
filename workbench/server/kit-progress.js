export function appendKitProgress(record,{id,at,actor,action,result,authorization=false,nextActor}){
  if(!id||!at||!actor||!action||!result||!nextActor)throw Error("INVALID_PROGRESS_EVENT");
  const events=record.workbenchProgress||[];
  if(events.some(event=>event.id===id))return record;
  record.workbenchProgress=[...events,{id,at,actor,action,result,authorization,nextActor}];
  return record;
}
