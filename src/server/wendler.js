import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function wendlerStatus(directory) {
  let link;
  try {
    link = JSON.parse(
      await readFile(join(directory, "wendler-link.json"), "utf8"),
    );
  } catch (e) {
    if (e.code === "ENOENT") return { configured: false, online: false };
    throw e;
  }
  // This file is written only by the local installer. Never fetch a browser-supplied URL.
  const url = new URL(link.apiUrl);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.protocol !== "http:"
  )
    throw new Error("O Wendler deve usar a API local");
  let online = false,
    executorReady = false;
  try {
    const response = await fetch(new URL("/api/health", url), {
      signal: AbortSignal.timeout(2500),
    });
    online = response.ok && (await response.json()).ok === true;
    if (online) {
      const status = await fetch(new URL("/api/status", url), {
        signal: AbortSignal.timeout(2500),
      });
      executorReady = status.ok && (await status.json()).ready === true;
    }
  } catch {}
  return {
    configured: true,
    online,
    executorReady,
    name: "Wendler",
    connection: link.connection,
    uiUrl: link.uiUrl,
    installedAt: link.installedAt,
    verifiedTools: link.verifiedTools || [],
  };
}
