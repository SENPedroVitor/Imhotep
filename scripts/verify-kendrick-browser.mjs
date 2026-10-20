import { chromium } from "@playwright/test";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { startServer } from "../src/server/index.js";
const dir = await mkdtemp(join(tmpdir(), "imhotep-kendrick-ui-")),
  app = await startServer({
    port: 0,
    dataDir: dir,
    seed: false,
    tailscaleHost: process.env.IMHOTEP_TEST_TAILSCALE_IP,
  });
const base = `http://${process.env.IMHOTEP_TEST_TAILSCALE_IP || "127.0.0.1"}:${app.port}`;
let browser;
try {
  const p = await (
    await fetch(base + "/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Kendrick — teste real" }),
    })
  ).json();
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/?project=" + p.id);
  await page.locator(`[data-select="${p.document.nodes[0].id}"]`).click();
  await page.getByRole("button", { name: "Kendrick", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Provedor do Kendrick" })
    .selectOption("codex");
  await page
    .getByRole("textbox", { name: "Mensagem para Kendrick" })
    .fill(
      "Mude somente o preenchimento do frame selecionado para #3366FF. Proponha exatamente uma operação update_node, sem usar ferramentas.",
    );
  await page.getByRole("button", { name: "Enviar para Kendrick" }).click();
  console.log("Waiting for real Codex proposal in the browser…");
  await page
    .getByRole("button", { name: "Aplicar proposta" })
    .waitFor({ timeout: 180000 });
  const before = await (await fetch(base + `/api/projects/${p.id}`)).json();
  assert.equal(before.revision, 0);
  await page.getByRole("button", { name: "Aplicar proposta" }).click();
  await page.waitForFunction(
    (id) =>
      document
        .querySelector(`#scene [data-node-id="${id}"] rect`)
        ?.getAttribute("fill") === "#3366FF",
    p.document.nodes[0].id,
  );
  await page.getByText("applied · revisão 0", { exact: false }).waitFor();
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/kendrick-connected.png" });
  assert.deepEqual(errors, []);
  console.log(
    "Kendrick browser integration passed: selection → actual Codex → proposal → approval → saved canvas.",
  );
} finally {
  await browser?.close();
  await app.close();
  await rm(dir, { recursive: true, force: true });
}
