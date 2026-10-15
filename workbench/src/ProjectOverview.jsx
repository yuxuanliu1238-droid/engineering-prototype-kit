import { useState } from "react";
import overview from "./cx-overview.json";
import { sourceRequirements, sourceSnapshot as defaultSnapshot } from "./source-requirements";

const surfaces = {mobile: "用户移动端", admin: "运营后台", courier: "小哥端", service: "服务页"};
const statuses = {implemented: "已实现", partial: "部分实现", planned: "计划中"};

export default function ProjectOverview({ onOpen, requirements: allRequirements = sourceRequirements, snapshot:sourceSnapshot = defaultSnapshot }) {
  const [surface, setSurface] = useState("mobile");
  const [showAll, setShowAll] = useState(false);
  const pages = overview.pages.filter(page => page.surface === surface);
  const requirements = allRequirements.filter(item=>item.projectId === sourceSnapshot.projectId).slice().reverse();
  return <div className="project-overview">
    <p className="snapshot-note">{overview.projectName} · 页面目录快照 · {new Date(overview.readAt).toLocaleString("zh-CN", {timeZone:"Asia/Shanghai", hour12:false})} 读取</p>
    <section className="overview-section" aria-label="现有页面">
      <div className="overview-heading"><h2>现有页面</h2><span>{overview.pages.length} 条契约记录</span></div>
      <div className="surface-options" role="group" aria-label="页面所属端">{Object.entries(surfaces).map(([key,label]) => <button key={key} aria-pressed={surface === key} onClick={() => setSurface(key)}>{label}<span>{overview.pages.filter(p => p.surface === key).length}</span></button>)}</div>
      <div className="overview-page-grid">{pages.map(page => <details className="overview-page-card" key={page.id}><summary><span>{page.title}</span><small>{statuses[page.status] || "未标注"}</small></summary><p>{page.goal}</p><small>契约中的原型实现状态，未经本轮运行验证。</small><div className="source-path">{page.id}<br />来源：{page.source}</div></details>)}</div>
    </section>
    <section className="overview-section" aria-label="需求台账">
      <div className="overview-heading"><h2>需求台账</h2><span>{requirements.length} 条 · 按编号倒序</span></div>
      <p className="snapshot-note">源项目记录，与工作台演示需求分开保存。</p>
      <div className="source-requirement-list">{(showAll ? requirements : requirements.slice(0,6)).map(item => <button className="source-requirement-row project-source-row" key={item.key} onClick={()=>onOpen(item.key)}><small>{item.id}</small><strong>{item.title}</strong><em>{item.stage}</em></button>)}</div>
      <p className="source-path">需求读取时间：{sourceSnapshot.readAt} · 与工作台和需求入口共用同一份记录</p>
      <button className="text-button overview-toggle" onClick={() => setShowAll(!showAll)}>{showAll ? "收起" : `展开全部 ${requirements.length} 条`}</button>
    </section>
    <details className="overview-sources"><summary>资料来源与读取边界</summary><p>仅摘取需求台账及页面契约字段。未读取密钥、生产数据或业务文档全文。刷新浏览器不会重新读取源项目；请点击“刷新需求台账”更新需求。页面目录仍使用下列契约快照。</p>{overview.sources.map(source => <div className="source-path" key={source.path}>{source.path}<br />校验摘要：{source.sha256.slice(0,12)}</div>)}</details>
  </div>;
}
