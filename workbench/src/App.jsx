import { useEffect, useMemo, useRef, useState } from "react";
import { AuthorizationReview } from "./ProjectPage";
import SourceWorkspace from "./SourceWorkspace";

const initialRequirements = [
  {
    id: "REQ-024", title: "客户批量导入", project: "客户管理", phase: "方案确认",
    status: "waiting", statusLabel: "等待你处理", updatedAt: "10:24",
    question: "需要确认重复处理规则",
    suggestion: "重复客户默认跳过，并生成失败明细。",
    impact: "已有客户资料不会被覆盖。",
    progress: "已整理导入流程，发现重复客户处理方式尚未确认。",
    scope: ["支持 CSV 与 XLSX", "校验必填字段", "输出失败明细"],
    excluded: ["不覆盖已有客户", "不建设定时导入"],
    acceptance: ["1000 条数据可完成导入", "重复数据有明确结果", "失败项可下载"],
  },
  {
    id: "REQ-031", title: "消息通知中心", project: "平台体验", phase: "业务方案确认",
    status: "waiting", statusLabel: "等待你处理", updatedAt: "09:17",
    question: "需要选择首期通知渠道",
    suggestion: "首期接入站内信与邮件，企业微信和短信后续评估。",
    impact: "决定首期原型范围和后续验证重点。",
    progress: "通知触发场景已整理，等待确认首期渠道。",
    scope: ["站内信", "邮件通知", "已读状态"], excluded: ["短信", "企业微信"],
    acceptance: ["消息可触达", "已读状态可追踪"],
  },
  {
    id: "REQ-019", title: "客户标签体系（一期）", project: "客户管理", phase: "原型制作",
    status: "running", statusLabel: "AI 正在制作原型", updatedAt: "09:42",
    progress: "正在制作标签管理原型，并同步页面说明。",
    scope: ["标签分组", "手动打标", "标签检索"], excluded: ["自动画像", "跨系统标签同步"],
    acceptance: ["标签可创建与停用", "客户可按标签筛选"],
  },
];

const executionRows = [
  { id: "REQ-019", name: "客户标签体系（一期）", action: "正在制作原型并同步页面说明", time: "最近更新 09:42" },
  { id: "REQ-027", name: "营销活动多人协作", action: "正在整理业务方案", time: "最近更新 09:17" },
];

const recentRows = [
  { name: "会员权益体系升级", time: "11:03", state: "需求评审中" },
  { name: "数据导出功能优化", time: "昨天 17:20", state: "原型制作中" },
  { name: "新用户引导流程", time: "09-07 14:36", state: "已完成" },
];

const STORAGE_KEY = "product-os-workbench-demo-v2";
const DATA_MODE_KEY = "product-os-workbench-data-mode-v1";
function readDemo() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return initialRequirements;
  const data = JSON.parse(raw);
  if (data.version !== 2 || !Array.isArray(data.items) || !data.items.every(x => x.id && x.title && x.status)) throw new Error("数据格式不兼容");
  return data.items;
}

