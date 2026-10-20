import { chromium } from "@playwright/test";
import { startServer } from "../src/server/index.js";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { Kendrick } from "../src/agents/kendrick.js";
import assert from "node:assert/strict";
const dir = await mkdtemp(join(tmpdir(), "imhotep-flows-"));
let app = await startServer({ port: 0, dataDir: dir, seed: false }),
  browser;
let base = `http://127.0.0.1:${app.port}`;
async function post(path, body) {
  const r = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.ok(r.ok, await r.clone().text());
  return r.json();
}
const frame = (id, x, fill) => ({
  id,
  type: "frame",
  name: "Tela " + id,
  pageId: "page-1",
  x,
  y: 0,
  width: 360,
  height: 260,
  fill,
});
const rect = (id, parentId, x, y, width = 110) => ({
  id,
  type: "rectangle",
  name: id,
  parentId,
  pageId: "page-1",
  x,
  y,
  width,
  height: 45,
  fill: "#328BFF",
  radius: 8,
});
try {
  const p = await post("/api/projects", {
    document: {
      schemaVersion: 1,
      name: "Fluxo verificável",
      nodes: [
        frame("A", 0, "#FAFAFC"),
        frame("B", 440, "#FFEEDD"),
        frame("C", 880, "#CCEEFF"),
        rect("Avancar", "A", 25, 40),
        rect("Animar", "A", 25, 160),
        rect("orb", "A", 230, 100, 40),
        rect("Voltar", "C", 25, 40),
        rect("Abrir", "A", 180, 40, 50),
        rect("Sinal", "B", 210, 145, 50),
      ],
      animations: [
        {
          id: "delayed-fade",
          nodeId: "Sinal",
          duration: 350,
          easing: "linear",
          keyframes: [
            { time: 0, values: { opacity: 0 } },
            { time: 350, values: { opacity: 1 } },
          ],
        },
        {
          id: "move-orb",
          nodeId: "orb",
          duration: 450,
          easing: "linear",
          keyframes: [
            { time: 0, values: { x: 230 } },
            { time: 450, values: { x: 290 } },
          ],
        },
      ],
      interactions: [
        {
          id: "delay-animation",
          nodeId: "B",
          trigger: "after-delay",
          delay: 120,
          action: "animate",
          animationId: "delayed-fade",
          transition: "instant",
          duration: 0,
        },
        {
          id: "hover-overlay",
          nodeId: "Abrir",
          trigger: "hover",
          action: "overlay",
          targetId: "C",
          transition: "dissolve",
          duration: 80,
        },
        {
          id: "close-overlay",
          nodeId: "C",
          trigger: "key",
          key: "Escape",
          action: "close",
          transition: "instant",
          duration: 0,
        },
        {
          id: "keyboard",
          nodeId: "B",
          trigger: "key",
          key: "Enter",
          action: "navigate",
          targetId: "C",
          transition: "instant",
          duration: 0,
        },
        {
          id: "back",
          nodeId: "Voltar",
          trigger: "click",
          action: "back",
          transition: "instant",
          duration: 0,
        },
      ],
    },
  });
  const get = async () => (await fetch(base + `/api/projects/${p.id}`)).json();
  browser = await chromium.launch();
  const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.setDefaultTimeout(12000);
  await page.goto(`${base}/?project=${p.id}`);
  await page.locator('[data-select="Avancar"]').click();
  await page.getByRole("button", { name: "Protótipo", exact: true }).click();
  const handle = page.locator('[data-prototype-handle="Avancar"]'),
    target = page.locator('#scene [data-node-id="B"]');
  const a = await handle.boundingBox(),
    b = await target.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
  await page
    .getByRole("button", { name: "Salvar conexão", exact: true })
    .waitFor();
  let stored = await get();
  assert.ok(
    stored.document.interactions.some(
      (i) => i.nodeId === "Avancar" && i.targetId === "B",
    ),
  );
  await page
    .locator('#connection-form [name="transition"]')
    .selectOption("push");
  await page
    .getByRole("button", { name: "Salvar conexão", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector("#save-label").textContent === "Salvo no servidor",
  );
  await page.locator('[data-select="Animar"]').click();
  await page
    .locator('#connection-form [name="action"]')
    .selectOption("animate");
  await page
    .locator('#connection-form [name="animationId"]')
    .selectOption("move-orb");
  assert.equal(
    await page.locator('#connection-form [name="animationId"]').isVisible(),
    true,
  );
  assert.equal(
    await page.locator('#connection-form [name="targetId"]').isVisible(),
    false,
  );
  await page
    .getByRole("button", { name: "Criar conexão", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector("#save-label").textContent === "Salvo no servidor",
  );
  for (const [name, start] of [
    ["Principal", "A"],
    ["Atalho", "B"],
  ]) {
    await page
      .getByRole("button", { name: "+ Novo fluxo", exact: true })
      .click();
    await page.locator('dialog [name="name"]').fill(name);
    await page.locator('dialog [name="startFrameId"]').selectOption(start);
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await page
      .getByRole("button", { name: name + " ↗", exact: true })
      .waitFor();
  }
  await page.reload();
  await page.getByRole("button", { name: "Protótipo", exact: true }).click();
  await page
    .getByRole("button", { name: "Principal ↗", exact: true })
    .waitFor();
  await page.locator('[data-select="Animar"]').click();
  await page.waitForTimeout(250);
  const selection = await (
    await fetch(base + `/api/projects/${p.id}/selection`)
  ).json();
  assert.ok(selection.clients.some((c) => c.nodeIds.includes("Animar")));
  stored = await get();
  assert.equal(stored.document.flows.length, 2);
  const preview = await browser.newPage({
    viewport: { width: 1100, height: 800 },
  });
  preview.on("pageerror", (e) => errors.push(e.message));
  await preview.goto(`${base}/api/projects/${p.id}/prototype`);
  assert.equal(
    await preview.locator("#stage").getAttribute("data-active-frame"),
    "A",
  );
  assert.match(
    await preview.locator('[data-node-id="orb"]').getAttribute("transform"),
    /translate\(230 /,
  );
  await preview.locator('[data-node-id="Animar"]').click();
  await preview.waitForFunction(() =>
    document
      .querySelector('[data-node-id="orb"]')
      ?.getAttribute("transform")
      .includes("translate(290 "),
  );
  await preview.locator('[data-node-id="Avancar"]').click();
  await preview.waitForFunction(
    () => document.querySelector("#stage").dataset.activeFrame === "B",
  );
  await preview.waitForTimeout(300);
  await preview.keyboard.press("Enter");
  await preview.waitForFunction(
    () => document.querySelector("#stage").dataset.activeFrame === "C",
  );
  await preview.locator('[data-node-id="Voltar"]').click();
  assert.equal(
    await preview.locator("#stage").getAttribute("data-active-frame"),
    "B",
  );
  await preview.waitForFunction(
    () =>
      Number(
        document
          .querySelector('[data-node-id="Sinal"]')
          ?.getAttribute("opacity") ?? 1,
      ) < 0.8,
  );
  await preview.waitForFunction(
    () =>
      document
        .querySelector('[data-node-id="Sinal"]')
        ?.getAttribute("opacity") === "1",
  );
  await preview.getByRole("button", { name: "Reiniciar", exact: true }).click();
  assert.equal(
    await preview.locator("#stage").getAttribute("data-active-frame"),
    "A",
  );
  await preview
    .getByRole("combobox", { name: "Fluxo do protótipo" })
    .selectOption(stored.document.flows[1].id);
  assert.equal(
    await preview.locator("#stage").getAttribute("data-active-frame"),
    "B",
  );
  await preview.getByRole("button", { name: "Hotspots", exact: true }).click();
  assert.equal(
    await preview.locator("body").getAttribute("class"),
    "show-hotspots",
  );
  await preview
    .getByRole("combobox", { name: "Fluxo do protótipo" })
    .selectOption(stored.document.flows[0].id);
  const hoverBox = await preview
    .locator('[data-node-id="Abrir"]')
    .boundingBox();
  await preview.mouse.move(
    hoverBox.x + hoverBox.width / 2,
    hoverBox.y + hoverBox.height / 2,
  );
  await preview.waitForFunction(
    () => document.querySelector("#stage").dataset.overlay === "C",
  );
  await preview.keyboard.press("Escape");
  assert.equal(
    await preview.locator("#stage").getAttribute("data-overlay"),
    "",
  );
  const html = await (
    await fetch(base + `/api/projects/${p.id}/prototype`)
  ).text();
  const offline = await browser.newPage();
  offline.on("pageerror", (e) => errors.push(e.message));
  await offline.route("**/*", (route) => route.abort());
  await offline.setContent(html, { waitUntil: "load" });
  await offline.locator('[data-node-id="Animar"]').click();
  await offline.waitForFunction(() =>
    document
      .querySelector('[data-node-id="orb"]')
      ?.getAttribute("transform")
      .includes("translate(290 "),
  );
  await offline.locator('[data-node-id="Avancar"]').click();
  await offline.waitForFunction(
    () => document.querySelector("#stage").dataset.activeFrame === "B",
  );
  const protocol = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18" },
    },
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "get_selection", arguments: { projectId: p.id } },
    },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "get_node",
        arguments: { projectId: p.id, nodeId: "Animar" },
      },
    },
  ];
  const output = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["src/mcp/index.js"], {
      env: { ...process.env, IMHOTEP_URL: base },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "",
      err = "";
    child.stdout.on("data", (c) => (out += c));
    child.stderr.on("data", (c) => (err += c));
    child.on("error", reject);
    child.on("exit", (code) => (code ? reject(Error(err)) : resolve(out)));
    child.stdin.end(protocol.map((m) => JSON.stringify(m)).join("\n") + "\n");
  });
  const messages = output.trim().split("\n").map(JSON.parse);
  assert.ok(
    JSON.parse(
      messages.find((m) => m.id === 2).result.content[0].text,
    ).clients.some((c) => c.nodeIds.includes("Animar")),
  );
  assert.equal(
    JSON.parse(messages.find((m) => m.id === 3).result.content[0].text).node.id,
    "Animar",
  );
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/prototype-connections.png" });
  new Kendrick(app.store).save({
    id: "review-fixture",
    projectId: p.id,
    provider: "codex",
    prompt: "Alterar a cor do marcador",
    message: "Uma proposta para revisar.",
    status: "proposed",
    baseRevision: stored.revision,
    operations: [
      { type: "update_node", id: "orb", changes: { fill: "#FF0000" } },
    ],
  });
  await page.getByRole("button", { name: "Conversar com Kendrick" }).click();
  await page.locator('[data-session-diff="review-fixture"] summary').click();
  await page
    .locator(".diff-field ins")
    .filter({ hasText: "#FF0000" })
    .waitFor();
  assert.equal(await page.locator(".diff-field del").textContent(), "#328BFF");
  await page.screenshot({ path: "artifacts/kendrick-review.png" });
  await browser.close();
  browser = null;
  await app.close();
  app = await startServer({ port: 0, dataDir: dir, seed: false });
  base = `http://127.0.0.1:${app.port}`;
  const reopened = await get();
  assert.deepEqual(reopened.document.flows, stored.document.flows);
  assert.deepEqual(
    reopened.document.interactions,
    stored.document.interactions,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Flows verified: drag connectors, edit connections, multiple starting flows, click-triggered motion, keyboard navigation, back/restart, offline export, active selection over MCP and persistence after restart.",
  );
} finally {
  await browser?.close();
  await app.close();
  await rm(dir, { recursive: true, force: true });
}
