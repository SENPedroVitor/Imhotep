import { icons } from "./icons.js";
export const escapeXml = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
export function position(node, nodes) {
  let x = node.x,
    y = node.y,
    p = node.parentId;
  const map = new Map(nodes.map((n) => [n.id, n]));
  while (p && map.has(p)) {
    const parent = map.get(p);
    x += parent.x;
    y += parent.y;
    p = parent.parentId;
  }
  return { x, y };
}
export function bounds(nodes) {
  if (!nodes.length) return { x: 0, y: 0, width: 960, height: 640 };
  const boxes = nodes.map((n) => ({ ...n, ...position(n, nodes) }));
  const x = Math.min(...boxes.map((n) => n.x)),
    y = Math.min(...boxes.map((n) => n.y));
  return {
    x,
    y,
    width: Math.max(1, ...boxes.map((n) => n.x + n.width - x)),
    height: Math.max(1, ...boxes.map((n) => n.y + n.height - y)),
  };
}
export function nodeMarkup(n, children = "") {
  const fill = escapeXml(n.fill ?? (n.type === "text" ? "#242735" : "#FFFFFF"));
  const attrs = `fill="${fill}" stroke="${escapeXml(n.stroke ?? "none")}" stroke-width="${n.strokeWidth ?? 0}"`;
  let shape;
  if (n.fontOutline) {
    shape = n.fontOutline;
  } else if (n.type === "path") {
    shape = `<path d="${escapeXml(n.pathData)}" ${attrs}/>`;
  } else if (n.type === "image") {
    shape = `<image width="${n.width}" height="${n.height}" href="${escapeXml(n.src)}" preserveAspectRatio="xMidYMid meet"/>`;
  } else if (n.type === "icon") {
    shape = `<svg width="${n.width}" height="${n.height}" viewBox="0 0 24 24" fill="none" stroke="${fill}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[n.icon] ?? ""}</svg>`;
  } else if (n.type === "text") {
    const size = n.fontSize ?? 16;
    shape = `<text ${attrs} font-family="${escapeXml(n.fontFamily ?? "Inter")},sans-serif" font-size="${size}" font-weight="${n.fontWeight ?? 400}" xml:space="preserve">${(
      n.text ?? ""
    )
      .split("\n")
      .map(
        (t, i) =>
          `<tspan x="0" y="${size + i * size * 1.4}">${escapeXml(t)}</tspan>`,
      )
      .join("")}</text>`;
  } else if (n.type === "ellipse")
    shape = `<ellipse cx="${n.width / 2}" cy="${n.height / 2}" rx="${n.width / 2}" ry="${n.height / 2}" ${attrs}/>`;
  else
    shape = `<rect width="${n.width}" height="${n.height}" rx="${n.radius ?? 0}" ${attrs}/>`;
  return `<g data-node-id="${escapeXml(n.id)}" transform="translate(${n.x} ${n.y}) rotate(${n.rotation ?? 0} ${n.width / 2} ${n.height / 2})" opacity="${n.opacity ?? 1}">${shape}${children}</g>`;
}
export function layoutDocument(document) {
  const doc = structuredClone(document);
  for (const n of doc.nodes)
    for (const [key, id] of Object.entries(n.tokenBindings || {})) {
      const token = (doc.tokens || []).find((t) => t.id === id);
      if (token) n[key] = token.value;
    }

  const walk = (parent) => {
    let offset = parent.padding ?? 0;
    for (const n of doc.nodes.filter((n) => n.parentId === parent.id)) {
      if (parent.layout === "horizontal") {
        n.x = offset;
        n.y = parent.padding ?? 0;
        offset += n.width + (parent.gap ?? 0);
      }
      if (parent.layout === "vertical") {
        n.y = offset;
        n.x = parent.padding ?? 0;
        offset += n.height + (parent.gap ?? 0);
      }
      walk(n);
    }
  };
  for (const root of doc.nodes.filter((n) => !n.parentId)) walk(root);
  return doc;
}
export function sceneMarkup(document, rootId) {
  const doc = layoutDocument(document);
  const fontDefs = (doc.fonts || []).length
    ? `<defs><style>${doc.fonts.map((f) => `@font-face{font-family:${escapeXml(f.id)};src:url(${f.data})}`).join("")}</style></defs>`
    : "";
  const render = (n) =>
    nodeMarkup(
      n,
      doc.nodes
        .filter((c) => c.parentId === n.id)
        .map(render)
        .join(""),
    );
  if (rootId) {
    const root = doc.nodes.find((n) => n.id === rootId);
    if (!root) throw new Error("Frame não encontrado");
    return fontDefs + render({ ...root, x: 0, y: 0 });
  }
  return (
    fontDefs +
    doc.nodes
      .filter((n) => !n.parentId)
      .map(render)
      .join("")
  );
}
export function renderSvg(doc, frameId) {
  const frame = frameId && doc.nodes.find((n) => n.id === frameId);
  if (frameId && !frame) throw new Error("Frame não encontrado");
  const b = frame
    ? { x: 0, y: 0, width: frame.width, height: frame.height }
    : bounds(doc.nodes);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(b.width)}" height="${Math.ceil(b.height)}" viewBox="${b.x} ${b.y} ${b.width} ${b.height}">${(doc.fonts || []).length ? `<defs><style>${doc.fonts.map((f) => `@font-face{font-family:${escapeXml(f.id)};src:url(${f.data})}`).join("")}</style></defs>` : ""}${sceneMarkup(doc, frameId)}</svg>`;
}
