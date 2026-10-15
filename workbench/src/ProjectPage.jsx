import { useEffect,useRef,useState } from "react";
import ProjectOverview from "./ProjectOverview";
import {requirementTemplates,getRequirementTemplate,defaultRequirementTemplateId} from "./requirement-templates";
import TypeRecommendation from "./TypeRecommendation";
import KitAnalysisCard from "./KitAnalysisCard";
import KitAuthorizationCard from "./KitAuthorizationCard";
import KitImplementationCard from "./KitImplementationCard";
import KitReviewCard from "./KitReviewCard";
import KitReplanCard from "./KitReplanCard";
import KitProgress from "./KitProgress";
import KitCompletedCard from "./KitCompletedCard";
import RequirementTemplatePreview from "./RequirementTemplatePreview";

const lifecycleLabels={"awaiting-analysis":"待分析","awaiting-plan":"待确认方案","awaiting-authorization":"待授权",executing:"执行中","awaiting-review":"待验收",completed:"已完成"};
const legacyLifecycleLabels={recorded:"待分析","awaiting-authorization":"待授权",implementation:"执行中","awaiting-review":"待验收",completed:"已完成"};

export function ProjectPage({ onCreate, onOpen, requirements, snapshot }) {
  const [projects,setProjects]=useState([]),[selected,setSelected]=useState(null),[kitData,setKitData]=useState(null),[kitError,setKitError]=useState("");
  const [kitSyncError,setKitSyncError]=useState(false),kitRequestSequence=useRef(0),selectedKitId=useRef(null);
  const [creatingKit,setCreatingKit]=useState(false),[kitType,setKitType]=useState(defaultRequirementTemplateId),[kitTags,setKitTags]=useState(getRequirementTemplate(defaultRequirementTemplateId).defaultImpactTags),[kitDescription,setKitDescription]=useState(""),[kitConfirmed,setKitConfirmed]=useState(false),[kitBusy,setKitBusy]=useState(false),[kitRequestId,setKitRequestId]=useState(null);
  useEffect(()=>{let active=true;const load=async()=>{try{const response=await fetch("/api/projects",{cache:"no-store",signal:AbortSignal.timeout(10000)}),data=await response.json();if(!response.ok)throw Error(data.message);if(active)setProjects(previous=>JSON.stringify(previous)===JSON.stringify(data.projects)?previous:data.projects);}catch(error){if(active)setKitError(error.message||"项目暂时无法读取。");}};load();const timer=setInterval(load,15000);return()=>{active=false;clearInterval(timer);};},[]);
  async function openKit(project,{create=false}={}){selectedKitId.current=project.id;const sequence=++kitRequestSequence.current;
    setSelected(project);if(create||selected?.id!==project.id)setKitData(null);setKitError("");setCreatingKit(create);if(create){setKitRequestId(crypto.randomUUID());setKitConfirmed(false);setKitDescription("");}
    try{const response=await fetch(`/api/projects/${project.id}/requirements`,{cache:"no-store",signal:AbortSignal.timeout(10000)}),data=await response.json();if(!response.ok)throw Error(data.message);
      if(sequence!==kitRequestSequence.current||selectedKitId.current!==project.id)return;
      setKitData(previous=>previous?.sha256===data.sha256?previous:data);setKitSyncError(false);
    }catch(error){if(sequence===kitRequestSequence.current&&selectedKitId.current===project.id){setKitError(error.message||"项目台账暂时无法读取。");setKitSyncError(true);}}}
  useEffect(()=>{if(!selected||creatingKit)return;let active=true;
    const refresh=async()=>{if(document.visibilityState!=="visible")return;const sequence=++kitRequestSequence.current;
      try{const response=await fetch(`/api/projects/${selected.id}/requirements`,{cache:"no-store",signal:AbortSignal.timeout(10000)}),data=await response.json();
        if(!response.ok)throw Error("SYNC_FAILED");
        if(active&&sequence===kitRequestSequence.current&&selectedKitId.current===selected.id){
          setKitData(previous=>previous?.sha256===data.sha256?previous:data);setKitSyncError(false);}
      }catch{if(active&&sequence===kitRequestSequence.current&&selectedKitId.current===selected.id)setKitSyncError(true);}};
    const visible=()=>{if(document.visibilityState==="visible")refresh();};
    const timer=setInterval(refresh,5000);window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",visible);
    return()=>{active=false;clearInterval(timer);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",visible);};
  },[selected?.id,creatingKit]);
  async function registerKit(){if(kitBusy||!selected||!kitData||!kitConfirmed||kitDescription.trim().length<2)return;setKitBusy(true);setKitError("");try{
    const response=await fetch(`/api/projects/${selected.id}/requirements`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId:kitRequestId,description:kitDescription.trim(),requirementType:kitType,impactTags:kitTags,confirmRecordOnly:true,registrySha256:kitData.sha256}),signal:AbortSignal.timeout(15000)}),data=await response.json();
    if(!response.ok)throw Error(data.message);setCreatingKit(false);await openKit(selected);
  }catch(error){setKitError((error.name==="TimeoutError"?"登记回执暂未返回。":error.message)+" 请刷新项目台账核查，不会自动重复提交。");}finally{setKitBusy(false);}}
  return <div className="page project-page">
    <header className="index-header"><div><div className="eyebrow">项目空间</div><h1>你的项目</h1><p>先选择项目，再处理属于它的需求、页面与证据。</p></div><span className="project-badge">独立台账 · 独立授权</span></header>
    <nav className="project-switcher" aria-label="项目切换"><button className={!selected?"active":""} onClick={()=>{selectedKitId.current=null;kitRequestSequence.current++;setSelected(null);setKitData(null);setCreatingKit(false);}}><span className="project-switcher-mark">CX</span><span><strong>cx回收</strong><small>{requirements.length} 条需求 · 持续迭代</small></span></button>{projects.map(project=><button key={project.id} className={selected?.id===project.id?"active":""} disabled={!project.valid} onClick={()=>openKit(project)}><span className="project-switcher-mark">{project.name.slice(0,2).toUpperCase()}</span><span><strong>{project.name}</strong><small>{project.requirementCount} 条需求 · {project.mode==="rapid-validation"?"快速验证":"持续迭代"}</small></span></button>)}</nav>
    {!selected&&<><section className="project-identity"><span className="project-monogram">CX</span><div><h2>cx回收</h2><p>登记需求不等于启动 AI 或授权制作原型</p></div><div className="project-stats"><span><strong>{requirements.length}</strong>需求</span><span><strong>{requirements.filter(item=>item.executionState==="waiting-human").length}</strong>待处理</span></div><button className="button primary" onClick={onCreate}>＋ 新建需求</button></section>
    <ProjectOverview onOpen={onOpen} requirements={requirements} snapshot={snapshot} /></>}
    <section className="overview-section" aria-label="其他 Kit 项目"><div className="overview-heading"><h2>其他 Kit 项目</h2><span>{projects.length} 个已连接项目</span></div>
      {projects.length?<div className="pending-grid">{projects.map(project=><article className="decision-card" key={project.id}><div className="decision-meta">{project.mode==="rapid-validation"?"快速验证项目":"持续迭代项目"} · {project.requirementCount} 条需求</div><h3>{project.name}</h3><p>{project.valid?"台账可读取；每条需求独立确认和授权。":"台账需核查，暂不展示需求。"}</p><div className="analysis-actions"><button className="button secondary" disabled={!project.valid} onClick={()=>openKit(project)}>查看需求</button><button className="button primary" disabled={!project.valid} onClick={()=>openKit(project,{create:true})}>＋ 新建需求</button></div></article>)}</div>:<p className="snapshot-note">工作区内暂无其他已连接的 Kit 项目。</p>}
      {kitError&&<p role="alert" className="refresh-feedback">{kitError}</p>}
      {selected&&kitData&&<section className="kit-project-readonly"><div className="overview-heading"><div><span className="section-kicker">{selected.name} · 独立台账</span><h3>{creatingKit?"登记新需求":"需求内容"}</h3></div><div className="analysis-actions">{!creatingKit&&<button className="button secondary" onClick={()=>openKit(selected)}>刷新状态</button>}<button className="button secondary" onClick={()=>{selectedKitId.current=null;kitRequestSequence.current++;setSelected(null);setKitData(null);setCreatingKit(false);setKitSyncError(false);}}>收起项目</button></div></div>
        {kitSyncError&&<p className="form-error" role="status">状态暂时无法更新，当前内容已保留。可点“刷新状态”重新核查。</p>}
        {creatingKit&&<div className="production-section"><p className="snapshot-note">只填写项目和需求描述即可登记；登记后仍由你决定是否启动 AI。</p>
          <label>所属项目<input value={selected.name} readOnly/></label>
          <label>需求类型<select value={kitType} onChange={event=>{const type=event.target.value;setKitType(type);setKitTags(getRequirementTemplate(type).defaultImpactTags);}}>{requirementTemplates.map(template=><option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
          <label>需求描述<textarea value={kitDescription} maxLength={5000} onChange={event=>setKitDescription(event.target.value)} placeholder="说清这次要解决的问题"/></label>
          <TypeRecommendation description={kitDescription} projectName={selected.name} disabled={kitBusy} onAdopt={suggestion=>{setKitType(suggestion.mainType);setKitTags(suggestion.impactTags);}}/>
          <details><summary>影响范围 · {kitTags.length} 项</summary>{[["frontend-page","前端页面"],["backend-logic","后台业务逻辑"],["state-data","状态与数据"],["external-interface","外部接口"],["requirement-document","需求文档"]].map(([id,label])=><label key={id}><input type="checkbox" checked={kitTags.includes(id)} onChange={event=>setKitTags(current=>event.target.checked?[...current,id]:current.filter(tag=>tag!==id))}/>{label}</label>)}</details>
          <RequirementTemplatePreview type={kitType} impactTags={kitTags}/>
          <label className="implementation-consent"><input type="checkbox" checked={kitConfirmed} onChange={event=>setKitConfirmed(event.target.checked)}/>只登记这条需求；不启动 AI，不授权修改项目。</label>
          <div className="analysis-actions"><button className="button secondary" disabled={kitBusy} onClick={()=>setCreatingKit(false)}>取消</button><button className="button primary" disabled={kitBusy||!kitConfirmed||kitDescription.trim().length<2} onClick={registerKit}>{kitBusy?"正在登记…":"登记需求"}</button></div>
        </div>}
        {!creatingKit&&(kitData.items.length?<div className="pending-grid">{kitData.items.map(item=><article className="decision-card" key={item.id}><div className="decision-meta">{item.id} · {lifecycleLabels[item.workbenchLifecycle?.state]||legacyLifecycleLabels[item.stageId]||"待分析"}</div><h4>{item.title}</h4><p>{item.originalRequest}</p><KitReplanCard projectId={selected.id} item={item} registrySha256={kitData.sha256} onSaved={()=>openKit(selected)}/><KitReviewCard projectId={selected.id} item={item} onSaved={()=>openKit(selected)}/><KitImplementationCard projectId={selected.id} item={item} registrySha256={kitData.sha256} onSaved={()=>openKit(selected)}/><KitAuthorizationCard projectId={selected.id} item={item} onSaved={()=>openKit(selected)}/><KitAnalysisCard projectId={selected.id} item={item} registrySha256={kitData.sha256} onSaved={()=>openKit(selected)}/><KitCompletedCard projectId={selected.id} item={item}/><KitProgress item={item}/><details><summary>查看范围与成果</summary><p>主类型：{item.requirementType||"尚未分类"} · 影响：{item.impactTags.length?item.impactTags.join("、"):"尚未标记"}</p><p>活动：{item.activities.length} 项 · 成果：{item.artifacts.length} 项</p></details></article>)}</div>:<p className="snapshot-note">当前台账尚无需求。</p>)}
        <small className="snapshot-note">当前只读取此项目台账；启动分析或修改项目仍需单独授权，通用项目操作入口接入中。</small></section>}
    </section>
    <details className="overview-sources"><summary>操作与授权边界</summary><div className="project-boundaries">
      <section><span className="section-kicker">现在可以</span><h2>分析与原型验证</h2><p>录入需求、确认业务方案、授权制作并确认原型。</p></section>
      <section><span className="section-kicker">本次不会</span><h2>进入正式研发</h2><p>不接生产接口，不访问生产数据，不提交或发布。</p></section>
    </div>
    <p className="project-footnote">读取资料不代表授权制作原型。每条需求仍需单独确认业务方案和原型制作授权。</p></details>
  </div>;
}

export function AuthorizationReview({ requirement, onAuthorize }) {
  const [expanded, setExpanded] = useState(false);
  const [checked, setChecked] = useState(false);
  if (!expanded) return <button className="button primary" onClick={() => setExpanded(true)}>授权制作原型</button>;
  return <section className="authorization-review" aria-label="本轮授权确认">
    <div className="authorization-heading"><div><span className="section-kicker">仅本轮 · 原型制作授权</span><h3>cx回收 · {requirement.title}</h3></div><span className="project-badge">演示</span></div>
    <div className="project-boundaries"><div><h4>允许范围</h4>{requirement.scope.map((item, index) => <p key={index}>{item}</p>)}</div><div><h4>不包含</h4>{requirement.excluded.map((item, index) => <p key={index}>{item}</p>)}<p>正式业务代码、生产数据、提交与发布</p></div></div>
    <label className="authorization-check"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} />我确认只制作本轮工程化原型，不进入正式研发或发布</label>
    <div className="action-buttons"><button className="button primary" disabled={!checked || !requirement.scope.length} onClick={() => onAuthorize({project: requirement.project, requirementId: requirement.id, scope: [...requirement.scope], excluded: [...requirement.excluded], mode: "demo-only", confirmedAt: new Date().toISOString()})}>确认授权制作原型</button><button className="button ghost" onClick={() => {setExpanded(false); setChecked(false);}}>暂不授权</button></div>
  </section>;
}
