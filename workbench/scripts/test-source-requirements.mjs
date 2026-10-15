import test from "node:test";
import assert from "node:assert/strict";
import { sourceRequirements, sourceSnapshot, findSourceRequirement, filterSourceRequirements, pendingSourceRequirements } from "../src/source-requirements.js";

test("all entry points resolve the same project-qualified object", () => {
  assert.equal(sourceRequirements.length,28);
  assert.equal(new Set(sourceRequirements.map(item=>item.key)).size,28);
  for(const item of sourceRequirements) assert.equal(findSourceRequirement(item.key),item);
  assert.equal(findSourceRequirement("REQ-024"),undefined);
  assert.equal(findSourceRequirement("other:CR-027"),undefined);
});
test("filters combine without changing source records", () => {
  const before=JSON.stringify(sourceRequirements);
  const results=filterSourceRequirements(sourceRequirements,{project:sourceSnapshot.projectId,query:"cr-027",status:"waiting-human",stage:"page-docs-update"});
  assert.equal(results.length,1);
  assert.equal(results[0],findSourceRequirement(`${sourceSnapshot.projectId}:CR-027`));
  assert.equal(filterSourceRequirements(sourceRequirements,{project:"unknown"}).length,0);
  assert.equal(filterSourceRequirements(sourceRequirements,{}).length,28);
  assert.equal(JSON.stringify(sourceRequirements),before);
});
test("home pending cards are a read-only subset, not demo or live runtime state", () => {
  const pending=pendingSourceRequirements(sourceRequirements);
  assert(pending.length>0);
  assert(pending.every(item=>item.executionState==="waiting-human" && sourceRequirements.includes(item)));
  assert(!pending.some(item=>item.executionState==="completed"));
});
