import { installInterface, transitionView } from "./interface.js";
import { installWorkbench } from "./workbench.js";
import {
  sceneMarkup,
  renderSvg,
  escapeXml as esc,
  position,
  bounds,
  layoutDocument,
} from "./renderer.js";
const $ = (s) => document.querySelector(s),
  app = $("#app"),
  dialog = $("#dialog");
installInterface(dialog);
const paths = {
  layers: "M12 3 2 8l10 5 10-5-10-5ZM2 12l10 5 10-5M2 16l10 5 10-5",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  folder: "M3 6h7l2 2h9v12H3V6Z",
  chevron: "m9 5 7 7-7 7",
  down: "m6 9 6 6 6-6",
  arrow: "m5 3 14 9-7 1-3 7L5 3Z",
  frame: "M7 2v20M17 2v20M2 7h20M2 17h20",
  rectangle: "M4 4h16v16H4z",
  ellipse: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18",
  text: "M4 4h16M12 4v16M8 20h8",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  undo: "M8 5 3 10l5 5M3 10h10a7 7 0 0 1 7 7",
  redo: "m16 5 5 5-5 5M21 10h-10a7 7 0 0 0-7 7",
  history: "M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v6l4 2",
  server: "M3 3h18v7H3zM3 14h18v7H3zM7 6h.01M7 17h.01",
  code: "m8 6-6 6 6 6M16 6l6 6-6 6m-3-15-2 18",
  sparkles: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
  motion: "M3 5h18v15H3zM3 9h18M8 5l3 4m4-4 3 4m-8 4 5 3-5 3v-6Z",
  play: "m8 4 12 8-12 8V4Z",
  sun: "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1",
  fit: "M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5",
  search: "M10 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14m5 12 6 6",
  settings: "M4 7h16M4 17h16M8 4v6m8 4v6",
  component:
    "m12 2 5 5-5 5-5-5 5-5Zm-5 5-5 5 5 5 5-5m5-5 5 5-5 5-5-5m0 0-5 5 5 5 5-5",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M6 18 18 6",
  hand: "M6 12V6a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-6a2 2 0 0 1 4 0v8-3a2 2 0 0 1 4 0v5c0 8-13 8-16 3L2 14a2 2 0 0 1 3-2l3 3",
};
const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.rectangle}"/></svg>`;
const ib = (name, label, action, disabled = false) =>
  `<button class="icon-button" title="${esc(label)}" aria-label="${esc(label)}" data-action="${action}" ${disabled ? "disabled" : ""}>${icon(name)}</button>`;
