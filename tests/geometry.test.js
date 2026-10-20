import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { blankDocument, applyOperations } from "../src/core/document.js";
import { renderSvg } from "../public/renderer.js";
import { parsePath, pathData, splitCurve } from "../public/vector.js";
function fixture() {
  let doc = blankDocument("Geometria");
  const parentId = doc.nodes[0].id;
  doc = applyOperations(doc, [
    {
      type: "create_node",
      node: {
        id: "a",
        type: "rectangle",
        name: "A",
        parentId,
        x: 20,
        y: 20,
        width: 100,
        height: 100,
        fill: "#328BFF",
      },
    },
    {
      type: "create_node",
      node: {
        id: "b",
        type: "rectangle",
        name: "B",
        parentId,
        x: 60,
        y: 50,
        width: 100,
        height: 100,
        fill: "#328BFF",
      },
    },
  ]);
  return doc;
}
test("boolean operations preserve coordinates and paint the correct regions, including holes", async () => {
  for (const [operation, expected] of [
    ["unite", [true, true, true]],
    ["subtract", [true, false, false]],
    ["intersect", [false, true, false]],
    ["exclude", [true, false, true]],
  ]) {
    const doc = applyOperations(fixture(), [
      { type: "boolean_nodes", ids: ["a", "b"], id: "result", operation },
    ]);
    const n = doc.nodes.find((n) => n.id === "result");
    assert.equal(n.type, "path");
    assert.equal(n.x, operation === "intersect" ? 60 : 20);
    assert.ok(!doc.nodes.some((n) => ["a", "b"].includes(n.id)));
    const { data, info } = await sharp(
      Buffer.from(renderSvg(doc, doc.nodes[0].id)),
    )
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (const [index, [x, y]] of [
      [30, 30],
      [70, 70],
      [140, 70],
    ].entries()) {
      const offset = (y * info.width + x) * info.channels;
      const blue =
        data[offset] === 50 &&
        data[offset + 1] === 139 &&
        data[offset + 2] === 255;
      assert.equal(blue, expected[index], `${operation} at ${x},${y}`);
    }
  }
});
test("normalizing an SVG path preserves handles and subdivision preserves its geometry", () => {
  let doc = fixture();
  doc = applyOperations(doc, [
    {
      type: "create_node",
      node: {
        id: "curve",
        type: "path",
        name: "Curve",
        parentId: doc.nodes[0].id,
        x: 220,
        y: 200,
        width: 200,
        height: 100,
        fill: "none",
        stroke: "#328BFF",
        strokeWidth: 2,
        pathData: "m0 90c30-90 170-90 200 0",
      },
    },
  ]);
  doc = applyOperations(doc, [{ type: "normalize_path", id: "curve" }]);
  const n = doc.nodes.find((n) => n.id === "curve"),
    contours = parsePath(n.pathData);
  assert.equal(contours[0].points.length, 2);
  assert.equal(contours[0].points[0].out.x, 30);
  assert.equal(contours[0].points[1].in.x, 170);
  assert.ok(splitCurve(contours[0], 0));
  assert.equal(contours[0].points.length, 3);
  assert.equal(contours[0].points[1].x, 100);
  assert.equal(contours[0].points[1].y, 22.5);
  assert.equal(parsePath(pathData(contours))[0].points.length, 3);
  assert.throws(
    () =>
      applyOperations(doc, [
        {
          type: "boolean_nodes",
          operation: "unite",
          ids: ["a", "curve"],
          id: "bad",
        },
      ]),
    /Feche/,
  );
  assert.throws(() =>
    applyOperations(doc, [
      { type: "boolean_nodes", operation: "eval", ids: ["a", "b"], id: "bad" },
    ]),
  );
});
