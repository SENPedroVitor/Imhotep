import { request as httpRequest } from "node:http";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { startServer } from "../src/server/index.js";
test("API → SSE → persisted document, headless PNG, CLI and MCP", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "imhotep-api-"));
  let app = await startServer({ port: 0, dataDir: dir, seed: false });
  const base = () => `http://127.0.0.1:${app.port}`;
  t.after(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const post = (path, data, headers = {}) =>
    fetch(`${base()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(data),
    });
  const response = await post("/api/projects", { name: "API Test" });
  assert.equal(response.status, 201);
  const p = await response.json();
  const stream = await fetch(`${base()}/api/projects/${p.id}/events`);
  const reader = stream.body.getReader();
  await reader.read();
  const operation = {
    baseRevision: 0,
    operationId: "api-op",
    author: "codex",
    operations: [
      {
        type: "update_node",
        id: p.document.nodes[0].id,
        changes: { fill: "#328BFF" },
      },
    ],
  };
  assert.equal(
    (await post(`/api/projects/${p.id}/operations`, operation)).status,
    200,
  );
  const event = await reader.read();
  assert.match(new TextDecoder().decode(event.value), /"author":"codex"/);
  await reader.cancel();
  assert.equal(
    (
      await post(`/api/projects/${p.id}/operations`, {
        ...operation,
        operationId: "stale",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await post(
        "/api/projects",
        { name: "Blocked" },
        { Origin: "https://attacker.example" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(`${base()}/api/projects`, {
        method: "POST",
        body: '{"name":"Blocked"}',
      })
    ).status,
    415,
  );
  const image = await fetch(`${base()}/api/projects/${p.id}/render?format=png`);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/png");
  assert.equal(
    Buffer.from(await image.arrayBuffer())
      .subarray(1, 4)
      .toString(),
    "PNG",
  );
  function run(file, args = [], stdin = "") {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [file, ...args], {
        env: { ...process.env, IMHOTEP_URL: base() },
        stdio: ["pipe", "pipe", "pipe"],
      });
      let output = "",
        error = "";
      child.stdout.on("data", (c) => (output += c));
      child.stderr.on("data", (c) => (error += c));
      child.on("error", reject);
      child.on("close", (code) =>
        code === 0 ? resolve(output) : reject(new Error(error)),
      );
      child.stdin.end(stdin);
    });
  }
  const cli = JSON.parse(await run("src/cli/index.js", ["inspect", p.id]));
  assert.equal(cli.revision, 1);
  const mcp = (
    await run(
      "src/mcp/index.js",
      [],
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18" },
      }) +
        "\n" +
        JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "get_document_tree", arguments: { projectId: p.id } },
        }) +
        "\n",
    )
  )
    .trim()
    .split("\n")
    .map(JSON.parse);
  assert.equal(mcp[0].result.serverInfo.name, "imhotep");
  assert.equal(JSON.parse(mcp[1].result.content[0].text).revision, 1);
  await app.close();
  app = await startServer({ port: 0, dataDir: dir, seed: false });
  const reopened = await (await fetch(`${base()}/api/projects/${p.id}`)).json();
  assert.equal(reopened.revision, 1);
  assert.equal(reopened.document.nodes[0].fill, "#328BFF");
});

test("HTTPS proxy origin is explicitly allowed; foreign origins and forwarded-host bypasses are refused", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "imhotep-tail-"));
  const origin = "https://studio.test.ts.net:9443";
  const app = await startServer({
    port: 0,
    dataDir: dir,
    seed: false,
    publicOrigin: origin,
  });
  t.after(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const url = `http://127.0.0.1:${app.port}/api/projects`;
  const raw = (headers, method = "GET") =>
    new Promise((resolve, reject) => {
      const req = httpRequest(url, { method, headers }, (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      });
      req.on("error", reject);
      req.end(
        method === "POST"
          ? JSON.stringify({ name: "Via Tailscale" })
          : undefined,
      );
    });
  const post = (host, source) =>
    raw(
      { Host: host, Origin: source, "Content-Type": "application/json" },
      "POST",
    );
  assert.equal(await post("studio.test.ts.net:9443", origin), 201);
  assert.equal(
    await post("studio.test.ts.net:9443", "https://evil.example"),
    403,
  );
  assert.equal(await post("evil.example", origin), 403);
  assert.equal(
    await raw({
      Host: "evil.example",
      "X-Forwarded-Host": "studio.test.ts.net:9443",
    }),
    403,
  );
});
