import { escapeXml } from "./renderer.js";
import { icons } from "./icons.js";
export function semanticStyle(n, parent) {
  const style = {
    boxSizing: "border-box",
    position: parent ? "absolute" : "relative",
    width: n.width + "px",
    height: n.height + "px",
    margin: "0",
    opacity: n.opacity ?? 1,
  };
  if (!parent) {
    style.width = "100%";
    style.maxWidth = n.width + "px";
    style.flexShrink = 0;
  } else if (parent.layout && parent.layout !== "none") {
    style.position = "relative";
    style.flexShrink = 0;
    if (parent.layout === "vertical" && n.constraints?.horizontal === "stretch")
      style.width = "100%";
    if (
      parent.layout === "horizontal" &&
      n.constraints?.horizontal === "stretch"
    ) {
      style.flexGrow = 1;
      style.flexBasis = 0;
      style.minWidth = 0;
      style.width = "auto";
    }
  } else {
    for (const [axis, size, opposite, dimension, rule] of [
      ["left", "width", "right", "width", n.constraints?.horizontal || "left"],
      ["top", "height", "bottom", "height", n.constraints?.vertical || "top"],
    ]) {
      const at = axis === "left" ? n.x : n.y;
      if (rule === "right" || rule === "bottom")
        style[opposite] = parent[dimension] - at - n[size] + "px";
      else if (rule === "center")
        style[axis] = `calc(50% + ${at - parent[dimension] / 2}px)`;
      else if (rule === "stretch") {
        style[axis] = at + "px";
        style[opposite] = parent[dimension] - at - n[size] + "px";
        style[size] = "auto";
      } else if (rule === "scale") {
        style[axis] = (at / parent[dimension]) * 100 + "%";
        style[size] = (n[size] / parent[dimension]) * 100 + "%";
      } else style[axis] = at + "px";
    }
  }
  if (n.rotation) style.transform = `rotate(${n.rotation}deg)`;
  if (n.layout && n.layout !== "none") {
    style.display = "flex";
    style.flexDirection = n.layout === "horizontal" ? "row" : "column";
    style.gap = (n.gap || 0) + "px";
    style.padding = (n.padding || 0) + "px";
    style.alignContent = "flex-start";
    style.alignItems = "flex-start";
    style.flexWrap = n.wrap ? "wrap" : "nowrap";
    if (!parent) {
      style.height = "auto";
      style.minHeight = n.height + "px";
    }
    if (n.wrap && n.layout === "horizontal") {
      style.height = "auto";
      style.minHeight = n.height + "px";
    }
  }
  if (n.clip) style.overflow = "hidden";
  if (n.type === "text") {
    style.color = n.fill === "none" ? "transparent" : n.fill || "#242735";
    style.fontFamily = `"${n.fontFamily || "Inter"}",sans-serif`;
    style.fontSize = (n.fontSize || 16) + "px";
    style.fontWeight = n.fontWeight || 400;
    style.lineHeight = "1.4";
    style.whiteSpace = "pre-wrap";
    style.overflowWrap = "anywhere";
    if (parent?.layout && parent.layout !== "none") {
      style.height = "auto";
      style.minHeight = n.height + "px";
    }
  } else if (!["path", "icon", "image"].includes(n.type))
    style.background = n.fill === "none" ? "transparent" : n.fill || "#FFFFFF";
  if (n.type === "ellipse") style.borderRadius = "50%";
  else if (n.radius) style.borderRadius = n.radius + "px";
  if (
    n.stroke &&
    n.stroke !== "none" &&
    n.strokeWidth &&
    !["path", "icon"].includes(n.type)
  )
    style.border = `${n.strokeWidth}px solid ${n.stroke}`;
  if (n.type === "image") style.objectFit = "contain";
  if (n.semanticTag === "button") {
    style.font = "inherit";
    style.cursor = "pointer";
    if (!n.stroke) style.border = "0";
    style.padding = "0";
    style.textAlign = "left";
  }
  return style;
}
export function cssText(style) {
  return Object.entries(style)
    .map(
      ([key, value]) =>
        key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()) + ":" + value,
    )
    .join(";");
}
export function semanticTag(n, parent) {
  if (["path", "icon"].includes(n.type)) return "svg";
  if (n.type === "image") return "img";
  return (
    n.semanticTag ||
    (n.type === "text"
      ? parent?.semanticTag === "button"
        ? "span"
        : "p"
      : !n.parentId
        ? "section"
        : "div")
  );
}
export function semanticShape(n) {
  if (n.type === "path")
    return `<path d="${escapeXml(n.pathData)}" fill="${escapeXml(n.fill || "none")}" stroke="${escapeXml(n.stroke || "none")}" stroke-width="${n.strokeWidth || 0}"/>`;
  if (n.type === "icon") return icons[n.icon] || "";
  return "";
}
export function renderSemantic(document, frameId) {
  const nodes = document.nodes.map((n) => ({ ...n }));
  for (const n of nodes)
    for (const [key, id] of Object.entries(n.tokenBindings || {})) {
      const token = document.tokens?.find((t) => t.id === id);
      if (token) n[key] = token.value;
    }
  const render = (n) => {
    const parent = nodes.find((p) => p.id === n.parentId),
      tag = semanticTag(n, parent),
      style = cssText(semanticStyle(n, parent));
    let attributes = `data-node-id="${escapeXml(n.id)}" style="${escapeXml(style)}"`;
    if (!parent) attributes += ' class="design-frame"';
    if (tag === "svg")
      attributes += ` viewBox="0 0 ${n.type === "icon" ? "24 24" : `${n.pathWidth || n.width} ${n.pathHeight || n.height}`}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="${escapeXml(n.fill || "#242735")}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${escapeXml(n.name)}"`;
    if (tag === "img")
      return `<img ${attributes} src="${escapeXml(n.src)}" alt="${escapeXml(n.name)}">`;
    if (tag === "button") attributes += ' type="button"';
    return `<${tag} ${attributes}>${n.type === "text" ? escapeXml(n.text) : semanticShape(n)}${nodes
      .filter((c) => c.parentId === n.id)
      .map(render)
      .join("")}</${tag}>`;
  };
  const root =
    nodes.find((n) => n.id === frameId) || nodes.find((n) => !n.parentId);
  return root ? render({ ...root, parentId: undefined, x: 0, y: 0 }) : "";
}
