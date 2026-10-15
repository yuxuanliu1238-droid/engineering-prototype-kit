import { useEffect, useRef, useState } from "react";
import { sourceRequirements, executionLabels } from "./source-requirements";
import overview from "./cx-overview.json";
import RequirementEvidenceGraph from "./RequirementEvidenceGraph";
import RequirementPages from "./RequirementPages";
import { formatRecordTime } from "./requirement-presentation";
import { currentStageFor, requirementConclusion } from "./requirement-detail-model";
import AnalysisPanel from "./AnalysisPanel";
import RequirementActivity from "./RequirementActivity";
import PageGuideDialog from "./PageGuideDialog";
import PrototypeDelivery from "./PrototypeDelivery";
import {lifecycleLabels} from "./requirement-lifecycle";
import {isPrototypeTemplate} from "./requirement-templates";
import StrategyDeliverableReview from "./StrategyDeliverableReview";

const stageLabels = {completed: "已完成", skipped: "已跳过", waiting_user: "等待确认", unrecorded:"未记录", pending:"待处理", active:"进行中", blocked:"被阻塞", "in-progress":"进行中"};
const artifactLabels = {contract:"页面契约",prototype:"原型",decision:"正式决策", "page-guide":"页面说明",commit:"提交",release:"发布","test-report":"检查报告","review-report":"评审报告","user-confirmation":"用户确认"};

