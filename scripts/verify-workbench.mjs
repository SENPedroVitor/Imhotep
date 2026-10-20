import { chromium } from "@playwright/test";
import { startServer } from "../src/server/index.js";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const dir = await mkdtemp(join(tmpdir(), "imhotep-workbench-")),
  app = await startServer({ port: 0, dataDir: dir, seed: false });
const base = `http://127.0.0.1:${app.port}`;
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    }),
    errors = [];
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e) => errors.push(e.message));
  const p = await (
    await fetch(base + "/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Workbench" }),
    })
  ).json();
  await page.goto(`${base}/?project=${p.id}`);
  await page.locator("#scene [data-node-id]").first().waitFor();
  await page.locator(`[data-select="${p.document.nodes[0].id}"]`).click();
  await page.getByRole("button", { name: "Componentes", exact: true }).click();
  await page
    .getByRole("button", { name: "Criar componente", exact: true })
    .click();
  await page.getByRole("button", { name: "Inserir", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector("#save-label").textContent === "Salvo no servidor",
  );
  let stored = await (await fetch(base + `/api/projects/${p.id}`)).json();
  assert.equal(stored.document.nodes.length, 2);
  await page.getByRole("button", { name: "Design", exact: true }).click();
  await page
    .getByRole("button", { name: "Adicionar retângulo · R", exact: true })
    .click();
  await page
    .locator(".layer-row.selected")
    .filter({ hasText: "Retângulo" })
    .waitFor();
  await page
    .getByRole("textbox", { name: "Nome do elemento", exact: true })
    .fill("Botão de navegação");
  await page
    .getByRole("textbox", { name: "Nome do elemento", exact: true })
    .press("Tab");
  await page.waitForFunction(
    () =>
      document.querySelector("#save-label").textContent === "Salvo no servidor",
  );
  await page.getByRole("button", { name: "Motion", exact: true }).click();
  await page
    .getByRole("button", { name: "Adicionar animação", exact: true })
    .click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.getByText("600 ms · ease-in-out · 2 keyframes").waitFor();
  await page.getByRole("slider", { name: "Tempo da animação" }).fill("300");
  stored = await (await fetch(base + `/api/projects/${p.id}`)).json();
  assert.equal(stored.document.animations.length, 1);
  await page.getByRole("button", { name: "Protótipo", exact: true }).click();
  await page
    .locator("[name=targetId]")
    .selectOption(stored.document.nodes[1].id);
  await page
    .getByRole("button", { name: "Criar conexão", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector("#save-label").textContent === "Salvo no servidor",
  );
  const preview = await browser.newPage();
  preview.on("pageerror", (e) => errors.push(e.message));
  await preview.goto(`${base}/api/projects/${p.id}/prototype`);
  await preview.locator("#stage [data-node-id]").first().waitFor();
  const button = stored.document.nodes.find(
    (n) => n.name === "Botão de navegação",
  );
  await preview.locator(`[data-node-id="${button.id}"]`).click({ force: true });
  await preview
    .locator(`#stage > svg > [data-node-id="${stored.document.nodes[1].id}"]`)
    .waitFor();
  await preview.close();
  await page.getByRole("button", { name: "Tokens", exact: true }).click();
  await page
    .getByRole("button", { name: "Adicionar token", exact: true })
    .click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page
    .getByRole("button", { name: "Cor primária", exact: false })
    .waitFor();
  await page.locator("[data-work=new-page]").click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#page-select").options.length === 2,
  );
  assert.equal(await page.locator("#scene [data-node-id]").count(), 0);
  await page.getByRole("button", { name: "Vetor", exact: true }).click();
  await page.getByRole("button", { name: "Design", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Geometria vetorial", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Kendrick", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Mensagem para Kendrick", exact: true })
    .waitFor();
  await page.locator("#inspector kendrick-avatar").first().waitFor();
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/workbench.png" });
  assert.deepEqual(errors, []);
  console.log(
    "Workbench passed: components, motion keyframes, prototype navigation, tokens, pages, vector editor, Kendrick UI.",
  );
} finally {
  await browser?.close();
  await app.close();
  await rm(dir, { recursive: true, force: true });
}
