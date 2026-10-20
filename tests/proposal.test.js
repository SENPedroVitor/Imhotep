import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/core/store.js";
import { Kendrick } from "../src/agents/kendrick.js";

test("proposal comparison uses its original snapshot and exposes conflicts without applying changes", () => {
  const dir = mkdtempSync(join(tmpdir(), "imhotep-diff-")),
    store = new Store(dir),
    kendrick = new Kendrick(store);
  try {
    const p = store.create("Review"),
      node = p.document.nodes[0];
    kendrick.save({
      id: "proposal",
      projectId: p.id,
      status: "proposed",
      baseRevision: 0,
      operations: [
        { type: "update_node", id: node.id, changes: { fill: "#328BFF" } },
      ],
    });
    let diff = kendrick.diff(p.id, "proposal");
    assert.equal(diff.conflict, false);
    assert.deepEqual(diff.changes[0].fields, [
      { property: "fill", before: node.fill, after: "#328BFF" },
    ]);
    store.mutate(p.id, {
      baseRevision: 0,
      author: "person",
      operationId: "person-change",
      operations: [
        { type: "update_node", id: node.id, changes: { fill: "#FF0000" } },
      ],
    });
    diff = kendrick.diff(p.id, "proposal");
    assert.equal(diff.conflict, true);
    assert.equal(diff.changes[0].fields[0].before, node.fill);
    assert.throws(
      () => kendrick.apply(p.id, "proposal"),
      (e) => e.status === 409,
    );
    assert.equal(store.get(p.id).document.nodes[0].fill, "#FF0000");
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
