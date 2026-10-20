import { chromium } from "@playwright/test";
import { startServer } from "../src/server/index.js";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const dir = await mkdtemp(join(tmpdir(), "imhotep-interface-"));
const app = await startServer({ port: 0, dataDir: dir });
let browser;
try {
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: "artifacts/interface-video",
      size: { width: 1440, height: 900 },
    },
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.setDefaultTimeout(10000);
  const base = `http://127.0.0.1:${app.port}`;
  await page.goto(base);
  await page.locator(".project-card").first().click();
  await page.locator(".canvas-dock .kendrick-launcher").waitFor();
  await page.getByRole("button", { name: "Dev", exact: true }).click();
  assert.ok(
    await page
      .locator("#inspector")
      .evaluate((el) =>
        el
          .getAnimations({ subtree: true })
          .some((a) => a.playState === "running"),
      ),
    "Mode changes must animate their contents",
  );
  await page.getByRole("button", { name: "Design", exact: true }).click();
  const launch = page.getByRole("button", { name: "Conversar com Kendrick" }),
    tool = page.locator(".toolbar");
  const a = await launch.boundingBox(),
    b = await tool.boundingBox();
  assert.ok(Math.abs(a.x - b.x) < 2);
  assert.ok(a.y + a.height <= b.y);
  const avatar = page.locator(".kendrick-launcher kendrick-avatar");
  const first = await avatar.evaluate(
    (el) =>
      getComputedStyle(el.shadowRoot.querySelector(".breathing")).transform,
  );
  await page.waitForTimeout(450);
  const next = await avatar.evaluate(
    (el) =>
      getComputedStyle(el.shadowRoot.querySelector(".breathing")).transform,
  );
  assert.notEqual(
    first,
    next,
    "Breathing must change the actual SVG transform",
  );
  const blinked = await avatar.evaluate(
    (el) =>
      new Promise((resolve) => {
        const start = performance.now();
        const sample = () => {
          if (
            [...el.shadowRoot.querySelectorAll(".eyelid")].some(
              (eye) => eye.getAnimations().length > 0,
            )
          )
            resolve(true);
          else if (performance.now() - start > 5000) resolve(false);
          else requestAnimationFrame(sample);
        };
        sample();
      }),
  );
  assert.ok(blinked, "Natural blinking must occur without interaction");
  await launch.click();
  await page.locator("#kendrick-popover").waitFor();
  assert.equal(
    await page
      .locator("#inspector .inspector-title")
      .textContent()
      .then((s) => s.trim().startsWith("Design")),
    true,
  );
  await page
    .getByRole("textbox", { name: "Mensagem para Kendrick" })
    .fill("Este rascunho deve permanecer.");
  await page
    .getByRole("button", { name: "Fechar conversa", exact: true })
    .click();
  await launch.click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Mensagem para Kendrick" })
      .inputValue(),
    "Este rascunho deve permanecer.",
  );
  await page.locator(".layer-row").first().click();
  assert.equal(
    await page.locator("#kendrick-popover .chat-context-label").textContent(),
    await page.locator(".layer-row").first().textContent(),
  );
  await mkdir("artifacts", { recursive: true });
  await page.waitForTimeout(230);
  await page.screenshot({ path: "artifacts/kendrick-dock.png" });
  await page
    .getByRole("button", { name: "Fechar conversa", exact: true })
    .click();
  await page.keyboard.press("Control+k");
  await page.locator("#kendrick-popover").waitFor();
  await page.keyboard.press("Escape");
  await page.locator("#kendrick-popover").waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Voltar aos canvases" }).click();
  await page.getByRole("button", { name: "Novo canvas", exact: true }).click();
  await page.locator("dialog .dialog-heading").waitFor();
  await page.getByRole("button", { name: "Mobile", exact: false }).click();
  assert.equal(await page.locator("dialog [name=width]").inputValue(), "390");
  assert.equal(await page.locator("dialog [name=height]").inputValue(), "844");
  await page
    .getByRole("textbox", { name: "Nome do canvas" })
    .fill("Meu canvas mobile");
  await page.waitForTimeout(230);
  await page.screenshot({ path: "artifacts/canvas-dialog.png" });
  await page.getByRole("button", { name: "Criar canvas", exact: true }).click();
  await page.locator("#scene [data-node-id]").first().waitFor();
  const projectId = await page.evaluate(() =>
    new URLSearchParams(location.search).get("project"),
  );
  const p = await (await fetch(`${base}/api/projects/${projectId}`)).json();
  assert.equal(p.document.nodes[0].width, 390);
  assert.equal(p.document.nodes[0].height, 844);
  const reduced = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  await reduced.goto(`${base}/?project=${projectId}`);
  await reduced.locator("kendrick-avatar").first().waitFor();
  const running = await reduced
    .locator("kendrick-avatar")
    .first()
    .evaluate(
      (el) =>
        el.shadowRoot
          .querySelector(".breathing")
          .getAnimations()
          .filter((a) => a.playState === "running").length,
    );
  assert.equal(running, 0);
  await reduced.close();
  assert.deepEqual(errors, []);
  console.log(
    "Interface verified: dock position, real breathing, natural blinking, draft retention, selection context, shortcut, modal and working presets, reduced motion.",
  );
  await context.close();
} finally {
  await browser?.close();
  await app.close();
  await rm(dir, { recursive: true, force: true });
}
