import { useState } from "react";

export default function RequirementPages({ ids, pages }) {
  const related = ids.map(id => pages.find(page => page.id === id) || {id, title:id, goal:"页面摘要尚未读取"});
  const [selectedId, setSelectedId] = useState(ids[0]);
  const [expanded, setExpanded] = useState(false);
  if (!related.length) return <section className="overview-section"><h3>关联页面</h3><p className="snapshot-note">台账尚未登记关联页面，不根据标题推测页面范围。</p></section>;
  const selected = related.find(page => page.id === selectedId);
  const content = page => <><p>{page.goal}</p><div className="source-path">{page.id}<br />{page.source || "台账引用，尚未匹配契约"}</div></>;
  return <section className="overview-section">
    <div className="overview-heading"><h3>关联页面 <small>{related.length}</small></h3><div className="page-expand-actions"><button className="text-button" disabled={expanded} onClick={() => {setExpanded(true);setSelectedId(null);}}>全部展开</button><button className="text-button" disabled={!expanded && !selected} onClick={() => {setExpanded(false);setSelectedId(null);}}>全部收起</button></div></div>
    <div className="related-page-grid">{related.map((page,index) => <article className={`related-page-card ${selectedId === page.id ? "is-selected" : ""}`} key={page.id}><button aria-pressed={selectedId === page.id} onClick={() => {setExpanded(false);setSelectedId(page.id);}}><span className="page-card-number">{String(index+1).padStart(2,"0")}</span><span><small>{{admin:"运营后台",mobile:"用户移动端",courier:"小哥端",service:"服务页"}[page.surface || page.id.split(".")[0]] || "所属端未记录"}</small><strong>{page.title}</strong><span className="page-purpose">{page.goal}</span></span></button>{expanded && <div className="page-inline-detail">{content(page)}</div>}</article>)}</div>
    {!expanded && selected && <div className="page-detail-preview" aria-live="polite"><span className="section-kicker">页面摘要 · 非运行预览</span><h4>{selected.title}</h4>{content(selected)}</div>}
  </section>;
}
