import { chromium } from "@playwright/test";
import { startServer } from "../src/server/index.js";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const dir = await mkdtemp(join(tmpdir(), "imhotep-persona-")),
  app = await startServer({ port: 0, dataDir: dir, seed: false });
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 938, height: 715 } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = `http://127.0.0.1:${app.port}`;
  const p = await (
    await fetch(base + "/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Expressões do Kendrick" }),
    })
  ).json();
  let sessions = [];
  await page.route("**/sessions", async (route) => {
    if (route.request().method() === "GET")
      await route.fulfill({ json: sessions });
    else await route.continue();
  });
  await page.clock.install();
  await page.goto(`${base}/?project=${p.id}`);
  const avatar = page.locator(".kendrick-launcher kendrick-avatar");
  await avatar.waitFor();
  await page.mouse.move(20, 80);
  await page.waitForTimeout(300);
  const left = await avatar.evaluate((el) => ({
    x: Number.parseFloat(
      el.shadowRoot.querySelector(".art").style.getPropertyValue("--gaze-x"),
    ),
    y: Number.parseFloat(
      el.shadowRoot.querySelector(".art").style.getPropertyValue("--gaze-y"),
    ),
    transform: getComputedStyle(el.shadowRoot.querySelector(".eye")).transform,
  }));
  assert.ok(
    left.x < 0 && left.y < 0,
    "Eyes must look toward the cursor above and to the left",
  );
  await page.mouse.move(920, 705);
  await page.waitForTimeout(300);
  const right = await avatar.evaluate((el) => ({
    x: Number.parseFloat(
      el.shadowRoot.querySelector(".art").style.getPropertyValue("--gaze-x"),
    ),
    y: Number.parseFloat(
      el.shadowRoot.querySelector(".art").style.getPropertyValue("--gaze-y"),
    ),
    transform: getComputedStyle(el.shadowRoot.querySelector(".eye")).transform,
  }));
  assert.ok(
    right.x > 0 && right.y > 0,
    "Eyes must look toward the cursor below and to the right",
  );
  assert.notEqual(left.transform, right.transform);
  await page.getByRole("button", { name: "Conversar com Kendrick" }).click();
  const welcomeVisible = await page
    .locator(".chat-welcome kendrick-avatar")
    .evaluate((el) => {
      const box = el.getBoundingClientRect();
      const viewport = el.closest(".chat-conversation").getBoundingClientRect();
      return box.top >= viewport.top && box.bottom <= viewport.bottom;
    });
  assert.ok(
    welcomeVisible,
    "Opening an empty conversation must show the whole avatar",
  );
  await page.waitForFunction(
    () =>
      document.querySelector(".kendrick-launcher kendrick-avatar")?.dataset
        .expression === "listening",
  );
  await page
    .getByRole("textbox", { name: "Mensagem para Kendrick" })
    .fill("Refine o espaçamento.");
  assert.equal(await avatar.getAttribute("mood"), "listening");
  const session = {
    id: "visual-fixture",
    prompt: "Teste visual",
    message: "Uma proposta para revisar.",
    baseRevision: 0,
    operations: [],
  };
  sessions = [{ ...session, status: "queued" }];
  await page.waitForFunction(
    () =>
      document.querySelector(".kendrick-launcher kendrick-avatar")?.dataset
        .expression === "working",
  );
  sessions = [{ ...session, status: "thinking" }];
  await page.waitForFunction(
    () =>
      document.querySelector(".kendrick-launcher kendrick-avatar")?.dataset
        .expression === "thinking",
  );
  sessions = [{ ...session, status: "proposed" }];
  await page.waitForFunction(
    () =>
      document.querySelector(".kendrick-launcher kendrick-avatar")?.dataset
        .expression === "attention",
  );
  sessions = [{ ...session, status: "applied" }];
  await page.waitForFunction(
    () =>
      document.querySelector(".kendrick-launcher kendrick-avatar")?.dataset
        .expression === "success",
  );
  await page
    .getByRole("button", { name: "Fechar conversa", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document
        .querySelector(".kendrick-launcher kendrick-avatar")
        ?.getAttribute("mood") === "idle",
  );
  await page.clock.fastForward(26000);
  assert.equal(await avatar.getAttribute("data-expression"), "offline");
  await page.mouse.move(360, 200);
  await page.waitForFunction(
    () =>
      document.querySelector(".kendrick-launcher kendrick-avatar")?.dataset
        .expression === "greeting",
  );
  await page.clock.resume();
  await page.evaluate(() => {
    const gallery = document.createElement("section");
    gallery.id = "persona-gallery";
    gallery.style.cssText =
      "position:fixed;inset:0;z-index:100;background:#202024;display:grid;grid-template-columns:repeat(4,1fr);gap:20px;padding:50px;align-content:center;color:#d9d7e2;font:12px Inter,sans-serif";
    const names = {
      idle: "Neutro",
      listening: "Curioso",
      greeting: "Piscando",
      working: "Focado",
      thinking: "Pensando",
      attention: "Surpreso",
      success: "Feliz",
      offline: "Descansando",
    };
    for (const [state, label] of Object.entries(names)) {
      const card = document.createElement("div");
      card.style.cssText =
        "display:flex;align-items:center;flex-direction:column;gap:14px;padding:12px";
      const avatar = document.createElement("kendrick-avatar");
      avatar.setAttribute("mood", state);
      avatar.style.cssText = "width:112px;height:112px";
      card.append(avatar, document.createTextNode(label));
      gallery.append(card);
    }
    document.body.append(gallery);
  });
  await page.waitForTimeout(1400);
  const poses = await page
    .locator("#persona-gallery kendrick-avatar")
    .evaluateAll((elements) =>
      elements.map((el) =>
        [...el.shadowRoot.querySelectorAll(".eye>svg")]
          .map((e) =>
            ["x", "y", "width", "height", "transform"]
              .map((a) => e.getAttribute(a))
              .join(","),
          )
          .join("|"),
      ),
    );
  assert.equal(
    new Set(poses).size,
    8,
    "All eight approved expressions must use different eye geometry",
  );
  for (const [state, minRatio] of [
    ["success", 2],
    ["offline", 4],
  ]) {
    const ratio = await page
      .locator(`#persona-gallery kendrick-avatar[mood=${state}]`)
      .evaluate((el) => {
        const eye = el.shadowRoot.querySelector(".eyelid");
        const box = eye.getBBox(),
          matrix = eye.getScreenCTM();
        return (
          (Math.hypot(matrix.a, matrix.b) * box.width) /
          (Math.hypot(matrix.c, matrix.d) * box.height)
        );
      });
    assert.ok(
      ratio > minRatio,
      `${state} eyes must render as wide lids, not dots`,
    );
  }
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/kendrick-expressions.png" });
  const reduced = await browser.newPage({
    viewport: { width: 938, height: 715 },
    reducedMotion: "reduce",
  });
  await reduced.goto(`${base}/?project=${p.id}`);
  await reduced.locator("kendrick-avatar").first().waitFor();
  await reduced.mouse.move(900, 20);
  await reduced.waitForTimeout(100);
  assert.equal(
    await reduced
      .locator(".kendrick-launcher kendrick-avatar")
      .evaluate((el) =>
        el.shadowRoot.querySelector(".art").style.getPropertyValue("--gaze-x"),
      ),
    "0px",
  );
  await reduced.close();
  assert.deepEqual(errors, []);
  console.log(
    "Persona verified at 938×715: cursor tracking, all eight original eye shapes, interaction/session expressions, rest/wake and reduced motion.",
  );
} finally {
  await browser?.close();
  await app.close();
  await rm(dir, { recursive: true, force: true });
}
