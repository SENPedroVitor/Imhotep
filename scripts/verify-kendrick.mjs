import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { Store } from "../src/core/store.js";
import { Kendrick } from "../src/agents/kendrick.js";
const dir = await mkdtemp(join(tmpdir(), "imhotep-kendrick-live-"));
const store = new Store(dir),
  kendrick = new Kendrick(store);
try {
  const p = store.create("Teste real de integração"),
    node = p.document.nodes[0];
  const s = await kendrick.start(p.id, {
    provider: process.env.IMHOTEP_TEST_PROVIDER || "codex",
    prompt:
      "Mude somente o preenchimento do frame selecionado para #3366FF. Proponha exatamente uma operação update_node. Não use ferramentas.",
    selectionId: node.id,
  });
  let current = s,
    last = "";
  while (["queued", "thinking"].includes(current.status)) {
    current = kendrick.get(p.id, s.id);
    if (last !== current.status) {
      console.log("Kendrick:", current.status);
      last = current.status;
    }
    if (["queued", "thinking"].includes(current.status))
      await new Promise((r) => setTimeout(r, 500));
  }
  assert.equal(current.status, "proposed", current.error);
  assert.equal(
    store.get(p.id).revision,
    0,
    "Proposta não deve gravar antes da aprovação",
  );
  const result = kendrick.apply(p.id, s.id);
  assert.equal(result.event.revision, 1);
  assert.equal(store.get(p.id).document.nodes[0].fill, "#3366FF");
  assert.equal(kendrick.apply(p.id, s.id).event, null);
  console.log(
    "Real provider integration passed: proposal → review → idempotent apply.",
  );
} finally {
  await kendrick.close();
  store.close();
  await rm(dir, { recursive: true, force: true });
}
