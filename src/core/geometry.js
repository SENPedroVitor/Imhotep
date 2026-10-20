import paper from "paper";
import { assert } from "./document.js";
import { pathData } from "../../public/vector.js";
import { layoutDocument } from "../../public/renderer.js";
function geometry(scope, node) {
  if (node.type === "rectangle")
    return new scope.Path.Rectangle({
      rectangle: [0, 0, node.width, node.height],
      radius: Math.min(node.radius || 0, node.width / 2, node.height / 2),
      insert: false,
    });
  if (node.type === "ellipse")
    return new scope.Path.Ellipse({
      rectangle: [0, 0, node.width, node.height],
      insert: false,
    });
  assert(node.type === "path", "Selecione formas ou paths para esta operação");
  let path;
  try {
    path = new scope.CompoundPath({ pathData: node.pathData, insert: false });
  } catch {
    assert(false, "A geometria SVG não pôde ser interpretada");
  }
  if (node.pathWidth && node.pathHeight)
    path.scale(
      node.width / node.pathWidth,
      node.height / node.pathHeight,
      new scope.Point(0, 0),
    );
  return path;
}
function canonical(item) {
  const paths = item.children || [item];
  return pathData(
    paths.map((p) => ({
      closed: p.closed,
      points: p.segments.map((s) => ({
        x: s.point.x,
        y: s.point.y,
        in: { x: s.point.x + s.handleIn.x, y: s.point.y + s.handleIn.y },
        out: { x: s.point.x + s.handleOut.x, y: s.point.y + s.handleOut.y },
      })),
    })),
  );
}
export function geometryOperation(doc, op) {
  if (!["normalize_path", "boolean_nodes"].includes(op.type)) return false;
  const scope = new paper.PaperScope();
  scope.setup(new scope.Size(1, 1));
  try {
    if (op.type === "normalize_path") {
      const n = doc.nodes.find((n) => n.id === op.id);
      assert(n, "Elemento não encontrado", 404);
      assert(
        !n.componentId &&
          !n.sourceId &&
          !doc.nodes.some((copy) => copy.sourceId === n.id),
        "Desvincule a instância antes de converter a geometria",
      );
      const path = geometry(scope, n);
      n.pathData = canonical(path);
      n.type = "path";
      n.pathWidth = n.width;
      n.pathHeight = n.height;
      delete n.radius;
      return true;
    }
    assert(
      ["unite", "subtract", "intersect", "exclude"].includes(op.operation),
      "Operação booleana inválida",
    );
    assert(
      Array.isArray(op.ids) &&
        op.ids.length >= 2 &&
        op.ids.length <= 20 &&
        new Set(op.ids).size === op.ids.length,
      "Selecione de 2 a 20 formas diferentes",
    );
    assert(
      typeof op.id === "string" &&
        /^[\w-]{1,100}$/.test(op.id) &&
        !doc.nodes.some((n) => n.id === op.id),
      "ID de resultado inválido",
    );
    const layout = layoutDocument(doc),
      nodes = op.ids.map((id) => layout.nodes.find((n) => n.id === id));
    assert(nodes.every(Boolean), "Forma não encontrada");
    const first = nodes[0];
    assert(
      nodes.every(
        (n) => n.pageId === first.pageId && n.parentId === first.parentId,
      ),
      "As formas precisam estar no mesmo frame e página",
    );
    assert(
      nodes.every(
        (n) =>
          !n.componentId &&
          !n.sourceId &&
          !n.componentMain &&
          !doc.nodes.some((copy) => copy.sourceId === n.id),
      ),
      "Desvincule os componentes antes de combinar formas",
    );
    let result;
    for (const n of nodes) {
      const path = geometry(scope, n);
      assert(
        (path.children || [path]).every((p) => p.closed),
        "Feche os contornos antes de aplicar uma operação booleana",
      );
      path.rotate(n.rotation || 0, new scope.Point(n.width / 2, n.height / 2));
      path.translate(new scope.Point(n.x, n.y));
      result = result ? result[op.operation](path, { insert: false }) : path;
    }
    const b = result.bounds.clone();
    assert(
      b.width > 0.00001 &&
        b.height > 0.00001 &&
        (result.children || [result]).reduce(
          (sum, p) => sum + Math.abs(p.area),
          0,
        ) > 0.00001,
      "O resultado está vazio; as formas foram preservadas",
    );
    result.translate(new scope.Point(-b.x, -b.y));
    const node = {
      id: op.id,
      type: "path",
      name: {
        unite: "União",
        subtract: "Subtração",
        intersect: "Interseção",
        exclude: "Exclusão",
      }[op.operation],
      pageId: first.pageId,
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      pathWidth: b.width,
      pathHeight: b.height,
      pathData: canonical(result),
    };
    if (first.parentId) node.parentId = first.parentId;
    for (const key of ["fill", "stroke", "strokeWidth", "opacity"])
      if (first[key] !== undefined) node[key] = first[key];
    const index = doc.nodes.findIndex((n) => n.id === first.id);
    doc.nodes.splice(index, 0, node);
    doc.nodes = doc.nodes.filter((n) => !op.ids.includes(n.id));
    doc.interactions = doc.interactions.filter(
      (i) => !op.ids.includes(i.nodeId) && !op.ids.includes(i.targetId),
    );
    doc.animations = doc.animations.filter((a) => !op.ids.includes(a.nodeId));
    doc.interactions = doc.interactions.filter(
      (i) =>
        i.action !== "animate" ||
        doc.animations.some((a) => a.id === i.animationId),
    );
    return true;
  } finally {
    scope.remove();
  }
}
