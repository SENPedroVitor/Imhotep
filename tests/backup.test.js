import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, copyFile, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/core/store.js";
import { Backups } from "../src/core/backups.js";
import { outlineFonts } from "../src/core/fonts.js";
import { renderSvg } from "../public/renderer.js";
test("verified SQLite backup can restore document and revision history to a new server directory", async () => {
  const dir = await mkdtemp(join(tmpdir(), "imhotep-backup-")),
    store = new Store(join(dir, "data"));
  let restored;
  try {
    const p = store.create("Restore test");
    store.mutate(p.id, {
      baseRevision: 0,
      operationId: "test",
      author: "test",
      operations: [
        {
          type: "update_node",
          id: p.document.nodes[0].id,
          changes: { fill: "#123456" },
        },
      ],
    });
    const backups = new Backups(store, join(dir, "external-backups"));
    const result = await backups.create();
    assert.equal(result.verified, true);
    assert.equal((await backups.list()).length, 1);
    await mkdir(join(dir, "restored"));
    await copyFile(
      join(dir, "external-backups", result.name),
      join(dir, "restored", "imhotep.sqlite"),
    );
    restored = new Store(join(dir, "restored"));
    assert.equal(restored.get(p.id).document.nodes[0].fill, "#123456");
    assert.equal(restored.history(p.id).length, 2);
    assert.equal(restored.get(p.id).revision, 1);
  } finally {
    restored?.close();
    store.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("local font outlines render without relying on server-installed fonts", async () => {
  const bytes = await readFile(
    new URL("../public/fonts/Inter.woff2", import.meta.url),
  );
  const data = "data:font/woff2;base64," + bytes.toString("base64");
  const doc = {
    schemaVersion: 1,
    name: "Font",
    fonts: [{ id: "font-local", name: "Inter", data }],
    nodes: [
      {
        id: "label",
        type: "text",
        name: "Label",
        x: 0,
        y: 0,
        width: 200,
        height: 40,
        text: "Imhotep",
        fontFamily: "font-local",
        fontSize: 24,
        fill: "#123456",
      },
    ],
  };
  const svg = renderSvg(outlineFonts(doc));
  assert.match(svg, /<path d=/);
  assert.match(svg, /scale\(/);
  assert.doesNotMatch(svg, /<text /);
});
