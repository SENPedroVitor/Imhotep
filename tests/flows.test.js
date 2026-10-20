import test from "node:test";
import assert from "node:assert/strict";
import { blankDocument, applyOperations } from "../src/core/document.js";
import { evaluateMotion } from "../public/motion.js";
import { Presence } from "../src/server/presence.js";

test("flows and animation interactions validate references and clean up atomically on node deletion", () => {
  let doc = blankDocument("Flows"),
    frame = doc.nodes[0].id;
  doc = applyOperations(doc, [
    {
      type: "set_project_data",
      field: "flows",
      value: [{ id: "main", name: "Principal", startFrameId: frame }],
    },
    {
      type: "set_project_data",
      field: "animations",
      value: [
        {
          id: "fade",
          nodeId: frame,
          duration: 500,
          easing: "linear",
          keyframes: [
            { time: 0, values: { opacity: 0 } },
            { time: 500, values: { opacity: 1 } },
          ],
        },
      ],
    },
    {
      type: "set_project_data",
      field: "interactions",
      value: [
        {
          id: "animate",
          nodeId: frame,
          trigger: "key",
          key: "Enter",
          action: "animate",
          animationId: "fade",
          transition: "instant",
          duration: 0,
        },
      ],
    },
  ]);
  assert.equal(evaluateMotion(doc, 0, {}).nodes[0].opacity, undefined);
  assert.equal(evaluateMotion(doc, 0, { fade: 250 }).nodes[0].opacity, 0.5);
  for (const changes of [
    { animationId: "missing" },
    { key: "" },
    { trigger: "script" },
  ]) {
    assert.throws(() =>
      applyOperations(doc, [
        {
          type: "set_project_data",
          field: "interactions",
          value: [{ ...doc.interactions[0], ...changes }],
        },
      ]),
    );
  }
  assert.throws(() =>
    applyOperations(doc, [
      {
        type: "set_project_data",
        field: "flows",
        value: [{ id: "bad", name: "Bad", startFrameId: "missing" }],
      },
    ]),
  );
  const removed = applyOperations(doc, [{ type: "delete_node", id: frame }]);
  assert.deepEqual(removed.flows, []);
  assert.deepEqual(removed.animations, []);
  assert.deepEqual(removed.interactions, []);
});

test("selection presence validates page ownership, separates tabs and expires without editing the document", () => {
  const project = { id: "p", revision: 4, document: blankDocument("Presence") },
    presence = new Presence();
  const id = project.document.nodes[0].id;
  presence.update(project, {
    clientId: "tab1",
    pageId: "page-1",
    nodeIds: [id],
  });
  presence.update(project, { clientId: "tab2", pageId: "page-1", nodeIds: [] });
  assert.equal(presence.list(project).length, 2);
  assert.equal(project.revision, 4);
  assert.throws(() =>
    presence.update(project, {
      clientId: "bad",
      pageId: "other",
      nodeIds: [id],
    }),
  );
  assert.throws(() =>
    presence.update(project, {
      clientId: "bad",
      pageId: "page-1",
      nodeIds: ["missing"],
    }),
  );
  presence.clients.get("tab1").updatedAt = Date.now() - 91000;
  assert.deepEqual(
    presence.list(project).map((c) => c.clientId),
    ["tab2"],
  );
});