export default function App() {
  const [page, setPage] = useState("home");
  const [dataMode, setDataModeState] = useState(() => localStorage.getItem(DATA_MODE_KEY) === "demo" ? "demo" : "source");
  function setDataMode(mode) {
    localStorage.setItem(DATA_MODE_KEY, mode);
    setDataModeState(mode);
  }
  const [storageError, setStorageError] = useState("");
  const [requirements, renderRequirements] = useState(() => {
    try { return readDemo(); } catch { return initialRequirements; }
  });
  const current = useRef(requirements);
  const version = useRef(0);
  const renderVersion = version.current;
  function commit(items) {
    try {
      items = items.map(item => ({...item, history: item.history?.map(entry => entry[0] === "刚刚" ? [new Date().toLocaleString(), ...entry.slice(1)] : entry)}));
      localStorage.setItem(STORAGE_KEY, JSON.stringify({version: 2, items}));
      current.current = items;
      version.current += 1;
      renderRequirements(items);
      setStorageError("");
      return true;
    } catch {
      setStorageError("本地保存失败，本次操作未生效。请检查浏览器存储空间后重试。");
      return false;
    }
  }
  function setRequirements(update) {
    // An event from an older render cannot apply twice, including a rapid double click.
    if (renderVersion !== version.current || storageError) return false;
    return commit(update(current.current));
  }
  useEffect(() => {
    try { readDemo(); } catch { setStorageError("本地数据无法读取，已保留原数据。可重置演示数据；重置前会保留一份本地备份。"); }
    const sync = (event) => {
      if (event.key !== STORAGE_KEY) return;
      try { const items = readDemo(); current.current = items; version.current += 1; renderRequirements(items); setStorageError(""); }
      catch { setStorageError("其他页面保存的数据无法读取，请检查本地数据。"); }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    const pending = requirements.filter(x => x.status === "pausing");
    if (!pending.length || storageError) return;
    const timer = window.setTimeout(() => {
      const now = Date.now();
      commit(current.current.map(x => x.status === "pausing" && x.pauseDue <= now
        ? {...x, status: "paused", statusLabel: "已暂停", progress: "AI 已确认暂停，当前原型结果已保留。",
           history: [[new Date().toLocaleString(), "AI 已暂停原型制作", "可核对当前结果后继续。"], ...(x.history || [])]}
        : x));
    }, Math.max(0, Math.min(...pending.map(x => x.pauseDue)) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [requirements, storageError]);
  const [selectedId, setSelectedId] = useState("REQ-024");

  const [notice, setNotice] = useState("");
  const selected = useMemo(() => requirements.find((item) => item.id === selectedId) || requirements[0], [requirements, selectedId]);

  const pauseState = selected.status === "pausing" ? "pausing" : selected.status === "paused" ? "paused" : "running";

  function openRequirement(id) {
    setSelectedId(id); setNotice(""); setPage("detail");
  }

  function confirmDecision() {
    const isImport = selected.id === "REQ-024";
    setRequirements((items) => items.map((item) => item.id === selected.id ? {
      ...item, phase: "待授权制作原型", status: "ready", statusLabel: "业务方案已确认",
      progress: isImport ? "重复客户将跳过并生成失败明细，等待你授权制作原型。" : "业务范围与验收标准已确认，等待你授权制作原型。",
      history: [["刚刚", "你确认了业务方案", "业务确认不等于授权制作原型。"], ...(item.history || [])],
    } : item));
    setNotice("业务方案已确认。AI 不会自动制作原型，需要你单独授权。");
  }

  function authorizeExecution(authorization) {
    if (selected.status !== "ready") return;
    if (selected.project === "cx回收" && (!authorization || authorization.project !== selected.project || authorization.requirementId !== selected.id)) return;
    setRequirements((items) => items.map((item) => item.id === selected.id ? {
      ...item, authorization: selected.project === "cx回收" ? authorization : undefined, phase: "原型制作", status: "running", statusLabel: "AI 正在制作原型",
      progress: "已获得原型制作授权，正在按业务方案制作原型并同步页面说明。",
      history: [["刚刚", "你授权制作原型", selected.project === "cx回收" ? "演示授权 · 仅制作本轮工程化原型；不进入正式开发或发布。" : "AI 仅可制作已确认范围内的原型。"], ...(item.history || [])],
    } : item));

    setNotice("已授权制作原型，本轮工作仅限已确认业务方案。");
  }

  function startOrganizing() {
    setRequirements((items) => items.map((item) => item.id === selected.id ? {
      ...item, phase: "业务方案确认", status: "waiting", statusLabel: "等待你处理",
      question: "是否确认本轮只修改按钮文案",
      suggestion: "仅修改客户详情页主按钮文案，不调整按钮样式与提交逻辑。",
      impact: "范围小、结果清晰，确认后仍需单独授权制作原型。",
      progress: "AI 已分析业务范围和验收标准，等待你确认业务方案。",
      scope: ["修改主按钮文案"], excluded: ["不改按钮样式", "不改提交逻辑"],
      acceptance: ["按钮显示“保存并继续”", "点击行为保持不变"],
      history: [["刚刚", "AI 完成需求分析", "已形成业务范围、排除项和验收标准。"], ...(item.history || [])],
    } : item));
    setNotice("分析完成。请确认业务方案；确认后仍不会自动制作原型。");
  }

  function applyAdjustment(text) {
    const fromReview = selected.status === "awaiting-review";
    setRequirements((items) => items.map((item) => item.id === selected.id ? {
      ...item,
      phase: fromReview ? "原型制作" : "业务方案确认",
      status: fromReview ? "running" : "waiting",
      statusLabel: fromReview ? "AI 正在制作原型" : "等待你处理",
      progress: fromReview ? `已记录验收调整：“${text}”，AI 正在继续处理。` : `已记录调整意见：“${text}”，AI 正在据此更新范围建议。`,
      history: [["刚刚", fromReview ? "你提出验收调整" : "你调整了范围", text], ...(item.history || [])],
    } : item));

    setNotice(fromReview ? "同范围调整已提交，AI 正在继续制作原型，不需要再次授权。" : "调整意见已记录。当前仍停留在业务方案确认，不会自动制作原型。");
  }

  function completeExecution() {
    setRequirements((items) => items.map((item) => item.id === selected.id ? {
      ...item,
      phase: "原型确认", status: "awaiting-review", statusLabel: "等待你确认原型",
      question: "本轮原型等待确认",
      suggestion: "预览原型并核对需求说明，再决定确认完成或提出调整。",
      impact: "确认原型后，本轮工程化原型需求才会结束。",
      progress: "原型与页面说明已准备好，等待你预览确认。",
      history: [["刚刚", "AI 提交原型", "演示：原型与页面说明已准备好，未进入正式开发。"], ...(item.history || [])],
    } : item));
    setNotice("AI 已提交原型。确认完成前，本轮需求不会结束。");
  }

  function acceptResult() {
    setRequirements((items) => items.map((item) => item.id === selected.id ? {
      ...item,
      phase: "已完成", status: "completed", statusLabel: "工程化原型已完成",
      progress: "你已确认原型与需求说明符合本轮业务方案。",
      history: [["刚刚", "你确认原型并完成本轮", "原型与需求说明符合本轮业务方案。"], ...(item.history || [])],
    } : item));
    setNotice("原型已确认，本轮完成。如需正式开发，请另建需求。");
  }

  function requestPause() {
    if (selected.status !== "running") return;
    setRequirements(items => items.map(x => x.id === selected.id ? {
      ...x, status: "pausing", statusLabel: "正在暂停", pauseDue: Date.now() + 4000,
      progress: "暂停请求已保存，等待 AI 确认停止后续动作。",
      history: [[new Date().toLocaleString(), "你请求暂停", "暂停确认前不会重复发起请求。"], ...(x.history || [])]
    } : x));
  }
  function interruptExecution() {
    if (selected.status !== "running") return;
    setRequirements(items => items.map(x => x.id === selected.id ? {
      ...x, status: "failed", statusLabel: "原型制作中断", progress: "模拟连接中断。已完成的原型内容保留，剩余检查尚未进行。",
      history: [[new Date().toLocaleString(), "模拟原型制作中断", "保留已完成内容，重试只继续剩余工作。"], ...(x.history || [])]
    } : x));
  }
  function resumeExecution() {
    if (!["paused", "failed"].includes(selected.status)) return;
    setRequirements(items => items.map(x => x.id === selected.id ? {
      ...x, status: "running", statusLabel: "AI 正在制作原型", progress: "已核对已有内容，从保留的进度继续制作原型。",
      history: [[new Date().toLocaleString(), "核对并继续制作原型", "已完成内容不会重复制作。"], ...(x.history || [])]
    } : x));
  }
  function resetDemo() {
    if (!window.confirm("重置会清除本浏览器中的演示需求和处理记录，恢复初始样例。确定重置？")) return;
    try {
      const previous = localStorage.getItem(STORAGE_KEY);
      if (previous) localStorage.setItem(`${STORAGE_KEY}-backup-${Date.now()}`, previous);
    } catch { setStorageError("备份失败，未重置数据。请检查浏览器存储空间。"); return; }
    if (commit(initialRequirements)) { setPage("home"); setSelectedId("REQ-024"); setNotice(""); }
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} onNavigate={next => {if(next === "projects") setDataMode("source");setPage(next);}} />
      <main className="main-canvas">
        <div className="demo-toolbar"><div className="data-mode-switch" role="group" aria-label="数据来源"><button aria-pressed={dataMode === "source"} onClick={()=>{setDataMode("source");if(!["home","requirements","projects"].includes(page))setPage("requirements");}}>项目台账</button><button aria-pressed={dataMode === "demo"} onClick={()=>{setDataMode("demo");if(page === "projects")setPage("requirements");}}>演示数据</button></div>{dataMode === "demo" && <><span>浏览器本地保存 · 不写入项目台账</span><button className="text-button" onClick={resetDemo}>重置演示数据</button></>}</div>
        <div hidden={dataMode !== "source"}><SourceWorkspace page={page} /></div>
        {dataMode === "demo" && storageError && <div role="alert" className="notice">{storageError}</div>}
        <fieldset hidden={dataMode !== "demo"} disabled={Boolean(storageError)} className="demo-content">
        {page === "home" && <HomePage requirements={requirements} pauseState={pauseState} onPause={requestPause} onOpen={openRequirement} onCreate={() => setPage("new")} />}
        {page === "detail" && selected && <RequirementDetail key={selected.id} requirement={selected} notice={notice} onBack={() => setPage("home")} onStart={startOrganizing} onConfirm={confirmDecision} onAuthorize={authorizeExecution} onAdjust={applyAdjustment} onComplete={completeExecution} onAccept={acceptResult} onInterrupt={interruptExecution} onResume={resumeExecution} onPause={requestPause} pauseState={pauseState} />}
        {page === "new" && <NewRequirement onCancel={() => setPage("home")} onCreate={(item) => { setRequirements((items) => [item, ...items]); setSelectedId(item.id); setPage("detail"); setNotice("需求已录入。下一步是让 AI 分析需求，不会自动制作原型。"); }} />}
        {page === "requirements" && <RequirementIndex requirements={requirements} onOpen={openRequirement} onCreate={() => setPage("new")} />}
      </fieldset></main>
    </div>
  );
}

function Sidebar({ page, onNavigate }) {
  const items = [["home", "工作台"], ["requirements", "需求"], ["projects", "项目"], ["assistant", "AI 助手"], ["knowledge", "知识库"]];
  return (
    <aside className="sidebar">
      <div className="brand">Product OS</div>
      <nav aria-label="主导航">
        {items.map(([id, label]) => <button type="button" key={id} className={page === id || (page === "detail" && id === "requirements") || (page === "new" && id === "requirements") ? "nav-item active" : "nav-item"} onClick={() => ["home", "requirements", "projects"].includes(id) ? onNavigate(id) : undefined} aria-disabled={!['home', 'requirements', 'projects'].includes(id)}>{label}</button>)}
      </nav>
      <div className="sidebar-foot"><span>让想法</span><strong>成为可实现的价值</strong></div>
    </aside>
  );
}

function HomePage({ requirements, pauseState, onPause, onOpen, onCreate }) {
  const attention = requirements.filter(x => ["paused", "failed"].includes(x.status));
  const executionRows = requirements.filter(x => ["running","pausing","paused","failed"].includes(x.status)).map(x => ({id:x.id, name:x.title, action:x.progress, time:x.project, state:x.statusLabel}));
  const recentRows = requirements.map(x => ({name:x.title,time:x.updatedAt,state:x.statusLabel}));
  const pending = requirements.filter((item) => ["recorded", "ready", "waiting", "awaiting-review"].includes(item.status));
  return (
    <div className="page home-page">
      <header className="page-header home-header">
        <div><div className="eyebrow">专注重要的决定</div><h1>下午好，<br />这里是你的 AI 需求工作台</h1><p>AI 负责整理和制作原型，你只处理关键业务决定。</p></div>
        <div className="header-actions"><div className="date-block"><strong>2026年9月9日</strong><span>星期三</span></div><button className="button primary" onClick={onCreate}>＋ 新建需求</button></div>
      </header>
      <section className="section-block pending-section">
        <SectionTitle title="待你处理" count={pending.length} />
        <div className="pending-grid">
          {pending.map((item, index) => <article className={`decision-card ${index === 0 ? "featured" : ""}`} key={item.id}>
            <div className="decision-meta"><span className={`status-dot ${index === 0 ? "amber" : "slate"}`} />今天 {item.updatedAt}</div>
            <h2>{item.title} · {item.question}</h2><p><span>AI 建议</span>{item.suggestion}</p><p><span>影响</span>{item.impact}</p>
            <button className={index === 0 ? "button primary" : "button secondary"} onClick={() => onOpen(item.id)}>查看并处理</button>
          </article>)}
        </div>
      </section>
      <section className="section-block">
        <SectionTitle title="AI 处理进展" count={executionRows.length} />
        <div className="simple-list">
          {executionRows.map((row, index) => <div className="list-row" key={row.id}>
            <span className="status-dot green" /><button className="text-button" onClick={() => onOpen(row.id)}>{row.name}</button><span>{row.action}</span>
            <em>{row.state}</em><small>{row.time}</small><button className="text-button" onClick={() => onOpen(row.id)}>查看进展</button>
          </div>)}
        </div>
      </section>
      <div className="split-sections">
        <section className="section-block compact-section"><SectionTitle title="需要关注" count={attention.length} />{attention.length ? attention.map(item => <div className="attention-row" key={item.id}><span className="status-dot red" /><div><button className="text-button" onClick={() => onOpen(item.id)}>{item.title}</button><p>{item.progress}</p></div><em>{item.statusLabel}</em></div>) : <p>暂无需要关注的事项</p>}</section>
        <section className="section-block compact-section"><SectionTitle title="最近需求" /><div className="recent-list">{recentRows.map((row) => <div key={row.name}><strong>{row.name}</strong><span>{row.time}</span><em>{row.state}</em></div>)}</div></section>
      </div>
    </div>
  );
}

function SectionTitle({ title, count }) {
  return <div className="section-title"><h2>{title}</h2>{typeof count === "number" && <span>{count}</span>}<button className="text-button">全部</button></div>;
}

function RequirementDetail({ requirement, notice, onBack, onStart, onConfirm, onAuthorize, onAdjust, onComplete, onAccept, onInterrupt, onResume, onPause, pauseState }) {
  const [revisionMode, setRevisionMode] = useState(false);
  const [adjustment, setAdjustment] = useState("");
  const [previewOpen,setPreviewOpen]=useState(false);
  const previewDialog=useRef(null);
  const recorded = requirement.status === "recorded";
  const waiting = requirement.status === "waiting";
  const ready = requirement.status === "ready";
  const running = ["running", "pausing", "paused"].includes(requirement.status);
  const failed = requirement.status === "failed";
  const [retryChecked, setRetryChecked] = useState(false);
  useEffect(() => { setRetryChecked(false); }, [requirement.status]);
  const awaitingReview = requirement.status === "awaiting-review";
  const completed = requirement.status === "completed";
  useEffect(()=>{if(previewOpen&&!previewDialog.current?.open)previewDialog.current?.showModal();if(!previewOpen&&previewDialog.current?.open)previewDialog.current.close();},[previewOpen]);
  const liveStatus = running && pauseState === "pausing" ? "正在暂停" : running && pauseState === "paused" ? "已暂停" : requirement.statusLabel;
  const liveHeading = pauseState === "pausing" ? "正在等待原型制作暂停" : pauseState === "paused" ? "本轮原型制作已暂停" : "AI 正在按业务方案制作原型";
  const actionTitle = failed ? "先核对已有内容，再继续制作" : recorded ? "让 AI 分析这条需求" : waiting ? requirement.question : ready ? "业务方案已确认，是否授权制作原型？" : awaitingReview ? "本轮原型等待你确认" : completed ? "工程化原型已完成" : liveHeading;
  const actionBody = failed ? requirement.progress : recorded ? "AI 将整理业务范围、排除项和验收标准；不会制作原型。" : waiting ? requirement.suggestion : ready ? "授权后，AI 才会在本轮范围内制作工程化原型。" : awaitingReview ? "原型和页面说明已经准备好，请确认完成或提出调整。" : completed ? "原型已经你确认，本轮不会继续产生新动作。" : pauseState === "paused" ? "当前原型内容已保留，恢复前不会继续。" : requirement.progress;
  const actionImpact = failed ? "已完成内容会保留；继续时不会从头重复制作。" : recorded ? "关键业务规则仍由你确认，分析完成后也不会自动制作原型。" : waiting ? requirement.impact : ready ? "授权只覆盖本轮工程化原型，不包含正式研发或发布。" : awaitingReview ? "确认原型后，本轮工程化原型需求才会完成。" : completed ? "若需正式开发，请另建需求并重新授权。" : "制作过程中可以请求暂停，确认暂停前状态显示为正在暂停。";
  return (
    <div className="page detail-page">
      <button className="back-button" onClick={onBack}>← 返回工作台</button>
      <header className="detail-header"><div><div className="eyebrow">{requirement.id}</div><h1>{requirement.title}</h1><div className="detail-meta"><span>所属项目：{requirement.project}</span><span>当前阶段：{requirement.phase}</span><strong>{liveStatus}</strong></div></div>{running && <button className="button secondary" onClick={onPause} disabled={pauseState !== "running"}>{pauseState === "running" ? "请求暂停" : pauseState === "pausing" ? "正在暂停" : "已暂停"}</button>}</header>
      <p className="progress-summary">最近进展：{requirement.progress}</p>{notice && <div className="notice">{notice}</div>}
      <section className="action-panel">
        <div className="section-kicker">{running ? "AI 处理进展" : completed ? "当前结论" : "当前需要处理"}</div>
        <div className="action-layout">
          <div><h2>{actionTitle}</h2><p>{actionBody}</p></div>
          <div className="impact-note"><span>影响</span><p>{actionImpact}</p></div>
        </div>
        <div className="action-buttons">
          {recorded && <button className="button primary" onClick={onStart}>让 AI 分析需求</button>}
          {waiting && <><button className="button primary" onClick={onConfirm}>确认业务方案</button><button className="button ghost" onClick={() => setRevisionMode(true)}>提出不同意见</button></>}
          {ready && <>{requirement.project === "cx回收" ? <AuthorizationReview requirement={requirement} onAuthorize={onAuthorize} /> : <button className="button primary" onClick={onAuthorize}>授权制作原型</button>}<button className="button ghost" onClick={() => setRevisionMode(true)}>调整业务方案</button></>}
          {running && <><span className="running-state"><span className={`status-dot ${pauseState === "paused" ? "slate" : "green"}`} />{pauseState === "pausing" ? "正在暂停 · 等待确认" : pauseState === "paused" ? "已暂停 · 当前原型已保留" : "AI 正在制作原型 · 最近更新于 1 分钟前"}</span><button className="button demo-button" disabled={pauseState !== "running"} onClick={onComplete}>模拟完成原型</button></>}
          {awaitingReview && <button className="button primary" onClick={()=>setPreviewOpen(true)}>预览原型</button>}
          {requirement.status === "running" && <button className="button ghost" onClick={onInterrupt}>模拟原型制作中断</button>}
          {requirement.status === "paused" && <button className="button secondary" onClick={onResume}>继续制作原型</button>}
          {failed && <div><p>请查看下方处理记录，核对已完成动作。</p><label><input type="checkbox" checked={retryChecked} onChange={e => setRetryChecked(e.target.checked)} />已核对已完成动作及剩余工作</label><button className="button primary" disabled={!retryChecked} onClick={() => {onResume(); setRetryChecked(false);}}>检查并重试</button></div>}
          {completed && <span className="completed-state"><span className="status-dot green" />工程化原型已完成 · 确认记录已保存</span>}
        </div>
        {revisionMode && <div className="revision-box"><label htmlFor="adjustment">补充你的调整意见</label><textarea id="adjustment" value={adjustment} onChange={(event) => setAdjustment(event.target.value)} placeholder="例如：移动端同一按钮也需要同步修改" /><div><button className="button ghost" onClick={() => setRevisionMode(false)}>取消</button><button className="button primary" disabled={!adjustment.trim()} onClick={() => { onAdjust(adjustment.trim()); setRevisionMode(false); setAdjustment(""); }}>保存调整</button></div></div>}
      </section>
      {completed && <ResultSummary requirement={requirement} completed />}
      <dialog ref={previewDialog} className="scope-dialog prototype-preview-dialog" aria-label="预览原型" onCancel={()=>setPreviewOpen(false)} onClose={()=>setPreviewOpen(false)}>
        <header><div><span className="section-kicker">本轮工程化原型</span><h2>预览与确认</h2></div><button className="text-button" onClick={()=>setPreviewOpen(false)}>关闭</button></header>
        <p className="snapshot-note">演示结果 · 不代表正式开发或生产效果</p>
        <ResultSummary requirement={requirement} completed={false}/>
        <section className="prototype-feedback"><label htmlFor="preview-adjustment">需要调整</label><p>同范围调整可直接继续，不需要再次授权制作原型。</p><textarea id="preview-adjustment" rows="3" value={adjustment} onChange={event=>setAdjustment(event.target.value)} placeholder="写下你希望调整的原型表现"/></section>
        <div className="analysis-actions prototype-preview-actions"><button className="button secondary" onClick={()=>setPreviewOpen(false)}>返回需求</button><button className="button secondary" disabled={Boolean(adjustment.trim())} onClick={()=>{setPreviewOpen(false);onAccept();}}>确认原型并完成本轮</button><button className="button primary" disabled={!adjustment.trim()} onClick={()=>{const text=adjustment.trim();setAdjustment("");setPreviewOpen(false);onAdjust(text);}}>确认调整并继续</button></div>
      </dialog>
      <section className="detail-section"><div className="section-kicker">本轮范围与成果</div><div className="scope-grid"><ScopeColumn title="原始需求" items={[requirement.originalRequest || (requirement.id === "REQ-024" ? "支持运营批量导入客户资料" : requirement.title)]} /><ScopeColumn title="确认范围" items={requirement.scope} /><ScopeColumn title="排除项" items={requirement.excluded} /><ScopeColumn title="验收标准" items={requirement.acceptance} /></div></section>
      <section className="detail-section record-section"><div className="section-kicker">处理记录</div><Timeline requirement={requirement} /><details><summary>查看详细记录</summary><p>演示流程未连接真实项目，这里只展示按需展开的详细记录。</p></details></section>
    </div>
  );
}

function ScopeColumn({ title, items = [] }) { return <div className="scope-column"><h3>{title}</h3>{items.map((item) => <p key={item}>{item}</p>)}</div>; }

function ResultSummary({ requirement, completed }) {
  const isCopyChange = requirement.title.includes("按钮") || requirement.scope?.some((item) => item.includes("文案"));
  return (
    <section className="result-panel">
      <div className="result-heading"><div><div className="section-kicker">本轮原型</div><h2>{completed ? "原型已确认" : "原型与页面说明已准备好"}</h2></div><span>{completed ? "已完成" : "待确认"}</span></div>
      <div className="result-grid">
        <div><span>修改前</span><strong>{isCopyChange ? "提交" : "遇到重复客户时继续导入"}</strong></div>
        <div><span>修改后</span><strong>{isCopyChange ? "保存并继续" : "跳过重复客户并记录明细"}</strong></div>
        <div><span>检查结论（模拟）</span><strong>演示检查通过，未运行真实项目</strong></div>
      </div>
      <p>本轮仅覆盖已确认范围，排除项没有发生变化。</p>
    </section>
  );
}

function Timeline({ requirement }) {
  const baseRows = requirement.id === "REQ-024" ? [
    ["今天 10:24", "AI 提出待确认问题", "重复客户处理方式会影响历史资料安全。"],
    ["今天 10:12", "AI 完成需求整理", "形成导入流程、排除项和三条验收标准。"],
    ["今天 09:48", "你创建了需求", "希望运营可以批量导入客户资料。"],
  ] : [["1 分钟前", "你录入了原始需求", requirement.originalRequest || requirement.title]];
  const rows = [...(requirement.history || []), ...baseRows];
  return <div className="timeline">{rows.map(([time, title, body], index) => <div key={`${index}-${time}-${title}`}><time>{time}</time><strong>{title}</strong><p>{body}</p></div>)}</div>;
}

function NewRequirement({ onCancel, onCreate }) {
  const [project, setProject] = useState("cx回收"); const [description, setDescription] = useState(""); const [materials, setMaterials] = useState("");
  function submit(event) { event.preventDefault(); if (!description.trim()) return; onCreate({ id: `REQ-${crypto.randomUUID()}`, title: description.trim().slice(0, 18), originalRequest: description.trim(), materials, project, phase: "需求分析", status: "recorded", statusLabel: "等待分析", updatedAt: "刚刚", question: "分析这条需求", suggestion: "AI 将梳理业务范围、问题与验收标准。", impact: "不会制作原型，也不会进入正式开发。", progress: "需求已录入，尚未开始分析。", scope: [], excluded: [], acceptance: [] }); }
  return <div className="page form-page"><button className="back-button" onClick={onCancel}>← 返回工作台</button><header className="form-header"><div className="eyebrow">新建需求</div><h1>先把想解决的事说清楚</h1><p>第一版只需要项目和需求描述，材料可以稍后补充。</p></header><form className="requirement-form" onSubmit={submit}><label>所属项目<select value={project} onChange={(event) => setProject(event.target.value)}><option>cx回收</option><option>客户管理</option><option>平台体验</option><option>营销增长</option></select></label><label>需求描述<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="例如：把客户详情页的“提交”改成“保存并继续”" /></label><label>补充材料 <span>可选</span><textarea className="short" value={materials} onChange={(event) => setMaterials(event.target.value)} placeholder="粘贴文档链接、背景或相关说明" /></label><div className="form-footer"><p>保存后仍需点击“让 AI 分析需求”，不会自动制作原型。</p><div><button type="button" className="button ghost" onClick={onCancel}>取消</button><button className="button primary" disabled={!description.trim()}>保存需求</button></div></div></form></div>;
}

function RequirementIndex({ requirements, onOpen, onCreate }) {
  return <div className="page index-page"><header className="index-header"><div><div className="eyebrow">全部需求</div><h1>需求</h1><p>按最近推进时间排列。</p></div><button className="button primary" onClick={onCreate}>＋ 新建需求</button></header><div className="requirement-table">{requirements.map((item) => <button key={item.id} onClick={() => onOpen(item.id)}><span>{item.id}</span><strong>{item.title}</strong><em>{item.project}</em><small>{item.phase}</small><b>{item.statusLabel}</b></button>)}</div></div>;
}
