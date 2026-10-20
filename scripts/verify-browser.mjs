import { chromium } from "@playwright/test";
import { startServer } from "../src/server/index.js";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
const dir = await mkdtemp(join(tmpdir(), "imhotep-browser-"));
const app = await startServer({
  port: 0,
  dataDir: dir,
  tailscaleHost: process.env.IMHOTEP_TEST_TAILSCALE_IP,
});
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.setDefaultTimeout(10000);
  const base = `http://${process.env.IMHOTEP_TEST_TAILSCALE_IP || "127.0.0.1"}:${app.port}`;
  await page.goto(base);
  await page.getByRole("heading", { name: "Canvases", exact: true }).waitFor();
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/home.png" });
  await page.locator(".project-card").first().click();
  await page.locator("#scene [data-node-id]").first().waitFor();
  await page.screenshot({ path: "artifacts/editor.png" });
  const projectId = await page.evaluate(() =>
    new URLSearchParams(location.search).get("project"),
  );
  const get = () =>
    fetch(`${base}/api/projects/${projectId}`).then((r) => r.json());
  const original = await get();
  await page
    .getByRole("button", { name: "Adicionar retângulo · R", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector("#save-label").textContent === "Salvo no servidor",
  );
  await page
    .getByRole("textbox", { name: "Nome do elemento", exact: true })
    .fill("Retângulo de teste");
  await page
    .getByRole("textbox", { name: "Nome do elemento", exact: true })
    .press("Tab");
  await page.waitForFunction(() =>
    document
      .querySelector(".layer-row.selected")
      ?.textContent.includes("Retângulo de teste"),
  );
  let project = await get();
  assert.equal(
    project.document.nodes.length,
    original.document.nodes.length + 1,
  );
  const box = project.document.nodes.find(
    (n) => n.name === "Retângulo de teste",
  );
  assert.ok(box);
  // Change from a headless agent while the browser is open.
  const r = await fetch(`${base}/api/projects/${projectId}/operations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseRevision: project.revision,
      operationId: "browser-smoke-agent",
      author: "codex",
      operations: [
        {
          type: "update_node",
          id: box.id,
          changes: { fill: "#FF8844", x: 42 },
        },
      ],
    }),
  });
  assert.equal(r.status, 200);
  await page.waitForFunction(
    (id) =>
      document
        .querySelector(`[data-node-id="${id}"] rect`)
        ?.getAttribute("fill") === "#FF8844",
    box.id,
  );
  assert.equal(
    await page.getByRole("spinbutton", { name: "X", exact: true }).inputValue(),
    "42",
  );
  // Drag persists actual coordinates.
  const shape = page.locator(`#scene [data-node-id="${box.id}"] rect`);
  const rect = await shape.boundingBox();
  await page.mouse.move(rect.x + 10, rect.y + 10);
  await page.mouse.down();
  await page.mouse.move(rect.x + 60, rect.y + 50, { steps: 5 });
  await page.mouse.up();
  await page.waitForFunction(
    () =>
      document.querySelector("#save-label").textContent === "Salvo no servidor",
  );
  project = await get();
  assert.ok(project.document.nodes.find((n) => n.id === box.id).x > 42);
  await page.reload();
  await page.locator("#scene [data-node-id]").first().waitFor();
  await page.locator(`[data-select="${box.id}"]`).click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Nome do elemento", exact: true })
      .inputValue(),
    "Retângulo de teste",
  );
  // Keyboard create, undo and redo.
  await page.locator("#canvas").focus();
  await page.keyboard.press("t");
  await page
    .getByRole("textbox", { name: "Conteúdo do texto", exact: true })
    .waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector("#save-label").textContent === "Salvo no servidor",
  );
  const withText = (await get()).document.nodes.length;
  await page
    .getByRole("button", { name: "Desfazer · Ctrl+Z", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector("#save-label").textContent === "Salvo no servidor",
  );
  assert.equal((await get()).document.nodes.length, withText - 1);
  await page
    .getByRole("button", { name: "Refazer · Ctrl+Shift+Z", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector("#save-label").textContent === "Salvo no servidor",
  );
  assert.equal((await get()).document.nodes.length, withText);
  await page.getByRole("button", { name: "Dev", exact: true }).click();
  await page.getByRole("button", { name: "PNG", exact: true }).waitFor();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG", exact: true }).click();
  const file = await download;
  assert.ok(file.suggestedFilename().endsWith(".png"));
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page.locator("dialog[open] .preview-content > svg").waitFor();
  await page
    .getByRole("button", { name: "Fechar prévia", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Histórico de revisões", exact: true })
    .click();
  await page.locator(".history-item").first().waitFor();
  assert.ok(
    (await page.locator(".history-item").allTextContents())
      .join()
      .includes("codex"),
  );
  // An explicit new project is saved and reopened.
  await page
    .getByRole("button", { name: "Voltar aos canvases", exact: true })
    .click();
  await page.getByRole("button", { name: "Novo canvas", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Nome do canvas", exact: true })
    .fill("Canvas persistente");
  await page.getByRole("button", { name: "Criar canvas", exact: true }).click();
  await page.locator("#scene [data-node-id]").first().waitFor();
  await page.reload();
  await page.locator("#scene [data-node-id]").first().waitFor();
  assert.ok(
    await page
      .locator(".project-name")
      .textContent()
      .then((s) => s.includes("Canvas persistente")),
  );
  // An HTTP response lost after commit must not duplicate an operation on retry.
  const freshId = await page.evaluate(() =>
    new URLSearchParams(location.search).get("project"),
  );
  const freshBefore = await (
    await fetch(`${base}/api/projects/${freshId}`)
  ).json();
  let loseResponse = true;
  await page.route("**/operations", async (route) => {
    if (loseResponse) {
      loseResponse = false;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Adicionar elipse · O", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Verificar e repetir envio", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Verificar e repetir envio", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector("#save-label").textContent === "Salvo no servidor",
  );
  const freshAfter = await (
    await fetch(`${base}/api/projects/${freshId}`)
  ).json();
  assert.equal(freshAfter.revision, freshBefore.revision + 1);
  assert.equal(
    freshAfter.document.nodes.length,
    freshBefore.document.nodes.length + 1,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Browser verification passed: create/edit/drag/reload, agent SSE, undo/redo, PNG, preview, history, idempotent retry after lost response.",
  );
  console.log("Screenshots:", resolve("artifacts/editor.png"));
} finally {
  await browser?.close();
  await app.close();
  await rm(dir, { recursive: true, force: true });
}
