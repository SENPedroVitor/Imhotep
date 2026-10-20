import { chromium } from "@playwright/test";
import { transform } from "esbuild";
import { startServer } from "../src/server/index.js";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { parsePath } from "../public/vector.js";
const dir = await mkdtemp(join(tmpdir(), "imhotep-design-")),
  app = await startServer({ port: 0, dataDir: dir, seed: false }),
  base = `http://127.0.0.1:${app.port}`;
let browser;
const post = async (path, body) => {
  const r = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  assert.ok(r.ok, JSON.stringify(data));
  return data;
};
const node = (id, type, parentId, x, y, width, height, extra = {}) => ({
  id,
  type,
  name: id,
  ...(parentId ? { parentId } : {}),
  pageId: "page-1",
  x,
  y,
  width,
  height,
  ...extra,
});
try {
  browser = await chromium.launch();
  const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.setDefaultTimeout(12000);
  const p = await post("/api/projects", {
    document: {
      schemaVersion: 1,
      name: "Geometria verificada",
      nodes: [
        node("frame", "frame", null, 0, 0, 640, 480, { fill: "#FAFAFC" }),
        node("a", "rectangle", "frame", 30, 40, 150, 100, { fill: "#328BFF" }),
        node("b", "rectangle", "frame", 100, 80, 150, 100, { fill: "#328BFF" }),
        node("curve", "path", "frame", 250, 240, 220, 120, {
          fill: "none",
          stroke: "#328BFF",
          strokeWidth: 3,
          pathData: "M0 110 C40 0 160 0 220 110",
        }),
      ],
    },
  });
  const get = async () => (await fetch(base + `/api/projects/${p.id}`)).json();
  await page.goto(`${base}/?project=${p.id}`);
  await page.locator('[data-select="a"]').click();
  await page.locator('[data-select="b"]').click({ modifiers: ["Shift"] });
  await page.getByRole("button", { name: "Subtrair", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector("#save-label").textContent === "Salvo no servidor",
  );
  let saved = await get();
  assert.equal(saved.document.nodes.length, 3);
  assert.ok(
    saved.document.nodes.some(
      (n) => n.name === "Subtração" && n.type === "path",
    ),
  );
  await page.keyboard.press("Control+z");
  await page.locator('[data-select="a"]').waitFor();
  assert.equal((await get()).document.nodes.length, 4);
  await page.locator('[data-select="curve"]').click();
  await page
    .getByRole("button", { name: "Editar nós e alças", exact: true })
    .click();
  const handle = page.getByRole("button", {
    name: "Alça de saída 1",
    exact: true,
  });
  await handle.waitFor();
  const before = (await get()).document.nodes.find(
    (n) => n.id === "curve",
  ).pathData;
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 40,
    box.y + box.height / 2 + 20,
    { steps: 6 },
  );
  await page.mouse.up();
  await page.waitForFunction(
    () =>
      document.querySelector("#save-label").textContent === "Salvo no servidor",
  );
  const after = (await get()).document.nodes.find(
    (n) => n.id === "curve",
  ).pathData;
  assert.notEqual(after, before);
  assert.ok(
    parsePath(after)[0].points[0].out.x >
      parsePath(before)[0].points[0].out.x + 15,
  );
  await page.getByRole("button", { name: "+ Inserir nó", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll('[data-handle="anchor"]').length === 3,
  );
  await page.reload();
  await page.locator('[data-select="curve"]').click();
  saved = await get();
  assert.equal(
    parsePath(saved.document.nodes.find((n) => n.id === "curve").pathData)[0]
      .points.length,
    3,
  );
  await page
    .getByRole("button", { name: "Editar nós e alças", exact: true })
    .click();
  const current = await get();
  await post(`/api/projects/${p.id}/operations`, {
    baseRevision: current.revision,
    author: "layout-check",
    operationId: "stretch-vector",
    operations: [
      {
        type: "update_node",
        id: "frame",
        changes: { layout: "vertical", padding: 20 },
      },
      {
        type: "update_node",
        id: "curve",
        changes: { constraints: { horizontal: "stretch", vertical: "top" } },
      },
    ],
  });
  await page.waitForFunction(() =>
    document
      .querySelector('#scene [data-node-id="curve"] path')
      ?.getAttribute("transform")
      ?.startsWith("scale(2.727"),
  );
  const alignment = await page
    .locator('#scene [data-node-id="curve"]')
    .evaluate((el) => {
      const shape = el.querySelector("path"),
        handle = el.querySelector('[data-segment="0"][data-handle="out"]'),
        box = handle.getBoundingClientRect();
      const point = new DOMPoint(
        Number(handle.getAttribute("cx")),
        Number(handle.getAttribute("cy")),
      ).matrixTransform(shape.getScreenCTM());
      return Math.hypot(
        point.x - box.x - box.width / 2,
        point.y - box.y - box.height / 2,
      );
    });
  assert.ok(
    alignment < 2,
    "Bézier controls must align with the scaled path inside auto layout",
  );
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/vector-handles.png" });
  const stretch = { horizontal: "stretch", vertical: "top" };
  const doc = {
    schemaVersion: 1,
    name: "Exportação responsiva",
    nodes: [
      node("home", "frame", null, 0, 0, 720, 800, {
        fill: "#202025",
        layout: "vertical",
        gap: 24,
        padding: 24,
        clip: true,
      }),
      node("title", "text", "home", 24, 24, 672, 42, {
        text: "Layout responsivo",
        fontSize: 28,
        fill: "#FFFFFF",
        semanticTag: "h1",
        constraints: stretch,
      }),
      node("copy", "text", "home", 24, 90, 672, 30, {
        text: "Conteúdo <seguro> {texto}",
        fontSize: 15,
        fill: "#D0D0DA",
        constraints: stretch,
      }),
      node("row", "frame", "home", 24, 144, 672, 100, {
        fill: "none",
        layout: "horizontal",
        gap: 16,
        padding: 0,
        wrap: true,
        constraints: stretch,
      }),
      ...[0, 1, 2].map((i) =>
        node("card" + i, "rectangle", "row", 0, 0, 200, 80, {
          fill: ["#328BFF", "#AA88EE", "#44BBAA"][i],
          radius: 12,
        }),
      ),
      node("continue", "frame", "home", 24, 268, 672, 56, {
        fill: "#328BFF",
        radius: 10,
        semanticTag: "button",
        constraints: stretch,
      }),
      node("label", "text", "continue", 18, 16, 500, 24, {
        text: "Continuar",
        fontSize: 16,
        fill: "#FFFFFF",
        constraints: stretch,
      }),
      node("next", "frame", null, 850, 0, 720, 800, { fill: "#234433" }),
      node("done", "text", "next", 24, 24, 672, 50, {
        text: "Tudo salvo.",
        fontSize: 28,
        fill: "#FFFFFF",
        semanticTag: "h1",
        constraints: stretch,
      }),
    ],
    interactions: [
      {
        id: "go",
        nodeId: "continue",
        trigger: "click",
        action: "navigate",
        targetId: "next",
        transition: "instant",
        duration: 0,
      },
    ],
  };
  const responsive = await post("/api/projects", { document: doc });
  for (const format of ["react", "tailwind"]) {
    const r = await fetch(
      `${base}/api/projects/${responsive.id}/code?format=${format}`,
    );
    assert.ok(r.ok);
    const code = await r.text();
    const built = await transform(code, { loader: "tsx", jsx: "automatic" });
    assert.ok(built.code.includes("function Design"));
    assert.ok(code.includes("<h1"));
    assert.ok(code.includes("<button"));
    assert.ok(!code.includes("return (<svg"));
    if (format === "tailwind") assert.ok(code.includes("flex flex-col"));
  }
  const html = await (
    await fetch(`${base}/api/projects/${responsive.id}/code?format=html`)
  ).text();
  assert.ok(
    html.includes("<h1 "),
    "HTML should include its native initial markup before JavaScript runs",
  );
  const staticPage = await browser.newPage({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 900 },
  });
  await staticPage.route("**/*", (route) => route.abort());
  await staticPage.setContent(html);
  await staticPage
    .getByRole("heading", { name: "Layout responsivo" })
    .waitFor();
  await staticPage.close();
  for (const width of [1000, 390]) {
    const exportPage = await browser.newPage({
      viewport: { width, height: 900 },
    });
    exportPage.on("pageerror", (e) => errors.push(e.message));
    await exportPage.route("**/*", (r) => r.abort());
    await exportPage.setContent(html);
    await exportPage.evaluate(() => document.fonts.ready);
    await exportPage
      .getByRole("heading", { name: "Layout responsivo" })
      .waitFor();
    assert.equal(
      await exportPage.locator('[data-node-id="copy"]').textContent(),
      "Conteúdo <seguro> {texto}",
    );
    const bounds = await exportPage
      .locator('[data-node-id="home"]')
      .boundingBox();
    assert.equal(Math.round(bounds.width), Math.min(720, width));
    const a = await exportPage.locator('[data-node-id="card0"]').boundingBox(),
      b = await exportPage.locator('[data-node-id="card1"]').boundingBox();
    assert.equal(Math.round(b.y - a.y), width < 720 ? 96 : 0);
    const button = await exportPage
      .getByRole("button", { name: "Continuar" })
      .boundingBox();
    assert.equal(Math.round(button.width), Math.min(720, width) - 48);
    assert.ok(
      (await exportPage.evaluate(() => document.documentElement.scrollWidth)) <=
        width,
    );
    await exportPage.screenshot({ path: `artifacts/responsive-${width}.png` });
    await exportPage.getByRole("button", { name: "Continuar" }).click();
    await exportPage.getByRole("heading", { name: "Tudo salvo." }).waitFor();
    await exportPage.close();
  }
  await page.goto(`${base}/?project=${responsive.id}`);
  await page.locator('[data-select="continue"]').click();
  await page
    .getByLabel("Constraint horizontal", { exact: true })
    .selectOption("right");
  await page.waitForFunction(
    () =>
      document.querySelector("#save-label").textContent === "Salvo no servidor",
  );
  assert.equal(
    (
      await (await fetch(base + `/api/projects/${responsive.id}`)).json()
    ).document.nodes.find((n) => n.id === "continue").constraints.horizontal,
    "right",
  );
  await page.getByRole("button", { name: "Dev", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "HTML responsivo", exact: true })
    .click();
  assert.ok((await downloadPromise).suggestedFilename().endsWith(".html"));
  assert.deepEqual(errors, []);
  console.log(
    "Design verified: boolean UI + undo, draggable Bézier handles, subdivision and reload, responsive native HTML at 1000/390px with flex wrapping and constraints, offline interaction, compiled React/Tailwind TSX and UI download.",
  );
} finally {
  await browser?.close();
  await app.close();
  await rm(dir, { recursive: true, force: true });
}