// getRandomValues is available on private HTTP origins as well as HTTPS.
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
async function copyText(text) {
  if (navigator.clipboard?.writeText)
    return navigator.clipboard.writeText(text);
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  const success = document.execCommand("copy");
  area.remove();
  if (!success)
    throw new Error("Selecione o CSS no painel e copie com Ctrl+C.");
}
const browserAuthor = "browser-" + uuid().slice(0, 8);
const state = {
  project: null,
  projects: [],
  selected: null,
  mode: "design",
  history: [],
  source: null,
  online: true,
  busy: false,
  undo: [],
  redo: [],
  view: { x: 0, y: 0, scale: 1 },
  pending: null,
  drag: null,
  pan: false,
};
const workbench = installWorkbench({
  state,
  api,
  commit,
  selected,
  select,
  refresh,
  renderScene,
  renderInspector,
  notice,
  uuid,
  dialog,
  fit,
  esc,
  icon,
  copyText,
});
let noticeTimer;
function notice(message, error = false, persistent = false) {
  clearTimeout(noticeTimer);
  const n = $("#notice");
  n.className = error ? "error" : "";
  n.innerHTML = `${esc(message)}${state.pending ? `<button data-action="retry">${state.pending.uncertain ? "Verificar e repetir envio" : "Reaplicar sobre a revisão atual"}</button>` : ""}<button data-action="dismiss" aria-label="Fechar aviso">×</button>`;
  n.hidden = false;
  if (!persistent) noticeTimer = setTimeout(() => (n.hidden = true), 5000);
}
async function api(path, body) {
  const r = await fetch(
    path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await r.json();
  if (!r.ok) {
    const e = new Error(data.error);
    e.status = r.status;
    throw e;
  }
  return data;
}
function topbar(editor = false) {
  return `<header class="topbar"><button class="brand" data-action="home" title="Voltar aos canvases" aria-label="Voltar aos canvases"><span class="brand-mark">i</span><span class="brand-name">Imhotep</span></button><span class="divider"></span>${editor ? `<div class="project-name"><span class="muted">${icon("folder")}</span> ${esc(state.project.document.name)} ${icon("down")}</div><div class="mode-switch"><button data-action="design" class="${state.mode === "design" ? "active" : ""}">${icon("arrow")}Design</button><button data-action="dev" class="${state.mode === "dev" ? "active" : ""}">${icon("code")}Dev</button><button data-action="motion">${icon("motion")}Motion</button><button data-action="agents" class="${state.mode === "agents" ? "active" : ""}">${icon("sparkles")}Agentes</button></div>` : '<span class="muted">Workspace local</span>'}<span class="spacer"></span><span class="save-state"><span class="status-dot ${state.online ? "" : "offline"}"></span><span id="save-label">${state.busy ? "Salvando…" : state.pending ? "Alteração pendente" : state.online ? "Salvo no servidor" : "Sem conexão"}</span></span>${ib("sun", "Alternar tema", "theme")}${editor ? `${ib("undo", "Desfazer · Ctrl+Z", "undo", !state.undo.length || state.busy)}${ib("redo", "Refazer · Ctrl+Shift+Z", "redo", !state.redo.length || state.busy)}${ib("history", "Histórico de revisões", "history")}<button class="primary" data-action="preview">${icon("play")} <span>Preview</span></button>` : '<span class="server-label muted">' + icon("server") + " &nbsp;Servidor local</span>"}</header>`;
}
function sidebarHome() {
  return `<aside class="sidebar"><div class="side-head">Workspace</div><div class="workspace-select">${icon("folder")}Studio local ${icon("down")}</div><nav class="side-nav"><button class="active" data-action="home">${icon("grid")}Canvases</button></nav><div class="side-foot">${icon("server")}Seus arquivos, no seu servidor.<br>Sem conta externa para criar.</div></aside>`;
}
async function home() {
  state.source?.close();
  state.source = null;
  state.project = null;
  state.projects = await api("/api/projects");
  history.replaceState(null, "", "/");
  transitionView(renderHome);
}
function renderHome() {
  app.innerHTML =
    topbar() +
    `<main class="workspace">${sidebarHome()}<section class="home-content"><div class="home-heading"><div><h1>Canvases</h1><p>${state.projects.length} ${state.projects.length === 1 ? "canvas" : "canvases"} no seu workspace</p></div><button class="primary" data-action="new">${icon("plus")} &nbsp; Novo canvas</button></div><div class="home-filters"><span>Todos os canvases</span><input id="project-search" type="search" aria-label="Buscar canvas" placeholder="Buscar canvas…"></div><div class="project-grid" id="project-grid"></div><p class="local-caption">${icon("server")} Documentos persistidos localmente · Imhotep 0.2</p></section></main>`;
  renderCards();
  $("#project-search").addEventListener("input", renderCards);
}
function renderCards() {
  const query = ($("#project-search")?.value || "").toLowerCase();
  $("#project-grid").innerHTML =
    state.projects
      .filter((p) => p.name.toLowerCase().includes(query))
      .map(
        (p) =>
          `<button class="project-card" data-project="${esc(p.id)}"><img src="/api/projects/${encodeURIComponent(p.id)}/render?format=svg&revision=${p.revision}" alt="Prévia de ${esc(p.name)}"><div class="card-info"><h2>${esc(p.name)}</h2><p>Revisão ${p.revision} &nbsp;·&nbsp; ${new Date(p.updatedAt).toLocaleDateString("pt-BR")}</p></div></button>`,
      )
      .join("") +
    `<button class="new-card" data-action="new">${icon("plus")}Criar um canvas</button>`;
}
async function openProject(projectId) {
  state.source?.close();
  state.project = await api(`/api/projects/${encodeURIComponent(projectId)}`);
  state.selected = null;
  state.pageId = state.project.document.pages?.[0]?.id || "page-1";
  state.mode = "design";
  state.undo = [];
  state.redo = [];
  state.pending = null;
  state.online = true;
  history.replaceState(null, "", `/?project=${encodeURIComponent(projectId)}`);
  transitionView(() => {
    renderEditor();
    requestAnimationFrame(fit);
  });
  const source = new EventSource(`/api/projects/${projectId}/events`);
  state.source = source;
  source.addEventListener("ready", async () => {
    if (state.source !== source) return;
    state.online = true;
    try {
      const latest = await api(`/api/projects/${projectId}`);
      if (
        state.project?.id === projectId &&
        latest.revision > state.project.revision
      ) {
        state.project = latest;
        state.undo = [];
        state.redo = [];
        refresh();
      }
      updateStatus();
    } catch {
      state.online = false;
      updateStatus();
    }
  });
  source.onmessage = (e) => {
    if (state.project?.id !== projectId) return;
    const update = JSON.parse(e.data);
    if (update.revision <= state.project.revision) return;
    state.project = {
      ...state.project,
      document: update.document,
      revision: update.revision,
    };
    if (update.author !== browserAuthor) {
      state.undo = [];
      state.redo = [];
      notice(
        `${update.author} atualizou o canvas · revisão ${update.revision}`,
      );
    }
    if (state.drag) {
      state.drag = null;
      notice(
        "O canvas mudou durante o movimento. Sua posição não foi enviada.",
        true,
      );
    }
    refresh();
  };
  source.onerror = () => {
    state.online = false;
    updateStatus();
  };
}
function selected() {
  return state.project?.document.nodes.find((n) => n.id === state.selected);
}
function renderEditor() {
  app.innerHTML =
    topbar(true) +
    `<main class="workspace"><aside class="sidebar"><div class="layers-head"><span>Camadas</span><span class="muted">${state.project.document.nodes.length} elementos</span></div><div class="page-pill">${icon("layers")}Página 1 <span class="muted">${icon("down")}</span></div><input class="layer-search" id="layer-search" placeholder="Buscar camadas…" aria-label="Buscar camadas"><div class="layer-list" id="layers"></div><div class="side-foot">${icon("server")}Workspace local</div></aside><section class="editor-center"><div class="revision-line" id="revision-line"></div><svg class="canvas-surface" id="canvas" tabindex="0" aria-label="Canvas de edição"><g id="viewport"><g id="scene"></g><g id="selection" pointer-events="none"></g></g></svg><div class="canvas-dock"><button class="kendrick-launcher" data-work="toggle-chat" aria-label="Conversar com Kendrick" aria-expanded="false" aria-controls="kendrick-popover"><kendrick-avatar mood="idle"></kendrick-avatar><svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4 3 3 3-3"/></svg><span class="launcher-hint">Kendrick <kbd>${navigator.platform.includes("Mac") ? "⌘ K" : "Ctrl K"}</kbd></span></button><div class="toolbar">${ib("arrow", "Selecionar · V", "select")}${ib("hand", "Mover canvas · H", "pan")}<span class="tool-divider"></span>${ib("frame", "Adicionar frame · F", "add-frame")}${ib("rectangle", "Adicionar retângulo · R", "add-rectangle")}${ib("ellipse", "Adicionar elipse · O", "add-ellipse")}${ib("text", "Adicionar texto · T", "add-text")}<span class="tool-divider"></span>${ib("fit", "Ajustar ao canvas", "fit")}</div></div><div class="zoom-controls"><button data-action="zoom-out" aria-label="Diminuir zoom">−</button><span id="zoom-label"></span><button data-action="zoom-in" aria-label="Aumentar zoom">+</button></div></section><aside class="inspector" id="inspector"></aside></main>`;
  $("#layer-search").addEventListener("input", renderLayers);
  const canvas = $("#canvas");
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", () => {
    state.drag = null;
    renderScene();
  });
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("dblclick", () => {
    if (selected()?.type === "text") {
      $("#node-text")?.focus();
    }
  });
  refresh();
}
function refresh() {
  if (!state.project) return;
  workbench.mount();
  if (!selected()) state.selected = null;
  renderLayers();
  renderScene();
  renderInspector();
  updateStatus();
}
function updateStatus() {
  if (!state.project) return;
  const save = $("#save-label");
  if (save)
    save.textContent = state.busy
      ? "Salvando…"
      : state.pending
        ? "Alteração pendente"
        : state.online
          ? "Salvo no servidor"
          : "Sem conexão";
  const dot = $(".save-state .status-dot");
  if (dot) dot.classList.toggle("offline", !state.online);
  if ($("#revision-line"))
    $("#revision-line").innerHTML =
      `${esc(state.project.document.name)} <span> / revisão ${state.project.revision}</span>`;
  const undo = $('[data-action="undo"]'),
    redo = $('[data-action="redo"]');
  if (undo) undo.disabled = !state.undo.length || state.busy;
  if (redo) redo.disabled = !state.redo.length || state.busy;
}
function renderLayers() {
  const query = $("#layer-search")?.value.toLowerCase() || "";
  const doc = workbench.visibleDocument();
  const ordered = [];
  function add(parent, depth) {
    for (const n of doc.nodes.filter((n) => (n.parentId || null) === parent)) {
      ordered.push({ n, depth });
      add(n.id, depth + 1);
    }
  }
  add(null, 0);
  $("#layers").innerHTML = ordered
    .filter(({ n }) => n.name.toLowerCase().includes(query))
    .map(
      ({ n, depth }) =>
        `<button class="layer-row ${n.id === state.selected ? "selected" : ""}" data-select="${esc(n.id)}" style="padding-left:${12 + Math.min(depth, 8) * 13}px" title="${esc(n.name)}">${icon(n.type === "text" ? "text" : n.type === "frame" ? "frame" : n.type === "ellipse" ? "ellipse" : n.type === "icon" ? "sparkles" : "rectangle")}<span>${esc(n.name)}</span></button>`,
    )
    .join("");
  const count = $(".layers-head .muted");
  if (count) count.textContent = `${doc.nodes.length} elementos`;
}
function renderScene() {
  if (!$("#scene")) return;
  const doc = workbench.visibleDocument();
  $("#scene").innerHTML = sceneMarkup(doc) + workbench.connectionMarkup(doc);
  applyView();
  const n = selected();
  $("#selection").innerHTML = (state.selectedIds || [state.selected])
    .map((id) => doc.nodes.find((n) => n.id === id))
    .filter(Boolean)
    .map(selectionMarkup)
    .join("");
}
function selectionMarkup(n) {
  if (!state.drag)
    n = workbench.visibleDocument().nodes.find((v) => v.id === n.id) || n;
  const p = position(n, workbench.visibleDocument().nodes),
    s = state.view.scale,
    handle = 5 / s;
  return (
    `<rect x="${p.x}" y="${p.y}" width="${n.width}" height="${n.height}" fill="none" stroke="#328BFF" stroke-width="${1.25 / s}"/>` +
    [
      [p.x, p.y],
      [p.x + n.width, p.y],
      [p.x, p.y + n.height],
      [p.x + n.width, p.y + n.height],
    ]
      .map(
        ([x, y]) =>
          `<rect data-resize="${x === p.x ? "w" : "e"}${y === p.y ? "n" : "s"}" pointer-events="all" x="${x - handle / 2}" y="${y - handle / 2}" width="${handle}" height="${handle}" fill="#FFFFFF" stroke="#328BFF" stroke-width="${1 / s}"/>`,
      )
      .join("")
  );
}
function applyView() {
  const { x, y, scale } = state.view;
  $("#viewport")?.setAttribute(
    "transform",
    `translate(${x} ${y}) scale(${scale})`,
  );
  if ($("#zoom-label"))
    $("#zoom-label").textContent = `${Math.round(scale * 100)}%`;
}
function fit() {
  const center = $(".editor-center");
  if (!center) return;
  const b = bounds(workbench.visibleDocument().nodes),
    scale = Math.max(
      0.1,
      Math.min(
        1,
        (center.clientWidth - 140) / b.width,
        (center.clientHeight - 180) / b.height,
      ),
    );
  state.view = {
    scale,
    x: (center.clientWidth - b.width * scale) / 2 - b.x * scale,
    y: (center.clientHeight - b.height * scale) / 2 - b.y * scale - 25,
  };
  renderScene();
}
function zoom(factor, point) {
  const canvas = $("#canvas"),
    r = canvas.getBoundingClientRect();
  const px = point?.x ?? r.width / 2,
    py = point?.y ?? r.height / 2;
  const old = state.view.scale,
    scale = Math.min(4, Math.max(0.1, old * factor));
  state.view = {
    scale,
    x: px - ((px - state.view.x) * scale) / old,
    y: py - ((py - state.view.y) * scale) / old,
  };
  renderScene();
}
function wheel(e) {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) {
    const r = $("#canvas").getBoundingClientRect();
    zoom(Math.exp(-e.deltaY * 0.005), {
      x: e.clientX - r.left,
      y: e.clientY - r.top,
    });
  } else {
    state.view.x -= e.deltaX;
    state.view.y -= e.deltaY;
    applyView();
  }
}
function select(nodeId, add = false) {
  state.selectedIds = add
    ? [...new Set([...(state.selectedIds || []), nodeId])]
    : nodeId
      ? [nodeId]
      : [];
  state.selected = nodeId;
  renderLayers();
  renderScene();
  renderInspector();
}
function pointerDown(e) {
  if (e.button !== 0 && e.button !== 1) return;
  const canvas = $("#canvas");
  canvas.setPointerCapture(e.pointerId);
  if (workbench.connectorDown(e)) return;
  const resize = e.target.closest("[data-resize]");
  if (resize && selected()) {
    state.drag = {
      kind: "resize",
      corner: resize.dataset.resize,
      x: e.clientX,
      y: e.clientY,
      node: structuredClone(selected()),
      revision: state.project.revision,
      moved: false,
    };
    return;
  }
  const target = e.target.closest("[data-node-id]");
  if (e.button === 1 || state.pan || e.altKey) {
    state.drag = {
      kind: "pan",
      x: e.clientX,
      y: e.clientY,
      view: { ...state.view },
    };
    return;
  }
  if (!target) {
    select(null);
    return;
  }
  if (
    !e.shiftKey &&
    (state.selectedIds || []).includes(target.dataset.nodeId)
  ) {
    state.selected = target.dataset.nodeId;
    renderInspector();
  } else select(target.dataset.nodeId, e.shiftKey);
  const n = selected();
  if (n)
    state.drag = {
      kind: "node",
      x: e.clientX,
      y: e.clientY,
      node: structuredClone(n),
      group: (state.selectedIds || [n.id])
        .map((id) => state.project.document.nodes.find((n) => n.id === id))
        .filter(Boolean)
        .filter((v) => !(state.selectedIds || []).includes(v.parentId))
        .map((v) => structuredClone(v)),
      revision: state.project.revision,
      moved: false,
    };
}
function pointerMove(e) {
  if (workbench.connectorMove(e)) return;
  const drag = state.drag;
  if (!drag) return;
  const dx = e.clientX - drag.x,
    dy = e.clientY - drag.y;
  if (drag.kind === "pan") {
    state.view.x = drag.view.x + dx;
    state.view.y = drag.view.y + dy;
    applyView();
    return;
  }
  if (state.busy || Math.abs(dx) + Math.abs(dy) < 3) return;
  drag.moved = true;
  drag.next = {
    x: Math.round(drag.node.x + dx / state.view.scale),
    y: Math.round(drag.node.y + dy / state.view.scale),
  };
  if (drag.kind === "resize") {
    const w = drag.corner.includes("w"),
      north = drag.corner.includes("n");
    const width = Math.max(
        8,
        drag.node.width + (w ? -dx : dx) / state.view.scale,
      ),
      height = Math.max(
        8,
        drag.node.height + (north ? -dy : dy) / state.view.scale,
      );
    drag.next = {
      x: w ? drag.node.x + drag.node.width - width : drag.node.x,
      y: north ? drag.node.y + drag.node.height - height : drag.node.y,
      width,
      height,
    };
    const doc = workbench.visibleDocument();
    const node = doc.nodes.find((n) => n.id === drag.node.id);
    Object.assign(node, drag.next);
    $("#scene").innerHTML = sceneMarkup(doc) + workbench.connectionMarkup(doc);
    $("#selection").innerHTML = selectionMarkup({ ...drag.node, ...drag.next });
    return;
  }
  const group = $("#scene").querySelector(
    `[data-node-id="${CSS.escape(drag.node.id)}"]`,
  );
  group?.setAttribute("transform", `translate(${drag.next.x} ${drag.next.y})`);
  $("#selection").innerHTML = selectionMarkup({ ...drag.node, ...drag.next });
}
async function pointerUp(e) {
  if (await workbench.connectorUp(e)) return;
  const drag = state.drag;
  state.drag = null;
  if (["node", "resize"].includes(drag?.kind) && drag.moved) {
    if (drag.revision !== state.project.revision) {
      renderScene();
      notice("O canvas mudou. Selecione o elemento e tente novamente.", true);
      return;
    }
    const changes =
      drag.kind === "resize"
        ? [{ type: "update_node", id: drag.node.id, changes: drag.next }]
        : (drag.group || [drag.node]).map((n) => ({
            type: "update_node",
            id: n.id,
            changes: {
              x: n.x + drag.next.x - drag.node.x,
              y: n.y + drag.next.y - drag.node.y,
            },
          }));
    await commit(changes);
  }
}
function property(key, label, value, type = "number") {
  return `<label class="field"><span>${label}</span><input data-property="${key}" aria-label="${label}" type="${type}" value="${esc(value)}" ${type === "number" ? 'step="1"' : ""}></label>`;
}
function renderInspector() {
  const panel = $("#inspector");
  if (!panel) return;
  panel.dataset.mode = state.mode;
  if (workbench.renderInspector()) return;
  const n = selected();
  if (state.mode === "history") {
    renderHistory();
    return;
  }
  if (state.mode === "agents") {
    panel.innerHTML = `<div class="inspector-title"><strong>${icon("sparkles")}Agentes no workspace</strong><small>API e MCP locais</small></div><section class="inspector-section"><h3>Conectar por MCP</h3><p class="muted">Execute o adaptador no servidor:</p><pre>node /home/faux/Imhotep/src/mcp/index.js</pre><p class="muted">Ferramentas para consultar, alterar, renderizar e restaurar documentos. Configure o caminho absoluto conforme a sua instalação.</p></section><section class="inspector-section"><h3>Este projeto</h3><pre>${esc(state.project.id)}</pre><p class="muted">Revisão ${state.project.revision}. Alterações recebidas pela API aparecem neste canvas automaticamente.</p><button class="text-button" data-action="history">${icon("history")} Histórico de operações</button></section><div class="inspector-foot">Nenhum agente é iniciado automaticamente.</div>`;
    return;
  }
  if (state.mode === "dev") {
    panel.innerHTML = `<div class="inspector-title"><strong>${icon("code")}Inspeção de código</strong><small>CSS da geometria e estilo selecionados</small></div>${n ? `<section class="inspector-section"><h3>${esc(n.name)}</h3><pre id="css-output">${esc(cssFor(n))}</pre><button class="text-button" data-action="copy-css">Copiar CSS</button></section>` : '<p class="inspector-empty">Selecione um elemento para inspecionar suas propriedades.</p>'}<section class="inspector-section"><h3>Exportar documento</h3><button class="text-button" data-action="export-svg">${icon("download")} SVG</button><button class="text-button" data-action="export-png">${icon("download")} PNG</button><button class="text-button" data-action="export-html">HTML / Motion</button><button class="text-button" data-action="export-react">React</button><button class="text-button" data-action="export-json">${icon("download")} JSON</button><p class="muted">HTML inclui as interações e animações suportadas. React exporta o visual em SVG. Layout responsivo exige implementação adicional.</p></section>`;
    return;
  }
  if (!n) {
    panel.innerHTML = `<div class="inspector-title"><strong>Design</strong><small>Página 1</small></div><p class="inspector-empty">Selecione uma camada para editar sua posição, tamanho e estilo.<br><br>Use a barra inferior para adicionar formas, frames e texto.</p><section class="inspector-section"><h3>Atalhos</h3><p class="muted">V · selecionar<br>H · mover canvas<br>R · retângulo<br>O · elipse<br>T · texto<br>F · frame<br>Shift+1 · ajustar<br>Ctrl+Z · desfazer</p></section>`;
    return;
  }
  panel.innerHTML = `<div class="inspector-title"><strong>${icon(n.type === "text" ? "text" : "component")}<input data-property="name" aria-label="Nome do elemento" value="${esc(n.name)}"></strong><small>${n.type === "frame" ? "Frame" : n.type === "text" ? "Texto" : n.type === "ellipse" ? "Elipse" : n.type === "icon" ? "Ícone" : "Retângulo"} · ${esc(n.id.slice(0, 12))}</small></div><section class="inspector-section"><h3>Layout</h3><div class="property-grid">${property("x", "X", n.x)}${property("y", "Y", n.y)}${property("width", "W", n.width)}${property("height", "H", n.height)}${property("radius", "Raio", n.radius ?? 0)}${property("opacity", "α", n.opacity ?? 1)}</div></section><section class="inspector-section"><h3>Estilo</h3><div class="color-field"><input type="color" data-property="fill" aria-label="Cor de preenchimento" value="${/^#[0-9a-f]{6}$/i.test(n.fill) ? n.fill : "#FFFFFF"}"><input type="text" data-property="fill" aria-label="Preenchimento hexadecimal" value="${esc(n.fill ?? "#FFFFFF")}"></div><div class="property-grid" style="margin-top:16px">${property("stroke", "Borda", n.stroke ?? "none", "text")}${property("strokeWidth", "px", n.strokeWidth ?? 0)}</div></section>${n.type === "text" ? `<section class="inspector-section"><h3>Tipografia</h3><textarea id="node-text" data-property="text" aria-label="Conteúdo do texto">${esc(n.text ?? "")}</textarea><select data-property="fontFamily" aria-label="Família da fonte">${["Inter", "Manrope", "JetBrains Mono", "sans-serif", "monospace", ...(state.project.document.fonts || []).map((f) => f.id)].map((f) => `<option ${n.fontFamily === f ? "selected" : ""}>${f}</option>`).join("")}</select><div class="property-grid">${property("fontSize", "Tamanho", n.fontSize ?? 16)}<label class="field"><span>Peso</span><select data-property="fontWeight" aria-label="Peso da fonte">${[400, 500, 600, 700].map((w) => `<option ${n.fontWeight === w ? "selected" : ""}>${w}</option>`).join("")}</select></label></div></section>` : ""}<section class="inspector-section"><button class="danger-button" data-action="delete">${icon("trash")} Excluir elemento</button></section><div class="inspector-foot">Alterações salvas no servidor</div>`;
  workbench.decorateInspector(panel, n);
  panel.querySelectorAll("[data-property]").forEach((input) =>
    input.addEventListener("change", () => {
      const key = input.dataset.property;
      const numeric = [
        "x",
        "y",
        "width",
        "height",
        "radius",
        "opacity",
        "strokeWidth",
        "fontSize",
        "fontWeight",
      ];
      commit([
        {
          type: "update_node",
          id: n.id,
          changes: {
            [key]: numeric.includes(key) ? Number(input.value) : input.value,
          },
        },
      ]);
    }),
  );
}
function cssFor(n) {
  return `position: absolute;\nleft: ${n.x}px;\ntop: ${n.y}px;\nwidth: ${n.width}px;\nheight: ${n.height}px;\n${n.type === "text" ? `color: ${n.fill ?? "#242735"};\nfont-family: "${n.fontFamily ?? "Inter"}", sans-serif;\nfont-size: ${n.fontSize ?? 16}px;\nfont-weight: ${n.fontWeight ?? 400};` : `background: ${n.fill === "none" ? "transparent" : (n.fill ?? "#FFFFFF")};\nborder-radius: ${n.type === "ellipse" ? "50%" : `${n.radius ?? 0}px`};`}\nopacity: ${n.opacity ?? 1};${n.stroke && n.stroke !== "none" ? `\nborder: ${n.strokeWidth ?? 1}px solid ${n.stroke};` : ""}`;
}
async function renderHistory() {
  const projectId = state.project.id;
  $("#inspector").innerHTML =
    '<div class="inspector-title"><strong>Histórico de revisões</strong><small>Carregando…</small></div>';
  try {
    const items = await api(`/api/projects/${projectId}/history`);
    if (state.project?.id !== projectId || state.mode !== "history") return;
    $("#inspector").innerHTML =
      `<div class="inspector-title"><strong>${icon("history")}Histórico de revisões</strong><small>Snapshots completos · até 100 revisões recentes</small></div>${items.map((item) => `<article class="history-item"><span class="revision-badge">r${item.revision}</span><strong>${esc(item.author)}</strong><small>${new Date(item.createdAt).toLocaleString("pt-BR")}</small><p>${esc(item.summary)}</p>${item.revision !== state.project.revision ? `<button data-restore="${item.revision}">Restaurar esta revisão</button>` : "<small>Revisão atual</small>"}</article>`).join("")}`;
  } catch (e) {
    notice(e.message, true);
  }
}
async function commit(
  operations,
  { restoreRevision, track = true, retryPayload } = {},
) {
  if (state.busy) {
    notice("Aguarde a gravação atual.");
    return false;
  }
  const projectId = state.project.id;
  const before = retryPayload?.baseRevision ?? state.project.revision;
  state.busy = true;
  updateStatus();
  const payload = retryPayload ?? {
    baseRevision: before,
    operationId: uuid(),
    author: browserAuthor,
    ...(restoreRevision === undefined ? { operations } : { restoreRevision }),
  };
  try {
    const result = await api(
      `/api/projects/${projectId}/${restoreRevision === undefined ? "operations" : "restore"}`,
      payload,
    );
    if (state.project?.id !== projectId) return false;
    if (track) {
      state.undo.push(before);
      state.redo = [];
    }
    if (result.revision >= state.project.revision)
      state.project = {
        ...state.project,
        document: result.document,
        revision: result.revision,
      };
    state.pending = null;
    $("#notice").hidden = true;
    refresh();
    return true;
  } catch (e) {
    if (state.project?.id !== projectId) return false;
    state.pending = {
      operations,
      restoreRevision,
      payload,
      uncertain: !e.status,
    };
    try {
      state.project = await api(`/api/projects/${projectId}`);
    } catch {
      state.online = false;
    }
    refresh();
    notice(
      `${e.message}. ${e.status ? "Sua alteração não foi aplicada." : "A confirmação do envio não chegou. Repita o mesmo pedido para verificar o resultado."}`,
      true,
      true,
    );
    return false;
  } finally {
    state.busy = false;
    updateStatus();
  }
}
async function addNode(type) {
  const doc = workbench.visibleDocument();
  const root = doc.nodes.find((n) => n.type === "frame" && !n.parentId);
  const uid = uuid();
  const parent = type === "frame" ? null : root;
  const n = {
    id: uid,
    type,
    pageId: state.pageId,
    name: {
      frame: "Frame",
      rectangle: "Retângulo",
      ellipse: "Elipse",
      text: "Texto",
    }[type],
    x: parent
      ? Math.round(parent.width * 0.35)
      : Math.round(bounds(doc.nodes).width + 70),
    y: parent ? Math.round(parent.height * 0.35) : 0,
    width: type === "frame" ? 640 : type === "text" ? 220 : 160,
    height: type === "frame" ? 480 : type === "text" ? 40 : 110,
    fill:
      type === "text" ? "#242735" : type === "frame" ? "#FFFFFF" : "#328BFF",
    radius: type === "ellipse" ? 0 : 8,
  };
  if (parent) n.parentId = parent.id;
  if (type === "text")
    Object.assign(n, {
      text: "Seu texto aqui",
      fontSize: 24,
      fontFamily: "Inter",
      fontWeight: 500,
    });
  if (await commit([{ type: "create_node", node: n }])) {
    select(uid);
    if (type === "frame") fit();
  }
}
function newProject() {
  dialog.className = "";
  dialog.innerHTML = `<form id="create-form"><h2>Novo canvas</h2><p>Um espaço para a próxima ideia. Escolha um formato para começar.</p><label>Nome do canvas<input name="name" required maxlength="160" placeholder="Meu projeto" autocomplete="off"></label><div class="canvas-presets" role="group" aria-label="Formato inicial"><button type="button" class="preset-card selected" data-preset="desktop" aria-pressed="true"><span class="preset-preview desktop-preview"></span><strong>Desktop</strong><small>960 × 640</small></button><button type="button" class="preset-card" data-preset="mobile" aria-pressed="false"><span class="preset-preview mobile-preview"></span><strong>Mobile</strong><small>390 × 844</small></button><button type="button" class="preset-card" data-preset="square" aria-pressed="false"><span class="preset-preview square-preview"></span><strong>Quadrado</strong><small>800 × 800</small></button></div><div class="canvas-dimensions"><label>Largura<input name="width" type="number" min="1" max="20000" value="960" required></label><span>×</span><label>Altura<input name="height" type="number" min="1" max="20000" value="640" required></label><span class="dimension-unit">px</span></div><footer><button type="button" class="text-button" data-action="close-dialog">Cancelar</button><button class="primary" type="submit">Criar canvas</button></footer></form>`;
  dialog.showModal();
  dialog.querySelector("input").focus();
  dialog.querySelectorAll("[data-preset]").forEach(
    (button) =>
      (button.onclick = () => {
        const size = {
          desktop: [960, 640],
          mobile: [390, 844],
          square: [800, 800],
        }[button.dataset.preset];
        dialog.querySelector("[name=width]").value = size[0];
        dialog.querySelector("[name=height]").value = size[1];
        dialog.querySelectorAll("[data-preset]").forEach((b) => {
          b.classList.toggle("selected", b === button);
          b.setAttribute("aria-pressed", String(b === button));
        });
      }),
  );
  $("#create-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = e.target.querySelector("[type=submit]");
    button.disabled = true;
    try {
      const data = new FormData(e.target),
        name = data.get("name");
      const project = await api("/api/projects", {
        document: {
          schemaVersion: 1,
          name,
          nodes: [
            {
              id: uuid(),
              type: "frame",
              name: "Frame 1",
              x: 0,
              y: 0,
              width: Number(data.get("width")),
              height: Number(data.get("height")),
              fill: "#FAFAFC",
              radius: 8,
            },
          ],
        },
      });
      dialog.close();
      await openProject(project.id);
    } catch (err) {
      notice(err.message, true);
    } finally {
      button.disabled = false;
    }
  });
}
function preview() {
  if (state.project.document.interactions?.length) {
    workbench.act("play-prototype");
    return;
  }
  dialog.className = "preview-dialog";
  dialog.innerHTML = `<footer><span>${esc(state.project.document.name)} <span class="muted">· prévia visual</span></span><button class="icon-button" data-action="close-dialog" aria-label="Fechar prévia">${icon("close")}</button></footer><div class="preview-content">${renderSvg(state.project.document)}</div>`;
  dialog.showModal();
}
async function exportFile(format) {
  const p = state.project;
  let blob;
  if (format === "json")
    blob = new Blob([JSON.stringify(p.document, null, 2)], {
      type: "application/json",
    });
  else {
    const r = await fetch(`/api/projects/${p.id}/render?format=${format}`);
    if (!r.ok) throw new Error((await r.json()).error);
    blob = await r.blob();
  }
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `imhotep-r${p.revision}.${format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function undo() {
  if (!state.undo.length) return;
  const target = state.undo.pop(),
    current = state.project.revision;
  if (await commit(null, { restoreRevision: target, track: false })) {
    state.redo.push(current);
    updateStatus();
  } else state.undo.push(target);
}
async function redo() {
  if (!state.redo.length) return;
  const target = state.redo.pop(),
    current = state.project.revision;
  if (await commit(null, { restoreRevision: target, track: false })) {
    state.undo.push(current);
    updateStatus();
  } else state.redo.push(target);
}
async function action(name) {
  if (name === "dismiss") {
    $("#notice").hidden = true;
    return;
  }
  if (name === "new") return newProject();
  if (name === "close-dialog") return dialog.close();
  if (name === "home") {
    if (state.busy) return;
    return home();
  }
  if (name === "theme") {
    document.body.classList.toggle("light");
    localStorage.setItem(
      "imhotep-theme",
      document.body.classList.contains("light") ? "light" : "dark",
    );
    return;
  }
  if (!state.project) return;
  if (await workbench.act(name)) return;
  if (["design", "dev", "agents", "history"].includes(name)) {
    workbench.stopMotion();
    renderScene();
    state.mode = name;
    app
      .querySelectorAll(".mode-switch button")
      .forEach((b) => b.classList.toggle("active", b.dataset.action === name));
    renderInspector();
    return;
  }
  if (name.startsWith("add-")) return addNode(name.slice(4));
  if (name === "delete" && selected()) {
    const n = selected();
    return commit([{ type: "delete_node", id: n.id }]);
  }
  if (name === "fit") return fit();
  if (name === "zoom-in") return zoom(1.2);
  if (name === "zoom-out") return zoom(1 / 1.2);
  if (name === "undo") return undo();
  if (name === "redo") return redo();
  if (name === "preview") return preview();
  if (name.startsWith("export-")) return exportFile(name.slice(7));
  if (name === "copy-css" && selected()) {
    await copyText(cssFor(selected()));
    notice("CSS copiado.");
    return;
  }
  if (name === "retry" && state.pending) {
    const { operations, restoreRevision, payload, uncertain } = state.pending;
    return commit(operations, {
      restoreRevision,
      retryPayload: uncertain ? payload : undefined,
    });
  }
  if (name === "select" || name === "pan") {
    state.pan = name === "pan";
    $(".canvas-surface").style.cursor = state.pan ? "grab" : "default";
    $('[data-action="pan"]').classList.toggle("active", state.pan);
    $('[data-action="select"]').classList.toggle("active", !state.pan);
  }
}
document.addEventListener("click", async (e) => {
  const target = e.target.closest("button");
  if (!target || target.disabled) return;
  try {
    if (target.dataset.project)
      return await openProject(target.dataset.project);
    if (target.dataset.select) return select(target.dataset.select, e.shiftKey);
    if (target.dataset.restore !== undefined) {
      const revision = Number(target.dataset.restore);
      dialog.className = "";
      dialog.innerHTML = `<h2>Restaurar revisão ${revision}?</h2><p>O documento inteiro voltará a este estado. O estado atual continuará disponível no histórico.</p><footer><button class="text-button" data-action="close-dialog">Cancelar</button><button class="primary" id="confirm-restore">Restaurar</button></footer>`;
      dialog.showModal();
      $("#confirm-restore").onclick = async () => {
        dialog.close();
        await commit(null, { restoreRevision: revision });
      };
      return;
    }
    if (target.dataset.action) await action(target.dataset.action);
  } catch (err) {
    notice(err.message, true);
  }
});
document.addEventListener("keydown", async (e) => {
  if (e.defaultPrevented) return;
  if (
    !state.project ||
    dialog.open ||
    e.target.closest("input,textarea,select")
  )
    return;
  const modifier = e.ctrlKey || e.metaKey;
  try {
    if (modifier && e.key.toLowerCase() === "z") {
      e.preventDefault();
      return e.shiftKey ? await redo() : await undo();
    }
    if (modifier || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === "delete" || key === "backspace") {
      e.preventDefault();
      return action("delete");
    }
    if (key === "escape") return select(null);
    if (e.shiftKey && e.key === "!") {
      e.preventDefault();
      return fit();
    }
    const keys = {
      v: "select",
      h: "pan",
      r: "add-rectangle",
      o: "add-ellipse",
      t: "add-text",
      f: "add-frame",
    };
    if (keys[key]) {
      e.preventDefault();
      await action(keys[key]);
    }
  } catch (err) {
    notice(err.message, true);
  }
});
window.addEventListener("resize", () => {
  if (state.project) renderScene();
});
try {
  if (localStorage.getItem("imhotep-theme") === "light")
    document.body.classList.add("light");
  const projectId = new URLSearchParams(location.search).get("project");
  if (projectId) await openProject(projectId);
  else await home();
} catch (e) {
  app.innerHTML = `<div class="loading"><div>Não foi possível abrir o workspace.<p class="muted">${esc(e.message)}</p><button class="primary" data-action="home">Tentar novamente</button></div></div>`;
}
