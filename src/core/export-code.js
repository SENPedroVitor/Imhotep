import { readFile } from "node:fs/promises";
import { escapeXml } from "../../public/renderer.js";
import { icons } from "../../public/icons.js";
import * as semantic from "../../public/semantic.js";
import { mountPrototype } from "../../public/prototype.js";
import { evaluateMotion, ease } from "../../public/motion.js";
export async function exportCode(doc, format = "html", frameId) {
  doc = structuredClone(doc);
  for (const n of doc.nodes)
    for (const [key, id] of Object.entries(n.tokenBindings || {})) {
      const token = doc.tokens.find((t) => t.id === id);
      if (token) n[key] = token.value;
    }
  const fonts = [];
  const local = {
    Inter: "Inter",
    Manrope: "Manrope",
    "JetBrains Mono": "JetBrainsMono",
  };
  const families = new Set(
    doc.nodes
      .filter((n) => n.type === "text")
      .map((n) => n.fontFamily || "Inter"),
  );
  for (const family of families) {
    const custom = doc.fonts.find((f) => f.id === family);
    const data =
      custom?.data ||
      (local[family]
        ? "data:font/woff2;base64," +
          (
            await readFile(
              new URL(
                `../../public/fonts/${local[family]}.woff2`,
                import.meta.url,
              ),
            )
          ).toString("base64")
        : null);
    if (data)
      fonts.push(
        `@font-face{font-family:"${family}";src:url(${data});font-weight:100 900;font-display:swap}`,
      );
  }
  const css =
    fonts.join("") +
    "*{box-sizing:border-box}body{margin:0;background:#19191c;color:#eee;font-family:Inter,sans-serif}.imhotep-stage{position:relative;display:grid;place-items:start center;min-height:100dvh;width:100%;overflow:hidden}.imhotep-stage>.design-frame{max-width:100%}.overlay{position:absolute;inset:0;display:grid;place-items:center;background:#0008}.overlay>.design-frame{max-width:90vw}.prototype-transition-layer{background:#19191c}button:focus-visible{outline:2px solid #328BFF;outline-offset:3px}";
  const safe = (value) =>
    JSON.stringify(value ?? null).replace(/</g, "\\u003c");
  if (format === "react" || format === "tailwind") {
    const root =
      doc.nodes.find((n) => n.id === frameId) ||
      doc.nodes.find((n) => n.type === "frame" && !n.parentId);
    const render = (n) => {
      const parent = doc.nodes.find((p) => p.id === n.parentId),
        tag = semantic.semanticTag(n, parent),
        style = semantic.semanticStyle(n, parent);
      let attrs = `data-node-id=${JSON.stringify(n.id)} style={${JSON.stringify(style)}}`;
      if (format === "tailwind")
        attrs += ` className="${n.layout === "horizontal" ? "flex flex-row" : n.layout === "vertical" ? "flex flex-col" : style.position === "absolute" ? "absolute" : "relative"}${n.wrap ? " flex-wrap" : ""}${n.clip ? " overflow-hidden" : ""}"`;
      if (tag === "img")
        return `<img ${attrs} src={${JSON.stringify(n.src)}} alt={${JSON.stringify(n.name)}} />`;
      if (tag === "svg") {
        attrs += ` viewBox="0 0 ${n.type === "icon" ? "24 24" : `${n.pathWidth || n.width} ${n.pathHeight || n.height}`}" preserveAspectRatio="none" fill="none" stroke={${JSON.stringify(n.fill || "#242735")}} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={${JSON.stringify(n.name)}}`;
        return `<svg ${attrs}>${semantic
          .semanticShape(n)
          .replace(/stroke-width=/g, "strokeWidth=")
          .replace(/stroke-linecap=/g, "strokeLinecap=")
          .replace(/stroke-linejoin=/g, "strokeLinejoin=")}</svg>`;
      }
      if (tag === "button") attrs += ' type="button"';
      return `<${tag} ${attrs}>${n.type === "text" ? "{" + JSON.stringify(n.text) + "}" : ""}${doc.nodes
        .filter((c) => c.parentId === n.id)
        .map(render)
        .join("")}</${tag}>`;
    };
    return `// Componente semântico responsivo. Configure auto layout e constraints no Imhotep.\n// Interações e motion executáveis são exportados no HTML; este componente é visual.\n// ${format === "tailwind" ? "Classes Tailwind para estrutura; estilos de geometria e tokens são explícitos." : "Sem dependência de CSS externo."}\nexport default function Design(){return <><style>{${JSON.stringify(fonts.join(""))}}</style>${root ? render({ ...root, parentId: undefined, x: 0, y: 0 }) : "<div />"}</>;}\n`;
  }
  const runtime = `const icons=${safe(icons)};const escapeXml=${escapeXml.toString()};${Object.entries(
    semantic,
  )
    .filter(([, v]) => typeof v === "function")
    .map(([name, value]) => `const ${name}=${value.toString()};`)
    .join(
      "",
    )}const ease=${ease.toString()};const evaluateMotion=${evaluateMotion.toString()};const mountPrototype=${mountPrototype.toString()};const doc=${safe(doc)};mountPrototype(doc,{stage:document.querySelector('#stage'),renderSvg:renderSemantic,evaluateMotion,initialFrame:${safe(frameId)}});`;
  const start =
    frameId ||
    doc.flows?.[0]?.startFrameId ||
    doc.nodes.find((n) => n.type === "frame" && !n.parentId)?.id;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeXml(doc.name)}</title><style>${css}</style></head><body><div id="stage" class="imhotep-stage">${semantic.renderSemantic(doc, start)}</div><script type="module">${runtime}</script></body></html>`;
}
