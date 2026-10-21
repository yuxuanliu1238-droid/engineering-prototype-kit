import { useEffect, useRef, useState } from "react";
import content from "./comparison-content.json";
import { resolveReview, sourceLink, validateReviewContent } from "./comparison-model.js";
import "./comparison-review.css";

function inline(text) {
  return text.split(/(\*\*.*?\*\*|`[^`]+`)/g).map((part, i) => part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part.startsWith("`") ? <code key={i}>{part.slice(1, -1)}</code> : part);
}
function RequirementBody({ body }) {
  const blocks = body.split(/\n\s*\n/).filter(Boolean);
  return blocks.map((block, i) => {
    const lines = block.split("\n");
    if (/^#{2,6} /.test(block)) return <h3 key={i}>{inline(block.replace(/^#{2,6} /, ""))}</h3>;
    if (lines[0].startsWith("|")) {
      const rows = lines.filter((line) => !/^\|[\s:|\-]+\|$/.test(line)).map((line) => line.slice(1, -1).split("|").map((cell) => cell.trim()));
      return <div className="comparison-table" key={i}><table><thead><tr>{rows[0].map((cell, j) => <th key={j}>{inline(cell)}</th>)}</tr></thead><tbody>{rows.slice(1).map((row, k) => <tr key={k}>{row.map((cell, j) => <td key={j}>{inline(cell)}</td>)}</tr>)}</tbody></table></div>;
    }
    if (lines.every((line) => /^\d+\. /.test(line))) return <ol key={i}>{lines.map((line, j) => <li key={j}>{inline(line.replace(/^\d+\. /, ""))}</li>)}</ol>;
    if (lines.every((line) => line.startsWith("- "))) return <ul key={i}>{lines.map((line, j) => <li key={j}>{inline(line.slice(2))}</li>)}</ul>;
    return <p key={i}>{inline(block)}</p>;
  });
}
const configurationErrors = validateReviewContent(content);

export function ComparisonReview() {
  const frame = useRef(null), viewport = useRef(null), article = useRef(null);
  const [location, setLocation] = useState({}), [activity, setActivity] = useState(null);
  const [view, setView] = useState("current"), [manual, setManual] = useState(null);
  const [width, setWidth] = useState(64), [scale, setScale] = useState(1), [reset, setReset] = useState(0);
  const resolved = resolveReview(content, location, activity);
  const selected = content.sections.find((item) => item.id === manual) || resolved.current || content.sections[0];
  const url = sourceLink(selected?.sourceUrl || content.source.url);
  const choose = (id) => { setManual(id); };
  const switchView = (next) => { setView(next); setManual(next === "current" ? null : next === "full" ? content.sections[0]?.id : resolved.related[0]?.id); };
  const restart = () => { setActivity(null); setLocation({}); setManual(null); setReset((value) => value + 1); };
  useEffect(() => {
    const receive = (event) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "prototype-review-location") {
        setLocation(event.data.location || {}); setActivity(null);
      }
      if (event.data?.type === "prototype-review-action" && typeof event.data.action === "string") {
        setActivity(event.data.active ? event.data.action : null);
        if (event.data.active && content.actionMappings.some((item) => item.action === event.data.action)) { setManual(null); setView("current"); }
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setScale(Math.max(0.65, Math.min(1, entry.contentRect.width / content.minimumDemoWidth))));
    if (viewport.current) observer.observe(viewport.current); return () => observer.disconnect();
  }, []);
  useEffect(() => { article.current?.scrollTo({ top: 0 }); }, [selected?.id]);
  if (configurationErrors.length) return <main><h1>评审配置需要调整</h1><ul>{configurationErrors.map((error, i) => <li key={i}>{error}</li>)}</ul></main>;
  return <main className="comparison-root">
    <header className="comparison-header"><div><span className="comparison-kicker">交互与需求 · 对照评审</span><h1>{content.title}</h1></div><a href={content.demoEntry} target="_blank" rel="noreferrer">独立打开 Demo ↗</a><button onClick={restart}>恢复演示数据</button></header>
    <div className="comparison-controls"><span>文档为采用版本的阅读快照，展示认可不代表业务规则确认。</span><label>Demo 宽度<input aria-label="Demo 宽度" type="range" min="45" max="75" value={width} onChange={(event) => setWidth(Number(event.target.value))} />{width}%</label></div>
    <div className="comparison-columns" style={{ gridTemplateColumns: `${width}fr ${100-width}fr` }}>
      <section className="comparison-demo" aria-label="可交互 Demo"><div className="comparison-panel-heading"><strong>可交互 Demo</strong><span>{Math.round(scale*100)}% · 自动适配</span></div><div ref={viewport} className="comparison-viewport"><iframe key={reset} ref={frame} title="业务交互 Demo" src={content.demoEntry} style={{ minWidth: content.minimumDemoWidth, width: `${100/scale}%`, height: `${100/scale}%`, transform: `scale(${scale})` }} /></div></section>
      <aside className="comparison-spec" aria-label="对应需求说明"><div className="comparison-panel-heading"><strong>需求说明</strong>{url && <a href={url} target="_blank" rel="noreferrer">查看原文 ↗</a>}</div>
        <div className="comparison-source">{content.source.title} · {content.source.revision || "版本待采用"}{content.source.capturedAt ? ` · ${content.source.capturedAt}` : ""} · 非实时同步</div>
        <div className="comparison-tabs" role="group" aria-label="说明浏览方式">{[["current","当前说明"],["related","相关说明"],["full","完整文档"]].map(([key,label]) => <button key={key} aria-pressed={view===key} onClick={() => switchView(key)}>{label}</button>)}</div>
        {view === "current" && <label className="comparison-follow"><input type="checkbox" checked={manual === null} onChange={(event) => setManual(event.target.checked ? null : selected?.id || null)} />跟随页面与操作</label>}
        {selected && <label className="comparison-section-select">{view === "full" ? "完整目录（含无 Demo 对应区域的章节）" : "选择说明"}<select aria-label="需求章节" value={selected.id} onChange={(event) => choose(event.target.value)}>{content.sections.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
        <article ref={article} className="comparison-article">
          {view === "related" && <section className="comparison-related"><h3>与当前页面相关</h3>{resolved.related.length ? resolved.related.map((item) => <button aria-pressed={selected?.id===item.id} key={item.id} onClick={() => choose(item.id)}>{item.title}</button>) : <p>当前页面尚未配置相关条款，可通过完整文档查找。</p>}</section>}
          {!!resolved.global.length && <details className="comparison-global"><summary>全局说明</summary>{resolved.global.map((item) => <button key={item.id} onClick={() => choose(item.id)}>{item.title}</button>)}</details>}
          {view === "current" && !resolved.current && <div className="comparison-outside">当前页面没有自动关联，文档仍可通过完整目录浏览。</div>}
          {selected ? <><h2>{selected.title}</h2><RequirementBody body={selected.body} /></> : <><h2>尚未接入需求文本</h2><p>采用业务文档版本后，填写 comparison-content.json 中的章节及页面关联。此空状态不代表需求缺失或规则通过。</p></>}
        </article>
      </aside>
    </div>
  </main>;
}
