import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const runtime = resolve(option("--runtime", "/home/faux/wendler-runtime"));
const apiUrl = option("--api", "http://127.0.0.1:5274");
const imhotepUrl = option("--imhotep", "http://127.0.0.1:4173");
const uiUrl = option(
  "--ui",
  "https://faux-poweredge-t110-ii.tail212b91.ts.net/",
);
const dataDir = resolve(option("--data", join(root, "data")));
for (const value of [apiUrl, imhotepUrl]) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error(
      "Use uma origem HTTP local, sem credenciais, para as APIs.",
    );
}
if (new URL(uiUrl).protocol !== "https:")
  throw new Error("Use HTTPS para a interface do Wendler.");
async function request(path, body) {
  const response = await fetch(new URL(path, apiUrl), {
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
    signal: AbortSignal.timeout(65000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || `Wendler: HTTP ${response.status}`);
  return result;
}
const health = await fetch(new URL("/api/health", imhotepUrl), {
  signal: AbortSignal.timeout(5000),
});
if (!health.ok || (await health.json()).status !== "ok")
  throw new Error("Inicie o Imhotep antes de conectar.");
if (!(await request("/api/health")).ok)
  throw new Error("Wendler indisponível.");

// /data is the runtime's persistent host-mounted directory, also across rebuilds.
const destination = join(runtime, "data/integrations/imhotep");
await mkdir(join(destination, "src/mcp"), { recursive: true });
await mkdir(join(destination, "src/cli"), { recursive: true });
for (const path of ["src/mcp/index.js", "src/cli/client.js"])
  await writeFile(join(destination, path), await readFile(join(root, path)));
await writeFile(
  join(destination, "package.json"),
  '{"type":"module","private":true}\n',
);
await writeFile(
  join(destination, "entry.mjs"),
  `process.env.IMHOTEP_URL=${JSON.stringify(imhotepUrl)};\nawait import('./src/mcp/index.js');\n`,
);
const connection = {
  name: "imhotep",
  transport: "stdio",
  command: "node",
  args: ["/data/integrations/imhotep/entry.mjs"],
  enabled: true,
};
const inventory = await request("/api/plugins");
const existing = inventory.connections.find((c) => c.name === connection.name);
if (!existing) await request("/api/plugins/connections", connection);
else {
  if (
    existing.transport !== "stdio" ||
    existing.command !== "node" ||
    existing.argsCount !== 1
  )
    throw new Error(
      "Já existe uma integração imhotep diferente. Preserve-a e escolha outro nome.",
    );
  if (!existing.enabled) {
    const response = await fetch(
      new URL("/api/plugins/connections/imhotep", apiUrl),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      },
    );
    if (!response.ok)
      throw new Error("Não foi possível ativar a integração existente.");
  }
}
const tested = await request("/api/plugins/connections/imhotep/test", {});
const names = (tested.tools || []).map((t) => t.name);
for (const name of [
  "list_projects",
  "get_document_tree",
  "get_selection",
  "render_frame",
  "apply_patch",
  "export_code",
])
  if (!names.some((n) => n === name || n.endsWith(`__${name}`)))
    throw new Error(`O Codex do Wendler não descobriu ${name}.`);
if (tested.error) throw new Error(tested.error);
await mkdir(dataDir, { recursive: true });
const target = join(dataDir, "wendler-link.json"),
  temp = `${target}.${randomUUID()}.tmp`;
await writeFile(
  temp,
  JSON.stringify(
    {
      version: 1,
      apiUrl,
      uiUrl,
      connection: connection.name,
      installedAt: new Date().toISOString(),
      verifiedTools: names,
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
await rename(temp, target);
console.log(
  JSON.stringify(
    { connected: true, connection: connection.name, tools: names, uiUrl },
    null,
    2,
  ),
);
