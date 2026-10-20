import { outlineFonts } from "../core/fonts.js";
import * as renderer from "../../public/renderer.js";
import { icons } from "../../public/icons.js";
import { renderSvg, escapeXml } from "../../public/renderer.js";
import { evaluateMotion, ease } from "../../public/motion.js";
import { mountPrototype } from "../../public/prototype.js";
export async function workspaceRoutes({
  url,
  req,
  send,
  body,
  store,
  kendrick,
  broadcast,
}) {
  if (url.pathname === "/api/agents/providers" && req.method === "GET") {
    send(200, await kendrick.providers());
    return true;
  }
  const match = url.pathname.match(
    /^\/api\/projects\/([\w-]+)\/(sessions|code|prototype)(?:\/([\w-]+)\/(apply|cancel|diff))?$/,
  );
  if (!match) return false;
  const [, projectId, action, sessionId, command] = match;
  const project = store.get(projectId);
  if (action === "sessions") {
    if (req.method === "GET" && command === "diff") {
      send(200, kendrick.diff(projectId, sessionId));
      return true;
    }
    if (req.method === "GET" && !sessionId) {
      send(200, kendrick.list(projectId));
      return true;
    }
    if (req.method === "POST" && !sessionId) {
      send(202, await kendrick.start(projectId, await body()));
      return true;
    }
    if (req.method === "POST" && command === "apply") {
      const { session, event } = kendrick.apply(projectId, sessionId);
      if (event && !event.replayed) broadcast(event);
      send(200, session);
      return true;
    }
    if (req.method === "POST" && command === "cancel") {
      send(200, kendrick.cancel(projectId, sessionId));
      return true;
    }
  }
  if (req.method === "GET" && (action === "code" || action === "prototype")) {
    const doc = outlineFonts(project.document);
    doc.flows ??= [];
    const format = url.searchParams.get("format") || "html";
    if (action === "code" && format === "react") {
      const svg = renderSvg(doc)
        .replace(/class=/g, "className=")
        .replace(/stroke-width=/g, "strokeWidth=")
        .replace(/font-family=/g, "fontFamily=")
        .replace(/font-size=/g, "fontSize=")
        .replace(/font-weight=/g, "fontWeight=")
        .replace(/stroke-linecap=/g, "strokeLinecap=")
        .replace(/stroke-linejoin=/g, "strokeLinejoin=")
        .replace(/xml:space=/g, "xmlSpace=")
        .replace(/xmlns=/g, "xmlns=");
      send(
        200,
        `// Visual estático SVG; interações e motion são exportados em HTML.\nexport default function Design(){return (${svg.replace(/\{/g, "&#123;").replace(/\}/g, "&#125;")});}\n`,
        "text/plain",
      );
      return true;
    }
    const safe = JSON.stringify(doc).replace(/</g, "\\u003c");
    const configuration = JSON.stringify({
      flowId: url.searchParams.get("flow"),
      initialFrame: url.searchParams.get("frame"),
    }).replace(/</g, "\\u003c");
    const runtime = `const icons=${JSON.stringify(icons)};${Object.entries(
      renderer,
    )
      .filter(([, value]) => typeof value === "function")
      .map(([name, value]) => `const ${name}=${value.toString()};`)
      .join("")}
      const ease=${ease.toString()};const evaluateMotion=${evaluateMotion.toString()};
      const mountPrototype=${mountPrototype.toString()};const doc=${safe};
      mountPrototype(doc,{stage:document.querySelector('#stage'),renderSvg,evaluateMotion,...${configuration}});`;
    // The same trusted runtime can be requested independently or embedded for offline exports.
    if (url.searchParams.get("runtime") === "1") {
      send(200, runtime, "text/javascript");
      return true;
    }
    send(
      200,
      `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeXml(doc.name)}</title><style>body{margin:0;background:#19191c;color:white;font:13px system-ui}header{padding:12px;display:flex;gap:12px;align-items:center}header span{margin-right:auto}a{color:#8dbdff}button,select{background:#29292f;color:#eee;border:1px solid #494950;border-radius:6px;padding:6px 10px}#stage{height:calc(100dvh - 60px);display:grid;place-items:center;position:relative;overflow:hidden}#stage>svg{max-width:95vw;max-height:90vh}.overlay{position:absolute;inset:0;display:grid;place-items:center;background:#0008}.overlay svg{max-width:85vw;max-height:85vh}.show-hotspots [data-hotspot]{outline:2px dashed #328bff;outline-offset:2px}</style><header><span>${escapeXml(doc.name)}</span>${doc.flows.length ? `<select data-prototype-flow aria-label="Fluxo do protótipo">${doc.flows.map((f) => `<option value="${escapeXml(f.id)}" ${f.id === url.searchParams.get("flow") ? "selected" : ""}>${escapeXml(f.name)}</option>`).join("")}</select>` : ""}<button data-restart-prototype>Reiniciar</button><button data-toggle-hotspots aria-pressed="false">Hotspots</button><a href="/?project=${projectId}">Voltar ao editor</a></header><div id="stage"></div><script type="module">${runtime}</script></html>`,
      "text/html",
    );
    return true;
  }
  return false;
}
