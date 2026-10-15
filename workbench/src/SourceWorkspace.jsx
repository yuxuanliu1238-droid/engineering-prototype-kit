import { useEffect, useMemo, useRef, useState } from "react";
import { ProjectPage } from "./ProjectPage";
import ReadOnlyRequirement from "./ReadOnlyRequirement";
import { sourceSnapshot as initialSnapshot, materializeSourceRequirements, executionLabels, filterSourceRequirements, pendingSourceRequirements } from "./source-requirements";
import { useSourceRefresh } from "./useSourceRefresh";
import AnalysisPanel from "./AnalysisPanel";
import {RefreshContext} from "./UnifiedRefresh";
import {defaultRequirementTemplateId, getRequirementTemplate, requirementTemplates} from "./requirement-templates";
import TypeRecommendation from "./TypeRecommendation";

const emptyFilters = {query:"",project:"",stage:"",status:""};
export default function SourceWorkspace({ page }) {
  const {snapshot:sourceSnapshot,error,changes,refreshing,refresh}=useSourceRefresh(initialSnapshot);
  const participants=useRef(new Set()),refreshLock=useRef(false);
  const [updating,setUpdating]=useState(false),[refreshNote,setRefreshNote]=useState("");
  async function refreshAll() {
    if(refreshLock.current)return;
    if([...participants.current].some(item=>item.busy())){setRefreshNote("请等待当前保存完成，再刷新。");return;}
    refreshLock.current=true;setUpdating(true);setRefreshNote("");
    try {await Promise.all([refresh(),...[...participants.current].map(item=>item.load())]);}
    finally {refreshLock.current=false;setUpdating(false);}
  }
  const sourceRequirements=useMemo(()=>materializeSourceRequirements(sourceSnapshot),[sourceSnapshot]);
  const findSourceRequirement=key=>sourceRequirements.find(item=>item.key===key);
  const [filters, setFilters] = useState(emptyFilters);
  const [selection, setSelection] = useState(null);
  const [creating, setCreating] = useState(false);
  const [opening,setOpening]=useState(null);
  const [homeActions,setHomeActions]=useState(null);
  const [homeNotices,setHomeNotices]=useState(null);
  const returnTarget = useRef(null);
  const scroll = useRef(0);
  useEffect(() => { setSelection(null); setCreating(false); }, [page]);
  const selected = selection?.origin === page ? findSourceRequirement(selection.key) : null;
  async function open(key) {
    if (!findSourceRequirement(key)) return;
    scroll.current = window.scrollY;
    returnTarget.current = document.activeElement;
    setOpening(key);
    await refresh();
    setSelection({key,origin:page});
    setOpening(null);
    window.scrollTo(0,0);
  }
  useEffect(()=>{const handle=event=>{if(event.detail?.key)open(event.detail.key);};document.addEventListener("product-os:open-requirement",handle);return()=>document.removeEventListener("product-os:open-requirement",handle);},[sourceRequirements,page]);
  function back() {
    setSelection(null);
    requestAnimationFrame(() => {returnTarget.current?.focus({preventScroll:true});window.scrollTo(0,scroll.current);});
  }
  function openCreate() { setSelection(null); setCreating(true); window.scrollTo(0,0); }
  async function registered(item) {
    setCreating(false);
    const nextSnapshot = await refresh();
    if (nextSnapshot) setSelection({key:`cx-recycle:${item.id}`,origin:page});
  }
  const visible = filterSourceRequirements(sourceRequirements,filters);
  const pending = pendingSourceRequirements(sourceRequirements);
  const primaryPending = pending[0];
  const pendingQueue = pending.slice(1);
  const activeRequirements = sourceRequirements.filter(item=>item.executionState==="in-progress");
  const attentionRequirements = sourceRequirements.filter(item=>["paused","unknown"].includes(item.executionState));
  const recentRequirements = sourceRequirements.slice(-4).reverse();
  const change = key => event => setFilters({...filters,[key]:event.target.value});
  const refreshRef=useRef(refresh);refreshRef.current=refresh;
  useEffect(()=>{
    const update=()=>refreshRef.current({silent:true});
    const visible=()=>{if(document.visibilityState==="visible")update();};
    const timer=setInterval(update,5000);
    window.addEventListener("focus",update);document.addEventListener("visibilitychange",visible);
    return()=>{clearInterval(timer);window.removeEventListener("focus",update);document.removeEventListener("visibilitychange",visible);};
  },[page]);
  return <RefreshContext.Provider value={participants.current}>
    <section className="source-refresh-bar" aria-label="刷新工作台"><div><span>cx回收 · 最近读取 {new Date(sourceSnapshot.readAt).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",hour12:false})}</span><small>同步台账、范围与回答状态；页面契约仍为已有快照</small></div><button className="button primary" disabled={refreshing||updating} onClick={refreshAll}>{updating ? "正在刷新…" : "刷新工作台"}</button></section>
    {refreshNote&&<p role="status" className="refresh-feedback">{refreshNote}</p>}
    {opening&&<p role="status" className="refresh-feedback">正在读取最新需求状态…</p>}
    {error && <div role="alert" className="refresh-feedback">{error}</div>}
    {changes && <div className="refresh-feedback" role="status">{changes.added.length+changes.removed.length+changes.updated.length === 0 ? "读取成功，展示内容无变化。" : `读取成功：新增 ${changes.added.length} 条，更新 ${changes.updated.length} 条，移出 ${changes.removed.length} 条。`}{changes.added.length+changes.removed.length+changes.updated.length > 0 && <details><summary>查看变化</summary>{[["新增",changes.added],["更新",changes.updated],["移出当前快照",changes.removed]].map(([label,items])=>items.map(item=><p key={`${label}:${item.id}`}>{label} · {item.id} · {item.title}</p>))}<small>仅替换工作台缓存，不修改源项目。</small></details>}</div>}
    {selection?.origin===page && !selected && <p className="refresh-feedback">这条需求已不在当前台账中，已返回来源列表。</p>}
    {creating && <SourceNewRequirement onCancel={()=>setCreating(false)} onRegistered={registered} />}
    {selected && !creating && <div className="page source-detail"><ReadOnlyRequirement key={selected.key} record={selected} onBack={back} onRefresh={refreshAll} /></div>}
    <div hidden={Boolean(selected)||creating}>
      <div hidden={page !== "projects"}><ProjectPage onCreate={openCreate} onOpen={open} requirements={sourceRequirements} snapshot={sourceSnapshot} /></div>
      <div hidden={page !== "requirements"} className="page source-index">
        <header className="index-header"><div><div className="eyebrow">跨项目需求</div><h1>需求</h1><p>当前已读取 cx回收 · {sourceRequirements.length} 条</p></div><button className="button primary" onClick={openCreate}>＋ 新建需求</button></header>
        <div className="source-filters"><label>搜索<input type="search" value={filters.query} onChange={change("query")} placeholder="需求编号或名称" /></label><label>项目<select value={filters.project} onChange={change("project")}><option value="">全部项目</option><option value={sourceSnapshot.projectId}>cx回收</option></select></label><label>阶段<select value={filters.stage} onChange={change("stage")}><option value="">全部阶段</option>{filters.stage && !sourceRequirements.some(item=>item.stageId===filters.stage) && <option value={filters.stage}>原筛选：{filters.stage}（已无记录）</option>}{[...new Map(sourceRequirements.map(item=>[item.stageId,item.stage])).entries()].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>台账状态<select value={filters.status} onChange={change("status")}><option value="">全部状态</option>{filters.status && !sourceRequirements.some(item=>item.executionState===filters.status) && <option value={filters.status}>原筛选：{executionLabels[filters.status]||filters.status}（已无记录）</option>}{[...new Set(sourceRequirements.map(item=>item.executionState))].map(state=><option key={state} value={state}>{executionLabels[state]||state}</option>)}</select></label><button className="text-button" onClick={()=>setFilters(emptyFilters)}>清除筛选</button></div>
        <p className="snapshot-note">{visible.length} 条结果 · 只读快照，不代表实时执行状态</p>
        <div className="source-requirement-list">{[...visible].reverse().map(item=><button className="source-requirement-row" key={item.key} onClick={()=>open(item.key)}><small>{item.id}</small><strong>{item.title}</strong><span>{item.project}</span><span>{item.stage}</span><em>{executionLabels[item.executionState]||item.executionState}</em></button>)}</div>
        {!visible.length && <p className="notice">没有符合筛选条件的需求。可清除筛选后重试。</p>}
      </div>
      <div hidden={page !== "home"} className="page source-home">
        <header className="index-header"><div><div className="eyebrow">工作台</div><h1>需要你决定的事</h1><p>来自 cx回收台账 · 工程化原型工作流</p></div><div className="requirement-heading-actions"><button className="button primary" onClick={openCreate}>＋ 新建需求</button><div ref={setHomeActions} /></div></header>
        <div className="requirement-top-notices" ref={setHomeNotices} />
        <div className="source-home-grid">
          <section className="source-home-primary" aria-label="待你处理">
            <div className="overview-heading"><div><span className="section-kicker">优先处理</span><h2>待你处理</h2></div><span>{pending.length} 条</span></div>
            {primaryPending&&<article className="focus-decision" key={primaryPending.key}>
              <div className="focus-decision-meta"><span className="status-dot amber"/><span>{primaryPending.project} · {primaryPending.id}</span><em>{primaryPending.stage}</em></div>
              <h2>{primaryPending.title}</h2>
              <p className="focus-question">{primaryPending.waiting?.question || (primaryPending.stageId==="waiting-start"?"需求已登记，等待你启动 AI 分析。":"台账标记为等待确认，具体问题尚未记录。")}</p>
              <div className="focus-evidence"><div><span>当前结论</span><strong>{primaryPending.note || primaryPending.stages?.find(stage=>["waiting_user","active"].includes(stage.status))?.note || "等待你的业务判断"}</strong></div><div><span>决策影响</span><strong>{primaryPending.waiting?.impact || "确认结果将决定这条需求能否进入下一阶段。"}</strong></div><div><span>关联内容</span><strong>{primaryPending.pages?.length || 0} 个页面 · {primaryPending.artifacts?.length || 0} 项成果</strong></div></div>
              {primaryPending.requirementType&&<AnalysisPanel record={primaryPending} onRefresh={refresh} compact/>}
              <div className="focus-actions"><button className="button secondary" onClick={()=>open(primaryPending.key)}>查看详情</button><button className="button primary" onClick={()=>open(primaryPending.key)}>进入处理</button></div>
            </article>}
            {pendingQueue.length>0&&<div className="decision-queue"><div className="queue-heading"><strong>接下来</strong><span>{pendingQueue.length} 条待处理</span></div>{pendingQueue.map((item,index)=><button key={item.key} onClick={()=>open(item.key)}><span className="queue-number">{String(index+2).padStart(2,"0")}</span><span className="queue-copy"><strong>{item.title}</strong><small>{item.id} · {item.stage}</small></span><em>{item.waiting?.question || "等待你的确认"}</em><span className="queue-action">处理</span></button>)}</div>}
            {!pending.length && <div className="quiet-empty"><strong>现在没有需要你决定的事</strong><span>AI 会在需要业务判断或授权时把事项放到这里。</span></div>}
          </section>
          <aside className="source-home-aside" aria-label="AI 动态">
            <section className="activity-panel"><div className="overview-heading"><div><span className="section-kicker">实时状态</span><h2>AI 正在执行</h2></div><span>{activeRequirements.length} 项</span></div>{activeRequirements.length?<div className="mini-activity-list">{activeRequirements.map(item=><button key={item.key} onClick={()=>open(item.key)}><span className="running-dot"/><span><strong>{item.title}</strong><small>{item.id} · {item.stage}</small></span></button>)}</div>:<div className="quiet-mini"><strong>当前没有执行中的任务</strong><span>需要授权时会先进入“待你处理”。</span></div>}{page === "home" && !selected && sourceRequirements.some(item=>item.id==="CR-029")&&<AnalysisPanel record={sourceRequirements.find(item=>item.id==="CR-029")} onRefresh={refresh} actionTarget={homeActions} noticeTarget={homeNotices} compact/>}</section>
            <section className="attention-panel"><div className="overview-heading"><div><span className="section-kicker">风险与阻断</span><h2>需要关注</h2></div><span>{attentionRequirements.length} 项</span></div>{attentionRequirements.length?<div className="mini-attention-list">{attentionRequirements.map(item=><button key={item.key} onClick={()=>open(item.key)}><span className="status-dot red"/><span><strong>{item.title}</strong><small>{executionLabels[item.executionState]||item.executionState}</small></span></button>)}</div>:<p>当前没有暂停、断线或状态不明的事项。</p>}</section>
            <section className="recent-panel"><div className="overview-heading"><div><span className="section-kicker">项目动态</span><h2>最近需求</h2></div></div><div className="mini-recent-list">{recentRequirements.map(item=><button key={item.key} onClick={()=>open(item.key)}><span><strong>{item.title}</strong><small>{item.id} · {item.stage}</small></span><em>{executionLabels[item.executionState]||item.executionState}</em></button>)}</div></section>
          </aside>
        </div>
        <p className="source-path">资料读取：{new Date(sourceSnapshot.readAt).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",hour12:false})} · 刷新页面不会重新读取项目</p>
      </div>
    </div>
  </RefreshContext.Provider>;
}

function SourceNewRequirement({onCancel,onRegistered}) {
  const [templateId,setTemplateId]=useState(defaultRequirementTemplateId);
  const [impactTags,setImpactTags]=useState(getRequirementTemplate(defaultRequirementTemplateId).defaultImpactTags);
  const [description,setDescription]=useState("");
  const [materials,setMaterials]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const requestId=useRef(null);
  async function submit(event) {
    event.preventDefault();
    const clean=description.trim();
    if(clean.length<2){setError("请先填写需求描述。");return;}
    if(busy)return;
    requestId.current ||= crypto.randomUUID();
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/requirements/cx-recycle",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:"cx-recycle",templateId,impactTags,description:clean,materials:materials.trim(),confirmRecordOnly:true,requestId:requestId.current})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||"登记失败");
      await onRegistered(result.requirement);
    } catch (cause) {
      setError(cause.message === "Failed to fetch" ? "登记回执暂未返回，请先刷新工作台核查，系统不会自动重复提交。" : cause.message);
    } finally {setBusy(false);}
  }
  const template=getRequirementTemplate(templateId);
  return <div className="page source-new-requirement">
    <header className="index-header"><div><div className="eyebrow">cx回收 · 正式登记</div><h1>新建需求</h1><p>写清楚要解决的业务问题即可。</p></div><button type="button" className="text-button" onClick={onCancel} disabled={busy}>取消</button></header>
    <form className="requirement-form source-requirement-form" onSubmit={submit}>
      <label>所属项目<select value="cx-recycle" disabled><option value="cx-recycle">cx回收</option></select></label>
      <label>需求类型<select value={templateId} onChange={event=>{const type=event.target.value;setTemplateId(type);setImpactTags(getRequirementTemplate(type).defaultImpactTags);}}>{requirementTemplates.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>需求描述<textarea autoFocus value={description} onChange={event=>setDescription(event.target.value)} maxLength={5000} placeholder="例如：在小哥首页增加……，希望解决……" /></label>
      <TypeRecommendation description={description} projectName="cx回收" disabled={busy} onAdopt={suggestion=>{setTemplateId(suggestion.mainType);setImpactTags(suggestion.impactTags);}}/>
      <details className="impact-tag-picker"><summary>影响范围 · {impactTags.length} 项</summary>{[["frontend-page","前端页面"],["backend-logic","后台业务逻辑"],["state-data","状态与数据"],["external-interface","外部接口"],["requirement-document","需求文档"]].map(([id,label])=><label key={id}><input type="checkbox" checked={impactTags.includes(id)} disabled={templateId==="existing-page-adjustment"&&id==="frontend-page"} onChange={event=>setImpactTags(current=>event.target.checked?[...current,id]:current.filter(tag=>tag!==id))}/>{label}</label>)}</details>
      <label>补充材料 <span>选填</span><textarea className="short" value={materials} onChange={event=>setMaterials(event.target.value)} maxLength={10000} placeholder="可填写背景、参考链接或现有规则" /></label>
      <aside className="record-only-note"><strong>本次只登记</strong><p>保存后自动生成 CR 编号并写入项目台账。不会启动 AI，也不会修改原型、页面说明或业务项目。</p></aside>
      {template&&<details className="template-preview"><summary>将使用“{template.name}”工作流</summary><p>{template.description}</p><ol>{template.stages.map(item=><li key={item.id}>{item.label}</li>)}</ol><p>AI 只询问会改变业务结果的问题；常规设计默认由 AI 提出建议并处理。</p></details>}
      {error&&<p className="form-error" role="alert">{error}</p>}
      <div className="action-buttons"><button className="button primary" type="submit" disabled={busy||description.trim().length<2}>{busy?"正在登记…":"登记需求"}</button><button className="button ghost" type="button" onClick={onCancel} disabled={busy}>取消</button></div>
    </form>
  </div>;
}
