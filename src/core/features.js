import * as fontkit from "fontkit";
import { assert } from "./document.js";
export function validateFeatures(doc) {
  doc.pages ??= [{ id: "page-1", name: "Página 1" }];
  assert(
    Array.isArray(doc.pages) && doc.pages.length > 0 && doc.pages.length <= 100,
    "Páginas inválidas",
  );
  const pages = new Set();
  for (const p of doc.pages) {
    assert(
      p &&
        /^[\w-]{1,100}$/.test(p.id) &&
        typeof p.name === "string" &&
        p.name.trim() &&
        p.name.length <= 100 &&
        !pages.has(p.id),
      "Página inválida",
    );
    pages.add(p.id);
  }
  const nodes = new Map(doc.nodes.map((n) => [n.id, n]));
  for (const n of doc.nodes) {
    for (const key of ["wrap", "clip"])
      if (n[key] !== undefined)
        assert(typeof n[key] === "boolean", "Opção de layout inválida");
    if (n.semanticTag !== undefined)
      assert(
        [
          "div",
          "section",
          "main",
          "header",
          "footer",
          "article",
          "button",
          "p",
          "h1",
          "h2",
          "h3",
          "span",
          "nav",
        ].includes(n.semanticTag),
        "Tag semântica inválida",
      );
    if (n.constraints !== undefined)
      assert(
        n.constraints &&
          typeof n.constraints === "object" &&
          !Array.isArray(n.constraints) &&
          Object.keys(n.constraints).every((k) =>
            ["horizontal", "vertical"].includes(k),
          ) &&
          ["left", "right", "center", "stretch", "scale"].includes(
            n.constraints.horizontal,
          ) &&
          ["top", "bottom", "center", "stretch", "scale"].includes(
            n.constraints.vertical,
          ),
        "Constraints inválidos",
      );
    n.pageId ??= doc.pages[0].id;
    assert(pages.has(n.pageId), "Página do elemento não existe");
    if (n.parentId)
      assert(
        nodes.get(n.parentId)?.pageId === n.pageId,
        "Pai em página diferente",
      );
    if (n.rotation !== undefined)
      assert(
        Number.isFinite(n.rotation) && Math.abs(n.rotation) <= 36000,
        "Rotação inválida",
      );
    if (n.pathData !== undefined)
      assert(
        typeof n.pathData === "string" &&
          n.pathData.length <= 20000 &&
          /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$/.test(n.pathData),
        "Caminho vetorial inválido",
      );
    if (n.type === "path") assert(n.pathData, "Caminho obrigatório");
    for (const key of ["pathWidth", "pathHeight"])
      if (n[key] !== undefined)
        assert(
          Number.isFinite(n[key]) && n[key] > 0 && n[key] <= 40000,
          "Dimensão vetorial inválida",
        );
    assert(
      (n.pathWidth !== undefined) === (n.pathHeight !== undefined),
      "Informe largura e altura de referência do vetor juntas",
    );
    if (n.type === "image")
      assert(
        typeof n.src === "string" &&
          n.src.length <= 1_000_000 &&
          /^data:image\/(png|webp|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(n.src),
        "Imagem inválida",
      );
    if (n.layout !== undefined)
      assert(
        ["none", "horizontal", "vertical"].includes(n.layout),
        "Auto layout inválido",
      );
    for (const k of ["gap", "padding"])
      if (n[k] !== undefined)
        assert(
          Number.isFinite(n[k]) && n[k] >= 0 && n[k] <= 2000,
          "Espaçamento inválido",
        );
    for (const k of ["componentId", "sourceId", "componentSetId", "variant"])
      if (n[k] !== undefined)
        assert(
          typeof n[k] === "string" && n[k].length <= 100,
          "Referência de componente inválida",
        );
    if (n.componentMain !== undefined)
      assert(typeof n.componentMain === "boolean", "Componente inválido");
    if (n.componentId)
      assert(
        nodes.get(n.componentId)?.componentMain,
        "Componente principal não existe",
      );
  }
  doc.interactions ??= [];
  doc.animations ??= [];
  assert(Array.isArray(doc.animations), "Animações inválidas");
  doc.flows ??= [];
  assert(
    Array.isArray(doc.flows) && doc.flows.length <= 50,
    "Fluxos inválidos",
  );
  const flowIds = new Set();
  for (const flow of doc.flows) {
    assert(
      flow &&
        /^[\w-]{1,100}$/.test(flow.id) &&
        !flowIds.has(flow.id) &&
        typeof flow.name === "string" &&
        flow.name.trim() &&
        flow.name.length <= 100 &&
        nodes.get(flow.startFrameId)?.type === "frame" &&
        !nodes.get(flow.startFrameId).parentId,
      "Fluxo inválido",
    );
    flowIds.add(flow.id);
  }
  doc.tokens ??= [];
  assert(
    Array.isArray(doc.tokens) && doc.tokens.length <= 500,
    "Tokens inválidos",
  );
  const tokenIds = new Set();
  for (const t of doc.tokens) {
    assert(
      t &&
        typeof t.id === "string" &&
        /^[\w-]{1,100}$/.test(t.id) &&
        !tokenIds.has(t.id) &&
        typeof t.name === "string" &&
        t.name.length <= 100 &&
        ["color", "number", "string"].includes(t.type),
      "Token inválido",
    );
    tokenIds.add(t.id);
    assert(
      t.type === "number"
        ? Number.isFinite(t.value) && t.value >= 0 && t.value <= 2000
        : typeof t.value === "string" && t.value.length <= 200,
      "Valor do token inválido",
    );
    if (t.type === "color")
      assert(
        /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(t.value),
        "Cor do token inválida",
      );
  }
  doc.fonts ??= [];
  assert(
    Array.isArray(doc.fonts) && doc.fonts.length <= 20,
    "Fontes inválidas",
  );
  const fontIds = new Set();
  for (const f of doc.fonts) {
    assert(
      f &&
        /^[\w-]{1,100}$/.test(f.id) &&
        !fontIds.has(f.id) &&
        typeof f.name === "string" &&
        f.name.length <= 100 &&
        typeof f.data === "string" &&
        f.data.length <= 1_000_000 &&
        /^data:font\/(ttf|otf|woff|woff2);base64,[a-zA-Z0-9+/=]+$/.test(f.data),
      "Fonte local inválida",
    );
    try {
      const parsed = fontkit.create(
        Buffer.from(f.data.split(",")[1], "base64"),
      );
      assert(
        typeof parsed.layout === "function",
        "Coleções de fontes não suportadas",
      );
    } catch {
      assert(false, "Arquivo de fonte inválido");
    }
    fontIds.add(f.id);
  }
  for (const n of doc.nodes) {
    if (n.instanceOverrides !== undefined)
      assert(
        Array.isArray(n.instanceOverrides) &&
          n.instanceOverrides.length <= 40 &&
          n.instanceOverrides.every(
            (k) => typeof k === "string" && k.length <= 100,
          ),
        "Overrides inválidos",
      );
    if (n.tokenBindings !== undefined) {
      assert(
        n.tokenBindings &&
          typeof n.tokenBindings === "object" &&
          !Array.isArray(n.tokenBindings),
        "Bindings inválidos",
      );
      for (const [key, id] of Object.entries(n.tokenBindings)) {
        const t = doc.tokens.find((t) => t.id === id);
        assert(
          t &&
            ((key === "fill" && t.type === "color") ||
              (key === "gap" && t.type === "number") ||
              (key === "text" && t.type === "string")),
          "Binding de token inválido",
        );
      }
    }
  }
  assert(
    Array.isArray(doc.interactions) && doc.interactions.length <= 1000,
    "Interações inválidas",
  );
  const interactionIds = new Set();
  for (const i of doc.interactions) {
    assert(
      i &&
        /^[\w-]{1,100}$/.test(i.id) &&
        !interactionIds.has(i.id) &&
        nodes.has(i.nodeId) &&
        [
          "click",
          "hover",
          "mouse-leave",
          "press",
          "release",
          "key",
          "after-delay",
        ].includes(i.trigger) &&
        ["navigate", "overlay", "back", "close", "animate"].includes(
          i.action,
        ) &&
        [
          "instant",
          "dissolve",
          "slide",
          "push",
          "move-in",
          "move-out",
        ].includes(i.transition),
      "Interação inválida",
    );
    interactionIds.add(i.id);
    if (["navigate", "overlay"].includes(i.action))
      assert(
        nodes.get(i.targetId)?.type === "frame" &&
          !nodes.get(i.targetId).parentId,
        "Destino precisa ser frame",
      );
    assert(
      Number.isFinite(i.duration) && i.duration >= 0 && i.duration <= 10000,
      "Duração inválida",
    );
    if (i.delay !== undefined)
      assert(
        Number.isFinite(i.delay) && i.delay >= 0 && i.delay <= 60000,
        "Atraso inválido",
      );
    if (i.trigger === "key")
      assert(
        typeof i.key === "string" && i.key.length > 0 && i.key.length <= 40,
        "Tecla inválida",
      );
    if (i.action === "animate")
      assert(
        doc.animations.some((a) => a?.id === i.animationId),
        "Animação da interação não existe",
      );
  }
  assert(
    Array.isArray(doc.animations) && doc.animations.length <= 500,
    "Animações inválidas",
  );
  const animationIds = new Set();
  for (const a of doc.animations) {
    assert(
      a &&
        /^[\w-]{1,100}$/.test(a.id) &&
        !animationIds.has(a.id) &&
        nodes.has(a.nodeId) &&
        Number.isFinite(a.duration) &&
        a.duration > 0 &&
        a.duration <= 60000 &&
        ["linear", "ease-in", "ease-out", "ease-in-out"].includes(a.easing) &&
        Array.isArray(a.keyframes) &&
        a.keyframes.length >= 2 &&
        a.keyframes.length <= 100,
      "Animação inválida",
    );
    animationIds.add(a.id);
    let previous = -1;
    for (const f of a.keyframes) {
      assert(
        f &&
          Number.isFinite(f.time) &&
          f.time >= 0 &&
          f.time <= a.duration &&
          f.time > previous &&
          f.values &&
          typeof f.values === "object",
        "Keyframe inválido",
      );
      previous = f.time;
      for (const [k, v] of Object.entries(f.values)) {
        assert(
          ["x", "y", "width", "height", "opacity", "rotation"].includes(k) &&
            Number.isFinite(v) &&
            Math.abs(v) <= 20000,
          "Propriedade de animação inválida",
        );
        if (k === "opacity") assert(v >= 0 && v <= 1, "Opacidade inválida");
        if (k === "width" || k === "height") assert(v > 0, "Dimensão inválida");
      }
    }
  }
  return doc;
}
export function applyFeature(doc, op) {
  if (op.type === "set_project_data") {
    assert(
      [
        "pages",
        "tokens",
        "interactions",
        "animations",
        "fonts",
        "flows",
      ].includes(op.field),
      "Campo de projeto inválido",
    );
    doc[op.field] = structuredClone(op.value);
    if (op.field === "tokens")
      for (const n of doc.nodes)
        if (n.tokenBindings) {
          for (const [key, id] of Object.entries(n.tokenBindings))
            if (!doc.tokens.some((t) => t.id === id))
              delete n.tokenBindings[key];
        }

    return true;
  }
  if (op.type === "delete_page") {
    assert(doc.pages.length > 1, "O projeto precisa de ao menos uma página");
    assert(
      doc.pages.some((p) => p.id === op.id),
      "Página não encontrada",
    );
    doc.pages = doc.pages.filter((p) => p.id !== op.id);
    doc.nodes = doc.nodes.filter((n) => n.pageId !== op.id);
    maintainFeatures(doc);
    return true;
  }
  if (op.type === "rename_page") {
    const p = doc.pages.find((p) => p.id === op.id);
    assert(p, "Página não encontrada");
    p.name = op.name;
    return true;
  }
  if (op.type === "reorder_node") {
    const index = doc.nodes.findIndex((n) => n.id === op.id);
    assert(index >= 0, "Elemento não existe");
    assert(
      Number.isInteger(op.index) &&
        op.index >= 0 &&
        op.index < doc.nodes.length,
      "Índice inválido",
    );
    const [n] = doc.nodes.splice(index, 1);
    doc.nodes.splice(op.index, 0, n);
    return true;
  }
  if (op.type === "create_component") {
    const n = doc.nodes.find((n) => n.id === op.id);
    assert(n?.type === "frame", "Selecione um frame para criar componente");
    n.componentMain = true;
    n.componentId = n.id;
    n.componentSetId = op.setId || n.id;
    n.variant = op.variant || "Padrão";
    return true;
  }
  if (op.type === "instantiate_component") {
    const source = doc.nodes.find(
      (n) => n.id === op.componentId && n.componentMain,
    );
    assert(source, "Componente não encontrado");
    assert(
      /^[\w-]{1,60}$/.test(op.id) && !doc.nodes.some((n) => n.id === op.id),
      "ID de instância inválido",
    );
    const subtree = [source];
    for (let i = 0; i < subtree.length; i++)
      subtree.push(...doc.nodes.filter((n) => n.parentId === subtree[i].id));
    const mapping = new Map(
      subtree.map((n, i) => [n.id, i ? `${op.id}-${i}` : op.id]),
    );
    for (const original of subtree) {
      const n = structuredClone(original);
      n.id = mapping.get(original.id);
      n.parentId =
        original === source ? undefined : mapping.get(original.parentId);
      n.pageId = op.pageId || source.pageId;
      n.sourceId = original.id;
      delete n.componentMain;
      delete n.componentId;
      delete n.componentSetId;
      delete n.variant;
      if (original === source) {
        n.componentId = source.id;
        n.x = op.x ?? source.x + source.width + 50;
        n.y = op.y ?? source.y;
      }
      if (n.parentId === undefined) delete n.parentId;
      doc.nodes.push(n);
    }
    return true;
  }
  return false;
}
export function maintainFeatures(doc) {
  const ids = new Set(doc.nodes.map((n) => n.id));
  if (doc.interactions)
    doc.interactions = doc.interactions.filter(
      (i) => ids.has(i.nodeId) && (!i.targetId || ids.has(i.targetId)),
    );
  if (doc.animations)
    doc.animations = doc.animations.filter((a) => ids.has(a.nodeId));
  if (doc.interactions)
    doc.interactions = doc.interactions.filter(
      (i) =>
        i.action !== "animate" ||
        doc.animations?.some((a) => a.id === i.animationId),
    );
  if (doc.flows) doc.flows = doc.flows.filter((f) => ids.has(f.startFrameId));
  for (const n of doc.nodes)
    if (n.componentId && !ids.has(n.componentId)) {
      delete n.componentId;
      delete n.sourceId;
    }
  return doc;
}
