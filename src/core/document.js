import { icons } from "../../public/icons.js";
import { randomUUID } from "node:crypto";
export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export const id = () => randomUUID();
export function assert(condition, message, status = 400) {
  if (!condition) throw new AppError(message, status);
}
export const nodeKeys = [
  "id",
  "type",
  "name",
  "parentId",
  "x",
  "y",
  "width",
  "height",
  "fill",
  "stroke",
  "strokeWidth",
  "radius",
  "opacity",
  "text",
  "fontSize",
  "fontFamily",
  "fontWeight",
  "icon",
];
const types = ["frame", "rectangle", "ellipse", "text", "icon"];
const color = /^(#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|none)$/i;
export function validateDocument(doc) {
  assert(doc && doc.schemaVersion === 1, "Versão de documento inválida");
  assert(
    typeof doc.name === "string" && doc.name.trim() && doc.name.length <= 160,
    "Nome inválido",
  );
  assert(
    Array.isArray(doc.nodes) && doc.nodes.length <= 2000,
    "Limite de 2000 elementos",
  );
  const ids = new Set();
  for (const n of doc.nodes) {
    assert(
      n &&
        typeof n === "object" &&
        Object.keys(n).every((k) => nodeKeys.includes(k)),
      "Propriedades de elemento inválidas",
    );
    assert(
      typeof n.id === "string" && /^[\w-]{1,100}$/.test(n.id) && !ids.has(n.id),
      "ID duplicado ou inválido",
    );
    ids.add(n.id);
    assert(types.includes(n.type), "Tipo de elemento não suportado");
    if (n.type === "icon")
      assert(Object.hasOwn(icons, n.icon), "Ícone não suportado");
    assert(
      typeof n.name === "string" && n.name.length <= 200,
      "Nome de elemento inválido",
    );
    for (const key of ["x", "y", "width", "height"])
      assert(
        Number.isFinite(n[key]) && Math.abs(n[key]) <= 20000,
        `Geometria inválida: ${key}`,
      );
    assert(n.width > 0 && n.height > 0, "Dimensões precisam ser positivas");
    for (const key of ["fill", "stroke"])
      if (n[key] !== undefined)
        assert(
          typeof n[key] === "string" && color.test(n[key]),
          "Cor inválida",
        );
    for (const key of ["strokeWidth", "radius", "fontSize"])
      if (n[key] !== undefined)
        assert(
          Number.isFinite(n[key]) && n[key] >= 0 && n[key] <= 1000,
          `${key} inválido`,
        );
    if (n.opacity !== undefined)
      assert(
        Number.isFinite(n.opacity) && n.opacity >= 0 && n.opacity <= 1,
        "Opacidade inválida",
      );
    if (n.text !== undefined)
      assert(
        typeof n.text === "string" && n.text.length <= 10000,
        "Texto inválido",
      );
    if (n.fontFamily !== undefined)
      assert(
        [
          "Inter",
          "Manrope",
          "JetBrains Mono",
          "sans-serif",
          "monospace",
        ].includes(n.fontFamily),
        "Fonte não suportada",
      );
    if (n.fontWeight !== undefined)
      assert([400, 500, 600, 700].includes(n.fontWeight), "Peso inválido");
    if (n.parentId !== undefined)
      assert(typeof n.parentId === "string", "Parent inválido");
  }
  const map = new Map(doc.nodes.map((n) => [n.id, n]));
  for (const n of doc.nodes) {
    const seen = new Set([n.id]);
    let p = n.parentId;
    while (p) {
      assert(map.has(p) && !seen.has(p), "Hierarquia inválida");
      assert(map.get(p).type === "frame", "Parent deve ser frame");
      seen.add(p);
      p = map.get(p).parentId;
    }
  }
  return doc;
}
export function applyOperations(document, operations) {
  assert(
    Array.isArray(operations) &&
      operations.length > 0 &&
      operations.length <= 200,
    "Lote deve conter de 1 a 200 operações",
  );
  const doc = structuredClone(document);
  for (const op of operations) {
    assert(op && typeof op === "object", "Operação inválida");
    if (op.type === "create_node") {
      assert(
        op.node && !doc.nodes.some((n) => n.id === op.node.id),
        "ID já existe",
      );
      doc.nodes.push(op.node);
    } else if (op.type === "update_node") {
      const n = doc.nodes.find((n) => n.id === op.id);
      assert(n, "Elemento não encontrado", 404);
      assert(
        op.changes &&
          Object.keys(op.changes).every(
            (k) => nodeKeys.includes(k) && !["id", "type"].includes(k),
          ),
        "Alteração inválida",
      );
      Object.assign(n, op.changes);
    } else if (op.type === "delete_node") {
      assert(
        doc.nodes.some((n) => n.id === op.id),
        "Elemento não encontrado",
        404,
      );
      const deleted = new Set([op.id]);
      let before;
      do {
        before = deleted.size;
        for (const n of doc.nodes)
          if (deleted.has(n.parentId)) deleted.add(n.id);
      } while (deleted.size !== before);
      doc.nodes = doc.nodes.filter((n) => !deleted.has(n.id));
    } else if (op.type === "rename_project") {
      doc.name = op.name;
    } else throw new AppError("Operação não suportada");
  }
  return validateDocument(doc);
}
export function blankDocument(name) {
  return validateDocument({
    schemaVersion: 1,
    name,
    nodes: [
      {
        id: id(),
        type: "frame",
        name: "Desktop",
        x: 0,
        y: 0,
        width: 960,
        height: 640,
        fill: "#FAFAFC",
        radius: 8,
      },
    ],
  });
}
