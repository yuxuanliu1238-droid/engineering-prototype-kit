const validTime=value=>value&&Number.isFinite(Date.parse(value));
const productLanguage=value=>String(value||"")
  .replaceAll("业务决定","业务方案")
  .replaceAll("已明确授权本轮原型实施","已授权制作原型")
  .replaceAll("执行端已接单，正在生成本轮修改","AI 已开始制作原型")
  .replaceAll("修改方案已返回，正在核对文件版本并应用","原型修改已生成，正在检查")
  .replaceAll("本轮修改已写入，待检查与审阅；尚未验收完成。","原型已更新，等待检查和预览确认。")
  .replaceAll("等待授权继续实施","历史调整记录（现流程无需重复授权）")
  .replaceAll("未授权实施","尚未授权制作原型")
  .replaceAll("实施授权","原型制作授权");

export function buildRequirementActivity({record,analysis,questions,review,business,implementation,acceptance,productionPreparation}) {
  const rows=[];
  const add=(id,time,title,detail,kind="system",items=[])=>rows.push({id,time:validTime(time)?time:null,title:productLanguage(title),detail:productLanguage(detail),kind,items});
  for(const stage of record?.stages||[]) add(`stage:${stage.id}`,stage.updatedAt,stage.label,stage.note,"stage");
  for(const [index,event] of (analysis?.job?.events||[]).entries()) add(`analysis:${index}`,event.time,event.label,analysis.job.message,"ai");
  const answered=(questions?.review?.questions||[]).filter(item=>item.savedAt);
  if(answered.length){
    const latest=[...answered].sort((a,b)=>Date.parse(b.savedAt)-Date.parse(a.savedAt))[0];
    add("answers",latest.savedAt,`已回答 ${answered.length} 个问题`,"单题保存已合并展示","user",answered.map(item=>({label:item.text,time:item.savedAt})));
  }
  const submission=questions?.review?.submission;
  if(submission)add(`submission:${submission.requestId}`,submission.submittedAt,"全部回答已提交","等待 AI 核对","user");
  for(const [index,event] of (review?.job?.events||[]).entries())add(`review:${index}`,event.time,event.label,review.job.message,"ai");
  const decision=business?.review?.receipt;
  if(decision)add(`decision:${decision.requestId}`,decision.confirmedAt,"业务方案已确认",`${decision.items?.length||0} 项业务规则已保存`,"user");
  for(const [index,event] of (implementation?.job?.events||[]).entries())add(`implementation:${index}`,event.time,event.label,implementation.job.message,event.label.includes("授权")?"user":"ai");
  if(acceptance?.adjustment)add(`adjustment:${acceptance.adjustment.requestId}`,acceptance.adjustment.createdAt,"已提出调整","同范围调整已记录，可直接继续制作原型","user");
  if(productionPreparation?.delivery)add(`prototype-delivery:${productionPreparation.delivery.requestId}`,productionPreparation.delivery.createdAt,"原型交付清单已确认","本轮工程化原型已完成，没有新增原型制作授权","user");
  return rows.sort((a,b)=>(validTime(b.time)?Date.parse(b.time):-Infinity)-(validTime(a.time)?Date.parse(a.time):-Infinity));
}

export function formatActivityTime(value){
  if(!validTime(value)||!/\d{2}:\d{2}/.test(value))return {date:value||"日期未记录",time:"具体时间未记录"};
  const date=new Date(value),options={timeZone:"Asia/Shanghai",hour12:false};
  return {date:date.toLocaleDateString("sv-SE",options),time:date.toLocaleTimeString("zh-CN",{...options,hour:"2-digit",minute:"2-digit",second:"2-digit"})};
}
