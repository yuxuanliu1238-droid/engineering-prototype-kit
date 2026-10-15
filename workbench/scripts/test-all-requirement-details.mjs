import test from "node:test";
import assert from "node:assert/strict";
import { sourceRequirements } from "../src/source-requirements.js";
import { buildDetailSnapshot, currentStageFor, requirementConclusion } from "../src/requirement-detail-model.js";
import { buildEvidenceGraph, paginateEvidenceGraph } from "../src/requirement-presentation.js";
import overview from "../src/cx-overview.json" with {type:"json"};

test("every source requirement has a complete presentation model", () => {
  assert.equal(sourceRequirements.length,28);
  for (const record of sourceRequirements) {
    assert(record.stages.length > 0);
    assert.equal(currentStageFor(record).id,record.stageId);
    for (const field of ["notes","pages","documents","evidence","allowedArtifactTypes","deferredArtifactTypes"]) assert(Array.isArray(record[field]));
    assert(record.readAt && record.sha256 && record.source);
  }
});

test("completed and waiting records do not inherit CR-027 conclusions", () => {
  const completed=sourceRequirements.find(record=>record.id==="CR-001");
  const waiting=sourceRequirements.find(record=>record.id==="CR-027");
  assert.equal(requirementConclusion(completed),"本轮需求已完成");
  assert.equal(requirementConclusion(waiting),"等待你的确认");
  assert(completed.confirmedAt);
  assert.equal(waiting.confirmedAt,null);
});

test("graph pagination preserves every reference and bounds every node", () => {
  for (const record of sourceRequirements) {
    const graph=buildEvidenceGraph(record,overview.pages);
    assert.equal(graph.nodes.length,1+record.pages.length+record.evidence.length+record.documents.length);
    const ids=new Set();
    const first=paginateEvidenceGraph(graph);
    for(let page=0;page<first.totalPages;page++) {
      const view=paginateEvidenceGraph(graph,page);
      assert(view.nodes.length <= 13);
      for(const node of view.nodes.slice(1)) {
        assert(node.x>0 && node.x<100 && node.y>0 && node.y<100);
        assert(!ids.has(node.id));
        ids.add(node.id);
      }
      assert(view.edges.every(edge=>edge.from===record.id && view.nodes.some(node=>node.id===edge.to)));
    }
    assert.equal(ids.size,graph.nodes.length-1);
  }
});

test("missing records remain explicitly unknown", () => {
  const registry={project:{id:"test"},workflow:{stages:[{id:"waiting",label:"待处理"}]},requirements:[{id:"EMPTY",title:"缺失资料",currentStageId:"waiting"}]};
  const record=buildDetailSnapshot(registry,{}).items[0];
  assert.equal(record.scope,null);
  assert.equal(record.confirmedAt,null);
  assert.equal(record.executionState,"unknown");
  assert.equal(currentStageFor(record).updatedAt,null);
  assert.equal(currentStageFor(record).status,"unrecorded");
  assert.equal(paginateEvidenceGraph(buildEvidenceGraph(record,[])).nodes.length,1);
});
