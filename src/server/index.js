import { outlineFonts } from "../core/fonts.js";
import { Backups } from "../core/backups.js";
import { Kendrick } from "../agents/kendrick.js";
import { workspaceRoutes } from "./workspace.js";
import { Presence } from "./presence.js";
import { wendlerStatus } from "./wendler.js";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import sharp from "sharp";
import { Store } from "../core/store.js";
import { AppError, assert } from "../core/document.js";
import { renderSvg } from "../../public/renderer.js";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export async function startServer({
  port = Number(process.env.PORT || 4173),
  dataDir,
  tailscaleHost,
  backupDir = process.env.IMHOTEP_BACKUP_DIR,
  seed = true,
  publicOrigin = process.env.IMHOTEP_PUBLIC_ORIGIN || "",
} = {}) {
  if (tailscaleHost) {
    const parts = tailscaleHost.split(".").map(Number);
    assert(
      parts.length === 4 &&
        parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) &&
        parts[0] === 100 &&
        parts[1] >= 64 &&
        parts[1] <= 127,
      "Endereço Tailscale IPv4 inválido",
    );
  }
  let externalOrigin;
  if (publicOrigin) {
    let parsed;
    try {
      parsed = new URL(publicOrigin);
    } catch {
      throw new AppError("IMHOTEP_PUBLIC_ORIGIN inválida");
    }
    assert(
      parsed.protocol === "https:" &&
        !parsed.username &&
        !parsed.password &&
        parsed.pathname === "/" &&
        !parsed.search &&
        !parsed.hash,
      "A origem pública deve ser uma origem HTTPS sem caminho",
    );
    externalOrigin = parsed.origin;
  }
  const store = new Store(dataDir);
  if (seed && store.list().length === 0)
    store.create(
      null,
      JSON.parse(await readFile(resolve(root, "examples/orbit.json"), "utf8")),
    );
  const kendrick = new Kendrick(store);
  const backups = new Backups(
    store,
    backupDir || resolve(store.directory, "..", "backups"),
  );
  const backupTimer = setInterval(
    () =>
      backups
        .create()
        .catch((e) => console.error("Falha no backup:", e.message)),
    6 * 60 * 60 * 1000,
  );
  backupTimer.unref();
  const clients = new Map();
  const presence = new Presence();
  const broadcast = (event) => {
    for (const res of clients.get(event.projectId) ?? [])
      res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  const server = createServer(async (req, res) => {
    const send = (status, data, type = "application/json") => {
      res.writeHead(status, {
        "Content-Type": type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(type === "application/json" ? JSON.stringify(data) : data);
    };
    try {
      const allowedOrigins = [
        `http://127.0.0.1:${server.address().port}`,
        `http://localhost:${server.address().port}`,
        ...(externalOrigin ? [externalOrigin] : []),
        ...(tailscaleHost
          ? [`http://${tailscaleHost}:${server.address().port}`]
          : []),
      ];
      assert(
        allowedOrigins.some(
          (origin) => new URL(origin).host === req.headers.host,
        ),
        "Host não autorizado",
        403,
      );
      const url = new URL(req.url, "http://localhost");
      if (req.headers.origin)
        assert(
          allowedOrigins.includes(req.headers.origin),
          "Origem não autorizada",
          403,
        );
      if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method))
        assert(
          req.headers["content-type"]?.split(";")[0] === "application/json",
          "Use application/json",
          415,
        );
      async function body() {
        let chunks = [],
          length = 0;
        for await (const chunk of req) {
          length += chunk.length;
          assert(length <= 2_000_000, "Pedido excede 2 MB", 413);
          chunks.push(chunk);
        }
        try {
          const value = JSON.parse(Buffer.concat(chunks).toString());
          assert(
            value && typeof value === "object" && !Array.isArray(value),
            "Objeto JSON obrigatório",
          );
          return value;
        } catch (e) {
          throw new AppError(
            e instanceof AppError ? e.message : "JSON inválido",
          );
        }
      }
      if (url.pathname === "/api/backups") {
        if (req.method === "GET") return send(200, await backups.list());
        if (req.method === "POST") return send(201, await backups.create());
      }
      if (url.pathname === "/api/integrations/wendler" && req.method === "GET")
        return send(200, await wendlerStatus(store.directory));
      const selection = url.pathname.match(
        /^\/api\/projects\/([\w-]+)\/selection$/,
      );
      if (selection) {
        const project = store.get(selection[1]);
        if (req.method === "GET")
          return send(200, { clients: presence.list(project) });
        if (req.method === "POST")
          return send(200, presence.update(project, await body()));
      }
      if (url.pathname.startsWith("/api/backups/") && req.method === "GET")
        return send(
          200,
          await backups.read(url.pathname.slice(13)),
          "application/octet-stream",
        );
      if (
        await workspaceRoutes({
          url,
          req,
          send,
          body,
          store,
          kendrick,
          broadcast,
        })
      )
        return;
      if (url.pathname === "/api/health" && req.method === "GET")
        return send(200, { status: "ok", schemaVersion: 1 });
      if (url.pathname === "/api/projects") {
        if (req.method === "GET") return send(200, store.list());
        if (req.method === "POST") {
          const b = await body();
          return send(201, store.create(b.name, b.document));
        }
      }
      const match = url.pathname.match(
        /^\/api\/projects\/([\w-]+)(?:\/(operations|history|restore|events|render))?$/,
      );
      if (match) {
        const [, projectId, action] = match;
        if (!action && req.method === "GET")
          return send(200, store.get(projectId));
        if (action === "history" && req.method === "GET")
          return send(200, store.history(projectId));
        if (
          ["operations", "restore"].includes(action) &&
          req.method === "POST"
        ) {
          const b = await body();
          if (action === "operations")
            assert(
              b.operations !== undefined && b.restoreRevision === undefined,
              "Lote de operações obrigatório",
            );
          else
            assert(
              b.restoreRevision !== undefined && b.operations === undefined,
              "Revisão de restauração obrigatória",
            );
          const event = store.mutate(projectId, b);
          if (!event.replayed) broadcast(event);
          return send(200, event);
        }
        if (action === "render" && req.method === "GET") {
          const project = store.get(projectId),
            frameId = url.searchParams.get("frame") || undefined;
          if (frameId)
            assert(
              project.document.nodes.some(
                (n) => n.id === frameId && n.type === "frame",
              ),
              "Frame não encontrado",
              404,
            );
          const svg = renderSvg(outlineFonts(project.document), frameId),
            format = url.searchParams.get("format") ?? "svg";
          assert(["svg", "png"].includes(format), "Formato não suportado");
          if (format === "png") {
            const image = await sharp(Buffer.from(svg), {
              limitInputPixels: 16_000_000,
            })
              .png()
              .toBuffer();
            return send(200, image, "image/png");
          }
          return send(200, svg, "image/svg+xml");
        }
        if (action === "events" && req.method === "GET") {
          store.get(projectId);
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          });
          const group = clients.get(projectId) ?? new Set();
          group.add(res);
          clients.set(projectId, group);
          res.write("event: ready\ndata: {}\n\n");
          const timer = setInterval(() => res.write(": heartbeat\n\n"), 15000);
          req.on("close", () => {
            clearInterval(timer);
            group.delete(res);
            if (!group.size) clients.delete(projectId);
          });
          return;
        }
      }
      if (req.method === "GET") {
        const files = {
          "/": "index.html",
          "/app.js": "app.js",
          "/style.css": "style.css",
          "/interface.css": "interface.css",
          "/renderer.js": "renderer.js",
          "/icons.js": "icons.js",
          "/workbench.js": "workbench.js",
          "/interface.js": "interface.js",
          "/kendrick-art.js": "kendrick-art.js",
          "/motion.js": "motion.js",
          "/kendrick.svg": "kendrick.svg",
        };
        const expression = url.pathname.match(
          /^\/kendrick\/(idle|success|listening|thinking|attention|greeting|working|offline)\.svg$/,
        );
        const font = url.pathname.match(
          /^\/fonts\/(Inter|Manrope|JetBrainsMono)\.woff2$/,
        );
        const file =
          files[url.pathname] ||
          (font ? `fonts/${font[1]}.woff2` : undefined) ||
          (expression ? `kendrick/${expression[1]}.svg` : undefined);
        assert(file, "Rota não encontrada", 404);
        const type = file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : file.endsWith(".woff2")
              ? "font/woff2"
              : file.endsWith(".svg")
                ? "image/svg+xml"
                : "text/html";
        res.setHeader(
          "Content-Security-Policy",
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        );
        return send(200, await readFile(resolve(root, "public", file)), type);
      }
      throw new AppError("Rota não encontrada", 404);
    } catch (e) {
      if (!res.headersSent)
        send(e.status || 500, {
          error: e.status ? e.message : "Erro interno do servidor",
        });
      else res.end();
      if (!e.status) console.error(e);
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  let tailServer;
  if (tailscaleHost) {
    tailServer = createServer(server.listeners("request")[0]);
    try {
      await new Promise((resolve, reject) => {
        tailServer.once("error", reject);
        tailServer.listen(server.address().port, tailscaleHost, resolve);
      });
    } catch (e) {
      await new Promise((resolve) => server.close(resolve));
      store.close();
      throw e;
    }
  }
  return {
    server,
    store,
    port: server.address().port,
    close: async () => {
      clearInterval(backupTimer);
      await backups.close();
      await kendrick.close();
      for (const group of clients.values()) for (const res of group) res.end();
      await Promise.all(
        [server, tailServer]
          .filter(Boolean)
          .map((listener) => new Promise((r) => listener.close(r))),
      );
      store.close();
    },
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const app = await startServer();
  console.log(`Imhotep disponível em http://127.0.0.1:${app.port}`);
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, async () => {
      await app.close();
      process.exit(0);
    });
}
