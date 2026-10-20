import test from "node:test";
import assert from "node:assert/strict";
import { blankDocument, applyOperations } from "../src/core/document.js";
import { evaluateMotion } from "../public/motion.js";
import { layoutDocument, renderSvg } from "../public/renderer.js";
test("pages, components, variants, layout, interactions and animation share validated transactions", () => {
  let doc = blankDocument("Studio");
  const main = doc.nodes[0],
    frame = main.id;
  const child = {
    id: "button",
    type: "rectangle",
    name: "Button",
    parentId: frame,
    pageId: "page-1",
    x: 5,
    y: 10,
    width: 100,
    height: 40,
    fill: "#328BFF",
  };
  doc = applyOperations(doc, [
    { type: "create_node", node: child },
    { type: "create_component", id: frame },
    {
      type: "instantiate_component",
      componentId: frame,
      id: "instance",
      pageId: "page-1",
      x: 1100,
      y: 0,
    },
  ]);
  assert.equal(doc.nodes.filter((n) => n.componentId === frame).length, 2);
  assert.equal(
    doc.nodes.find((n) => n.id === "instance-1").parentId,
    "instance",
  );
  doc = applyOperations(doc, [
    {
      type: "update_node",
      id: frame,
      changes: { layout: "vertical", padding: 20, gap: 12 },
    },
    {
      type: "set_project_data",
      field: "interactions",
      value: [
        {
          id: "link",
          nodeId: "button",
          targetId: "instance",
          trigger: "click",
          action: "navigate",
          transition: "dissolve",
          duration: 250,
        },
      ],
    },
    {
      type: "set_project_data",
      field: "animations",
      value: [
        {
          id: "fade",
          nodeId: "button",
          duration: 1000,
          easing: "linear",
          keyframes: [
            { time: 0, values: { opacity: 0 } },
            { time: 1000, values: { opacity: 1 } },
          ],
        },
      ],
    },
  ]);
  assert.equal(layoutDocument(doc).nodes.find((n) => n.id === "button").x, 20);
  assert.equal(
    evaluateMotion(doc, 500).nodes.find((n) => n.id === "button").opacity,
    0.5,
  );
  assert.throws(() =>
    applyOperations(doc, [
      {
        type: "set_project_data",
        field: "interactions",
        value: [
          {
            id: "bad",
            nodeId: "missing",
            targetId: "missing",
            trigger: "click",
            action: "navigate",
            transition: "instant",
            duration: 0,
          },
        ],
      },
    ]),
  );
  assert.throws(() =>
    applyOperations(doc, [
      { type: "set_project_data", field: "pages", value: [] },
    ]),
  );
  const next = applyOperations(doc, [{ type: "delete_node", id: frame }]);
  assert.equal(next.interactions.length, 0);
  assert.equal(next.animations.length, 0);
  assert.equal(
    next.nodes.find((n) => n.id === "instance").componentId,
    undefined,
  );
  assert.match(renderSvg(doc), /fill="#328BFF"/);
});
test("paths and images reject script or external-resource inputs", () => {
  const doc = blankDocument("Vectors");
  const path = {
    id: "path",
    type: "path",
    name: "Curve",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    pathData: "M0 0 C10 10 50 90 100 100",
    fill: "none",
    stroke: "#328BFF",
    strokeWidth: 2,
  };
  assert.match(
    renderSvg(applyOperations(doc, [{ type: "create_node", node: path }])),
    /C10 10/,
  );
  assert.throws(() =>
    applyOperations(doc, [
      { type: "create_node", node: { ...path, pathData: "<script>" } },
    ]),
  );
  assert.throws(() =>
    applyOperations(doc, [
      {
        type: "create_node",
        node: {
          id: "img",
          type: "image",
          name: "External",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          src: "https://example.com/a.svg",
        },
      },
    ]),
  );
});

test("token bindings resolve consistently and page deletion preserves referential integrity", () => {
  let doc = blankDocument("Tokens"),
    node = doc.nodes[0];
  doc = applyOperations(doc, [
    {
      type: "set_project_data",
      field: "tokens",
      value: [
        { id: "primary", name: "Primary", type: "color", value: "#FF0000" },
      ],
    },
    {
      type: "update_node",
      id: node.id,
      changes: { tokenBindings: { fill: "primary" } },
    },
  ]);
  assert.match(renderSvg(doc), /fill="#FF0000"/);
  doc = applyOperations(doc, [
    {
      type: "set_project_data",
      field: "tokens",
      value: [
        { id: "primary", name: "Primary", type: "color", value: "#0000FF" },
      ],
    },
  ]);
  assert.match(renderSvg(doc), /fill="#0000FF"/);
  doc = applyOperations(doc, [
    {
      type: "set_project_data",
      field: "pages",
      value: [...doc.pages, { id: "second", name: "Second" }],
    },
    {
      type: "create_node",
      node: {
        id: "second-frame",
        type: "frame",
        name: "Second",
        pageId: "second",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        fill: "#FFFFFF",
      },
    },
  ]);
  doc = applyOperations(doc, [{ type: "delete_page", id: "second" }]);
  assert.equal(doc.pages.length, 1);
  assert.equal(doc.nodes.length, 1);
  assert.throws(() =>
    applyOperations(doc, [
      {
        type: "set_project_data",
        field: "fonts",
        value: [
          { id: "font-bad", name: "Bad", data: "data:font/ttf;base64,AAAA" },
        ],
      },
    ]),
  );
});

test("component edits propagate to instances while preserving local overrides", () => {
  let doc = blankDocument("Components");
  const id = doc.nodes[0].id;
  doc = applyOperations(doc, [
    { type: "create_component", id },
    { type: "instantiate_component", componentId: id, id: "first" },
    { type: "instantiate_component", componentId: id, id: "second" },
  ]);
  doc = applyOperations(doc, [
    { type: "update_node", id: "second", changes: { fill: "#FF0000" } },
    { type: "update_node", id, changes: { fill: "#0000FF" } },
  ]);
  assert.equal(doc.nodes.find((n) => n.id === "first").fill, "#0000FF");
  assert.equal(doc.nodes.find((n) => n.id === "second").fill, "#FF0000");
});
