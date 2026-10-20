// Real provider call. Uses only the saved demo project; never edits an existing user project.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const base = process.env.IMHOTEP_URL || "http://127.0.0.1:4173";
const wendler = process.env.WENDLER_URL || "http://127.0.0.1:5274";
const data = resolve(process.env.IMHOTEP_DATA_DIR || "./data");
async function api(path, body) {
  const response = await fetch(
    base + path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result = await response.json();
  if (!response.ok) throw Error(result.error);
  return result;
}
const link = await api("/api/integrations/wendler");
assert.ok(
  link.configured && link.online,
  "Cadastre o Imhotep no Wendler antes deste teste.",
);
let saved;
try {
  saved = JSON.parse(
    await readFile(resolve(data, "wendler-demo.json"), "utf8"),
  );
} catch {}
let project = saved?.projectId
  ? await api("/api/projects/" + saved.projectId).catch(() => null)
  : null;
if (!project) {
  const document = JSON.parse(
    await readFile(
      new URL("../examples/connected-flow.json", import.meta.url),
      "utf8",
    ),
  );
  project = await api("/api/projects", { document });
  await writeFile(
    resolve(data, "wendler-demo.json"),
    JSON.stringify({ projectId: project.id }),
  );
}
assert.ok(
  project.document.nodes.some((n) => n.id === "integration-badge"),
  "O projeto de demonstração mudou; confira antes de repetir.",
);
const browser = await chromium.launch();
const requestId = randomUUID();
let completed = false;
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `${process.env.IMHOTEP_BROWSER_URL || base}/?project=${project.id}`,
  );
  await page.locator('[data-select="integration-badge"]').click();
  await page.waitForTimeout(250);
  const operationId = "wendler-check-" + randomUUID();
  const response = await fetch(wendler + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(180000),
    body: JSON.stringify({
      requestId,
      conversationId: "imhotep-check-" + randomUUID(),
      privateHistory: true,
      agent: { id: "kyle", name: "Kyle Rayner", role: "Design" },
      mode: "chat",
      permissions: { files: false, computer: false },
      context: [],
      sharedContext: [],
      message: `Verifique a integração autorizada do Imhotep com o Wendler. Use as ferramentas MCP imhotep neste projeto de demonstração: ${project.id}. Consulte get_document_tree e get_selection, renderize o frame welcome em PNG com render_frame e altere SOMENTE o nó integration-badge: text deve ficar "Conectado ao Wendler". Use apply_patch com a revisão atual, author "wendler:kyle", operationId "${operationId}" e uma única operação update_node. Confira o texto salvo com get_node. Esta edição do projeto de demonstração está autorizada. Não delegue, não abra outros projetos e não use outros serviços. Responda brevemente ao terminar.`,
    }),
  });
  if (!response.ok) throw Error(await response.text());
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    done;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      if (event.type === "error") throw Error(event.message);
      if (event.type === "approval")
        throw Error(
          "O Wendler solicitou uma aprovação adicional; o teste foi interrompido sem concedê-la.",
        );
      if (event.type === "activity") console.log("Wendler: " + event.text);
      if (event.type === "done") done = event;
    }
  }
  assert.equal(done?.status, "completed", JSON.stringify(done));
  completed = true;
  await page.waitForFunction(
    () =>
      document.querySelector('#scene [data-node-id="integration-badge"]')
        ?.textContent === "Conectado ao Wendler",
    null,
    { timeout: 15000 },
  );
  const history = await api(`/api/projects/${project.id}/history`);
  assert.ok(
    history.some(
      (h) => h.operationId === operationId && h.author === "wendler:kyle",
    ),
    "Falta a operação real do agente no histórico",
  );
  const result = await api(`/api/projects/${project.id}`);
  assert.equal(
    result.document.nodes.find((n) => n.id === "integration-badge").text,
    "Conectado ao Wendler",
  );
  await page.getByRole("button", { name: "Wendler", exact: true }).click();
  await page.getByRole("heading", { name: "Conectado", exact: true }).waitFor();
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/wendler-connected.png" });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      verified: true,
      projectId: project.id,
      revision: result.revision,
      author: "wendler:kyle",
      editor: `${process.env.IMHOTEP_BROWSER_URL || base}/?project=${project.id}`,
      prototype: `${process.env.IMHOTEP_BROWSER_URL || base}/api/projects/${project.id}/prototype`,
    }),
  );
} finally {
  if (!completed)
    await fetch(wendler + "/api/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    }).catch(() => {});
  await browser.close();
}
