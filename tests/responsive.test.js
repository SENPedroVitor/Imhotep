import test from "node:test";
import assert from "node:assert/strict";
import { blankDocument, applyOperations } from "../src/core/document.js";
import { layoutDocument, renderSvg } from "../public/renderer.js";
test("constraints resize nested children and flex wrap uses the same persisted layout", () => {
  let doc = blankDocument("Responsive");
  const root = doc.nodes[0].id;
  doc = applyOperations(doc, [
    { type: "update_node", id: root, changes: { width: 600, height: 400 } },
    {
      type: "create_node",
      node: {
        id: "child",
        name: "Child",
        type: "frame",
        parentId: root,
        x: 20,
        y: 20,
        width: 560,
        height: 100,
        fill: "#FFFFFF",
        constraints: { horizontal: "stretch", vertical: "top" },
      },
    },
    {
      type: "create_node",
      node: {
        id: "right",
        name: "Right",
        type: "rectangle",
        parentId: "child",
        x: 500,
        y: 10,
        width: 40,
        height: 30,
        fill: "#328BFF",
        constraints: { horizontal: "right", vertical: "top" },
      },
    },
  ]);
  doc = applyOperations(doc, [
    { type: "update_node", id: root, changes: { width: 360 } },
  ]);
  assert.equal(doc.nodes.find((n) => n.id === "child").width, 320);
  assert.equal(doc.nodes.find((n) => n.id === "right").x, 260);
  doc = applyOperations(doc, [
    {
      type: "update_node",
      id: "child",
      changes: { layout: "horizontal", wrap: true, gap: 10, padding: 10 },
    },
    {
      type: "update_node",
      id: "right",
      changes: {
        width: 200,
        height: 40,
        constraints: { horizontal: "left", vertical: "top" },
      },
    },
    {
      type: "create_node",
      node: {
        id: "second",
        name: "Second",
        type: "rectangle",
        parentId: "child",
        x: 0,
        y: 0,
        width: 200,
        height: 40,
      },
    },
  ]);
  const rendered = layoutDocument(doc);
  assert.equal(rendered.nodes.find((n) => n.id === "right").x, 10);
  assert.equal(rendered.nodes.find((n) => n.id === "second").y, 60);
  const clipped = applyOperations(doc, [
    { type: "update_node", id: "child", changes: { clip: true } },
  ]);
  assert.match(renderSvg(clipped), /clip-path="url\(#clip-child\)"/);
  assert.throws(() =>
    applyOperations(doc, [
      {
        type: "update_node",
        id: "right",
        changes: { constraints: { horizontal: "script", vertical: "top" } },
      },
    ]),
  );
  assert.throws(() =>
    applyOperations(doc, [
      { type: "update_node", id: "right", changes: { semanticTag: "script" } },
    ]),
  );
});
