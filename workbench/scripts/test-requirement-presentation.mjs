import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { formatRecordTime, buildEvidenceGraph } from "../src/requirement-presentation.js";

const record = JSON.parse(fs.readFileSync(new URL("../src/cx-requirement-detail.json", import.meta.url)));
const overview = JSON.parse(fs.readFileSync(new URL("../src/cx-overview.json", import.meta.url)));

test("date-only records never acquire an invented minute", () => {
  assert.deepEqual(formatRecordTime("2026-08-14"), {date:"2026-08-14",time:"具体时间未记录"});
  assert.equal(formatRecordTime(null).time, "具体时间未记录");
  for (const stage of record.stages) assert.equal(formatRecordTime(stage.updatedAt).time, "具体时间未记录");
});
test("precise timestamps display actual Shanghai minutes", () => {
  assert.deepEqual(formatRecordTime("2026-08-14T02:35:18Z"), {date:"2026-08-14", time:"10:35 · 上海时间"});
});
test("graph only connects explicitly referenced nodes to the requirement", () => {
  const before = JSON.stringify(record);
  const graph = buildEvidenceGraph(record, overview.pages);
  assert.equal(graph.nodes.length, 13);
  assert.equal(graph.edges.length, 12);
  assert.equal(new Set(graph.nodes.map(n => n.id)).size, 13);
  for (const edge of graph.edges) {
    assert.equal(edge.from, record.id);
    assert(graph.nodes.some(node => node.id === edge.to));
  }
  assert.equal(JSON.stringify(record), before);
  assert(graph.nodes.every(n => n.x > 0 && n.x < 100 && n.y > 0 && n.y < 100));
});
test("all associated pages retain their source and purpose", () => {
  for (const id of record.pages) {
    const page = overview.pages.find(p => p.id === id);
    assert(page?.title && page?.source && page?.goal);
  }
});