export default function ReadOnlyRequirement({ onBack, onRefresh, record = sourceRequirements.find(item => item.id === "CR-027") }) {
  const heading = useRef(null);
  const [actionTarget,setActionTarget] = useState(null);
  const [noticeTarget,setNoticeTarget] = useState(null);
  const currentStage = currentStageFor(record);
  const [selectedStageId, setSelectedStageId] = useState(currentStage.id);
  const selectedStage = record.stages.find(stage => stage.id === selectedStageId) || currentStage;
  const selectedTime = formatRecordTime(selectedStage.updatedAt);
  const actionable=record.id==="CR-029"||Boolean(record.requirementType);
  const prototypeRoute=record.id==="CR-029"||isPrototypeTemplate(record.requirementType);
  const lifecycleLabel=lifecycleLabels[record.lifecycle?.state]||record.stage;
  const surface=record.prototypeTargets?.some(file=>file.includes("/admin"))?"admin":record.prototypeTargets?.some(file=>file.includes("/mobile"))?"mobile":"courier";
  const previewUrl=`/prototype-preview/${surface}.html`+(record.id==="CR-029"?"#page=courier.home":"");
  useEffect(() => { heading.current?.focus(); }, []);
  return <article className="readonly-requirement">
    <button className="back-button" onClick={onBack}>← 返回来源</button>
    <header className="requirement-heading"><div><span className="section-kicker">{record.project || "cx回收"} · {record.id} · {actionable ? "需求执行" : "只读需求"}</span><h2 ref={heading} tabIndex={-1}>{record.title}</h2><p className="snapshot-note">当前阶段：{lifecycleLabel} · {executionLabels[record.executionState] || "状态未记录"} · {record.confirmedAt ? `台账确认记录：${formatRecordTime(record.confirmedAt).date}` : "最终确认时间未记录"}</p></div></header>
    {!actionable&&<section className="requirement-top-notices"><span className="section-kicker">当前需要你</span><h3>{record.waiting?.question || requirementConclusion(record)}</h3>{record.waiting ? <><p>{record.waiting.impact}</p><details><summary>处理前提</summary><p>{record.waiting.resumeWhen}</p><p>当前为只读记录，尚未接入此需求的处理操作。</p></details></> : <p>{record.note || currentStage.note}</p>}</section>}
    <div className={`requirement-detail-layout ${actionable?"has-decision-sidebar":""}`}>
    <div className="requirement-workspace">
      {actionable ? <RequirementActivity record={record}/> : <aside className="stage-rail" aria-label="处理进度时间轴"><div className="section-kicker">处理进度</div><ol>{record.stages.map(stage => {const time = formatRecordTime(stage.updatedAt);return <li key={stage.id} className={`stage-${stage.status}`}><button aria-current={stage.id === currentStage.id ? "step" : undefined} aria-pressed={selectedStageId === stage.id} onClick={() => setSelectedStageId(stage.id)}><span className="stage-marker">{stage.status === "completed" ? "✓" : stage.status === "skipped" ? "−" : ""}</span><strong>{stage.label}</strong><span className="stage-state">{stageLabels[stage.status] || stage.status}{stage.id === currentStage.id ? " · 当前" : ""}</span><time dateTime={stage.updatedAt}>{time.date}</time><small>{time.time}</small></button></li>;})}</ol></aside>}
      <div className="requirement-main">
        {actionable && <AnalysisPanel record={record} onRefresh={onRefresh} actionTarget={actionTarget} noticeTarget={noticeTarget} />}
        <section className="selected-stage-card" aria-live="polite"><span className="section-kicker">阶段记录 · {stageLabels[selectedStage.status] || selectedStage.status}</span><h3>{selectedStage.label}</h3><p>{selectedStage.note}</p><small>{selectedTime.date} · {selectedTime.time}</small></section>
    <section className="action-panel"><span className="section-kicker">当前结论 · 来自台账</span><h3>{requirementConclusion(record)}</h3><p>{record.note || currentStage.note}</p>{record.waiting ? <><p>{record.waiting.question || "具体等待问题未记录"}</p><p className="snapshot-note">{record.waiting.impact || "等待影响未记录"}</p><details><summary>继续前需要什么</summary><p>{record.waiting.resumeWhen || "恢复条件未记录"}</p><p>此处仅查看，不提交评审结论或授予新权限。</p></details></> : <p className="snapshot-note">台账未登记等待原因，不代表已获得新一轮原型制作授权。</p>}</section>
    <section className="overview-section"><div className="overview-heading"><h3>本轮范围与成果</h3><span>{record.scope || "范围未记录"}</span></div><p>{record.notes[0] || "暂无需求范围说明"}</p><details className="overview-sources"><summary>范围说明与产物边界</summary>{record.notes.slice(1).map((note,index) => <p key={index}>{note}</p>)}<p>台账允许产物：{record.allowedArtifactTypes?.length ? record.allowedArtifactTypes.map(type=>artifactLabels[type]||type).join("、") : "未列出"}</p><p>台账暂缓产物：{record.deferredArtifactTypes?.length ? record.deferredArtifactTypes.map(type=>artifactLabels[type]||type).join("、") : "未列出"}</p></details>{record.pendingQuestions?.length > 0 && <details className="overview-sources"><summary>已登记问题 · {record.pendingQuestions.length}</summary>{record.pendingQuestions.map((question,index)=><p key={index}>{typeof question === "string" ? question : question.question || question.title || JSON.stringify(question)}</p>)}</details>}</section>
    <RequirementPages ids={record.pages} pages={overview.pages} />
    <RequirementEvidenceGraph record={record} pages={overview.pages} />
    <p className="source-path">来源：{record.source} · {record.id}<br />读取时间：{new Date(record.readAt).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",hour12:false})} · 校验摘要 {record.sha256.slice(0,12)}<br />静态资料快照；历史确认不构成新的实施授权。</p>
      </div>
    </div>
    {actionable&&<aside className="requirement-decision-sidebar" aria-label="当前决策与操作"><div><span className="section-kicker">现在需要你</span><div className="requirement-top-notices" ref={setNoticeTarget}>{record.executionState==="completed"&&<section className="execution-overview"><div className="overview-heading"><strong>{prototypeRoute?"工程化原型已完成":"本轮需求已完成"}</strong></div><p>{prototypeRoute?"原型与需求说明已确认。如需正式开发，请另建需求并重新授权。":"本轮交付物已确认；后续工作需另行确定范围和授权。"}</p></section>}</div><div className="requirement-heading-actions">{prototypeRoute&&record.executionState==="completed"&&<a className="button primary" href={previewUrl} target="_blank" rel="noreferrer">预览原型</a>}{(record.id==="CR-029"||record.prototypeTargets?.some(file=>file.endsWith(".md")&&file.includes("page-guides")))&&<PageGuideDialog requirementId={record.id}/>} {prototypeRoute&&record.executionState==="completed"&&<PrototypeDelivery requirementId={record.id}/>} {!prototypeRoute&&record.executionState==="completed"&&<StrategyDeliverableReview requirementId={record.id}/>}<div ref={setActionTarget}/></div></div></aside>}
    </div>
  </article>;
}
