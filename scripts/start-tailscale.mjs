import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { startServer } from "../src/server/index.js";
try {
  const { stdout } = await promisify(execFile)(
    "tailscale",
    ["status", "--json"],
    { timeout: 10000, maxBuffer: 2_000_000 },
  );
  const status = JSON.parse(stdout);
  if (status.BackendState !== "Running")
    throw new Error("Conecte o Tailscale antes de iniciar o Imhotep.");
  const address = status.TailscaleIPs?.find((ip) => ip.startsWith("100."));
  if (!address) throw new Error("IPv4 Tailscale não disponível.");
  const app = await startServer({ tailscaleHost: address });
  console.log(`Imhotep na rede Tailscale: http://${address}:${app.port}`);
  console.log(`CLI/MCP locais: http://127.0.0.1:${app.port}`);
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, async () => {
      await app.close();
      process.exit(0);
    });
} catch (e) {
  console.error(`Não foi possível iniciar pelo Tailscale: ${e.message}`);
  process.exitCode = 1;
}
