import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/core/store.js";
import { validateDocument } from "../src/core/document.js";
import { renderSvg } from "../public/renderer.js";
const setup = (t) => {
  const dir = mkdtempSync(join(tmpdir(), "imhotep-"));
  let store = new Store(dir);
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    dir,
    get store() {
      return store;
    },
    reopen() {
      store.close();
      store = new Store(dir);
      return store;
    },
  };
};
const req = (revision, operationId, operations) => ({
  baseRevision: revision,
  operationId,
  author: "codex",
  operations,
});
const box = (id = "box", parentId) => ({
  id,
  type: "rectangle",
  name: "Box",
  x: 10,
  y: 20,
  width: 100,
  height: 80,
  fill: "#328BFF",
  ...(parentId ? { parentId } : {}),
});
test("atomic batch, durable history, conflict rejection and idempotency across restart", (t) => {
  const env = setup(t),
    s = env.store,
    p = s.create("Teste"),
    frame = p.document.nodes[0];
  const request = req(0, "batch-one", [
    { type: "create_node", node: box("box", frame.id) },
    { type: "update_node", id: frame.id, changes: { fill: "#F0F1F5" } },
  ]);
  const event = s.mutate(p.id, request);
  assert.equal(event.revision, 1);
  assert.equal(event.author, "codex");
  assert.throws(
    () => s.mutate(p.id, req(0, "stale", [{ type: "delete_node", id: "box" }])),
    (e) => e.status === 409,
  );
  assert.throws(() =>
    s.mutate(
      p.id,
      req(1, "invalid", [
        { type: "update_node", id: "box", changes: { x: 50 } },
        { type: "update_node", id: "box", changes: { width: -1 } },
      ]),
    ),
  );
  assert.equal(s.get(p.id).document.nodes[1].x, 10);
  assert.equal(s.get(p.id).revision, 1);
  assert.equal(s.mutate(p.id, request).replayed, true);
  assert.throws(
    () => s.mutate(p.id, { ...request, author: "another" }),
    (e) => e.status === 409,
  );
  const reopened = env.reopen();
  assert.equal(reopened.get(p.id).document.nodes.length, 2);
  assert.equal(reopened.history(p.id).length, 2);
  assert.equal(reopened.mutate(p.id, request).replayed, true);
  reopened.mutate(p.id, {
    baseRevision: 1,
    operationId: "restore-one",
    author: "user",
    restoreRevision: 0,
  });
  assert.equal(reopened.get(p.id).document.nodes.length, 1);
  assert.equal(reopened.get(p.id).revision, 2);
  assert.equal(reopened.history(p.id)[1].author, "codex");
});
test("hierarchy cycles, unknown fields and invalid colors are rejected; subtree delete is atomic", (t) => {
  const { store: s } = setup(t),
    p = s.create("Teste"),
    frame = p.document.nodes[0];
  s.mutate(
    p.id,
    req(0, "create", [{ type: "create_node", node: box("box", frame.id) }]),
  );
  assert.throws(() =>
    s.mutate(
      p.id,
      req(1, "cycle", [
        { type: "update_node", id: frame.id, changes: { parentId: frame.id } },
      ]),
    ),
  );
  assert.throws(() =>
    s.mutate(
      p.id,
      req(1, "unknown", [
        { type: "update_node", id: "box", changes: { onclick: "alert(1)" } },
      ]),
    ),
  );
  assert.throws(() =>
    s.mutate(
      p.id,
      req(1, "color", [
        {
          type: "update_node",
          id: "box",
          changes: { fill: "url(http://example.test)" },
        },
      ]),
    ),
  );
  s.mutate(p.id, req(1, "delete", [{ type: "delete_node", id: frame.id }]));
  assert.equal(s.get(p.id).document.nodes.length, 0);
});
test("renderer escapes document text and isolates frame exports", () => {
  const doc = validateDocument({
    schemaVersion: 1,
    name: "Test",
    nodes: [
      { ...box("frame"), type: "frame", x: 400, y: 300 },
      {
        ...box("text", "frame"),
        type: "text",
        text: '<script>& "quote"',
        fontSize: 16,
      },
    ],
  });
  const svg = renderSvg(doc, "frame");
  assert.match(svg, /&lt;script&gt;&amp;/);
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /viewBox="0 0 100 80"/);
  assert.match(svg, /translate\(0 0\)/);
});
