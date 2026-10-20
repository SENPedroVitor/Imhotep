import { outlineFonts } from "../core/fonts.js";
import * as renderer from "../../public/renderer.js";
import { icons } from "../../public/icons.js";
import { renderSvg, escapeXml } from "../../public/renderer.js";
import { evaluateMotion, ease } from "../../public/motion.js";
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
    /^\/api\/projects\/([\w-]+)\/(sessions|code|prototype)(?:\/([\w-]+)\/(apply|cancel))?$/,
  );
  if (!match) return false;
  const [, projectId, action, sessionId, command] = match;
  const project = store.get(projectId);
  if (action === "sessions") {
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
    const runtime = `const icons=${JSON.stringify(icons)};${Object.entries(
      renderer,
    )
      .filter(([, value]) => typeof value === "function")
      .map(([name, value]) => `const ${name}=${value.toString()};`)
      .join(
        "",
      )}const ease=${ease.toString()};const evaluateMotion=${evaluateMotion.toString()};const doc=${safe};const roots=doc.nodes.filter(n=>n.type==='frame'&&!n.parentId);let active=roots[0]?.id,stack=[],overlay=null,start=performance.now(),timers=[];const stage=document.querySelector('#stage');const rootId=n=>{while(n?.parentId)n=doc.nodes.find(p=>p.id===n.parentId);return n?.id;};function act(i){if(i.action==='back'){active=stack.pop()||roots[0]?.id;overlay=null;}else if(i.action==='close')overlay=null;else if(i.action==='overlay')overlay=i.targetId;else{stack.push(active);active=i.targetId;overlay=null;}start=performance.now();if(i.transition!=='instant')stage.animate(i.transition==='slide'?[{opacity:0,transform:'translateX(35px)'},{opacity:1,transform:'none'}]:[{opacity:0},{opacity:1}],{duration:i.duration,fill:'none'});schedule();}function schedule(){timers.forEach(clearTimeout);timers=(doc.interactions||[]).filter(i=>i.trigger==='after-delay'&&rootId(doc.nodes.find(n=>n.id===i.nodeId))===(overlay||active)).map(i=>setTimeout(()=>act(i),i.duration));}for(const event of ['click','pointerover'])stage.addEventListener(event,e=>{let node=e.target.closest('[data-node-id]');while(node){const i=(doc.interactions||[]).find(i=>i.nodeId===node.dataset.nodeId&&i.trigger===(event==='click'?'click':'hover'));if(i){act(i);break;}node=node.parentElement?.closest('[data-node-id]');}});function tick(now){const animated=evaluateMotion(doc,now-start);stage.innerHTML=active?renderSvg(animated,active):renderSvg(animated);if(overlay){const layer=document.createElement('div');layer.className='overlay';layer.innerHTML=renderSvg(animated,overlay);stage.append(layer);}requestAnimationFrame(tick);}schedule();requestAnimationFrame(tick);`;
    // The same trusted runtime can be requested independently or embedded for offline exports.
    if (url.searchParams.get("runtime") === "1") {
      send(200, runtime, "text/javascript");
      return true;
    }
    send(
      200,
      `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>${escapeXml(doc.name)}</title><style>body{margin:0;background:#19191c;color:white;font-family:sans-serif}header{padding:12px;display:flex;justify-content:space-between}a{color:#8dbdff}#stage{height:calc(100vh - 50px);display:grid;place-items:center;position:relative}#stage>svg{max-width:95vw;max-height:90vh}.overlay{position:absolute;inset:0;display:grid;place-items:center;background:#0008}.overlay svg{max-width:85vw;max-height:85vh}</style><header><span>${escapeXml(doc.name)}</span><a href="/?project=${projectId}">Voltar ao editor</a></header><div id="stage"></div><script type="module">${runtime}</script></html>`,
      "text/html",
    );
    return true;
  }
  return false;
}
