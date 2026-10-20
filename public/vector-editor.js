import { parsePath, pathData, splitCurve } from "./vector.js";
export function installVectorEditor(c) {
  let editing = null,
    draft = null,
    active = { contour: 0, index: 0 };
  const labels = {
    unite: "Unir",
    subtract: "Subtrair",
    intersect: "Intersectar",
    exclude: "Excluir sobreposição",
  };
  const button = (name, label) =>
    `<button class="text-button" data-work="${name}">${label}</button>`;
  function decorate(panel, n) {
    const count = c.state.selectedIds?.length || 0;
    if (!["rectangle", "ellipse", "path"].includes(n.type)) return;
    panel.insertAdjacentHTML(
      "beforeend",
      `<section class="inspector-section"><h3>Geometria</h3>${button(editing === n.id ? "finish-path" : "edit-path", editing === n.id ? "Concluir edição dos nós" : "Editar nós e alças")}${editing === n.id ? `<p class="muted">Arraste os pontos e alças. Shift espelha a alça oposta. As alterações são salvas ao soltar.</p>${button("split-path", "+ Inserir nó")}${button("smooth-point", "Suavizar nó")}${button("corner-point", "Converter em canto")}${button("delete-point", "Excluir nó")}` : ""}${
        count >= 2
          ? `<p class="muted">A primeira forma selecionada é a base da subtração.</p>${Object.entries(
              labels,
            )
              .map(([key, label]) => button("boolean-" + key, label))
              .join("")}`
          : ""
      }</section>`,
    );
  }
  function decorateScene(visibleDoc) {
    if (c.state.mode !== "design") return;
    const n =
      visibleDoc?.nodes.find((n) => n.id === c.state.selected) || c.selected();
    if (n?.id !== editing || n.type !== "path") return;
    if (draft && c.state.drag?.kind !== "vector") draft = null;
    let contours;
    try {
      contours = draft || parsePath(n.pathData);
    } catch {
      editing = null;
      return;
    }
    const group = document.querySelector(
      `#scene [data-node-id="${CSS.escape(n.id)}"]`,
    );
    if (!group) return;
    if (draft) group.querySelector("path").setAttribute("d", pathData(draft));
    const scaleX = n.width / (n.pathWidth || n.width),
      scaleY = n.height / (n.pathHeight || n.height),
      r = 5 / (c.state.view.scale * Math.max(scaleX, scaleY));
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svg.id = "vector-overlay";
    svg.setAttribute("transform", `scale(${scaleX} ${scaleY})`);
    svg.innerHTML = contours
      .map((contour, ci) =>
        contour.points
          .map((p, index) => {
            const attrs = `data-vector-point="" data-contour="${ci}" data-segment="${index}"`;
            return (
              ["in", "out"]
                .map(
                  (handle) =>
                    `<line x1="${p.x}" y1="${p.y}" x2="${p[handle].x}" y2="${p[handle].y}" stroke="#8BBEFF" stroke-width="${1 / c.state.view.scale}" pointer-events="none"/>${p[handle].x !== p.x || p[handle].y !== p.y ? `<circle ${attrs} data-handle="${handle}" cx="${p[handle].x}" cy="${p[handle].y}" r="${r * 0.8}" fill="#1C2029" stroke="#8BBEFF" stroke-width="${1 / c.state.view.scale}" role="button" aria-label="Alça ${handle === "in" ? "de entrada" : "de saída"} ${index + 1}"/>` : ""}`,
                )
                .join("") +
              `<rect ${attrs} data-handle="anchor" x="${p.x - r}" y="${p.y - r}" width="${r * 2}" height="${r * 2}" fill="${active.contour === ci && active.index === index ? "#328BFF" : "#fff"}" stroke="#328BFF" stroke-width="${1 / c.state.view.scale}" role="button" aria-label="Nó vetorial ${index + 1}" style="cursor:move"/>`
            );
          })
          .join(""),
      )
      .join("");
    group.append(svg);
  }
  function down(e) {
    const handle = e.target.closest("[data-vector-point]");
    if (!handle || e.button !== 0 || c.state.pan || e.altKey) return false;
    e.preventDefault();
    const n = c.selected();
    active = {
      contour: Number(handle.dataset.contour),
      index: Number(handle.dataset.segment),
    };
    draft = parsePath(n.pathData);
    c.state.drag = {
      kind: "vector",
      revision: c.state.project.revision,
      original: structuredClone(draft),
      handle: handle.dataset.handle,
      inverse: document
        .querySelector("#vector-overlay")
        .getScreenCTM()
        .inverse(),
      moved: false,
    };
    return true;
  }
  function move(e) {
    const drag = c.state.drag;
    if (drag?.kind !== "vector") return false;
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(
        drag.inverse,
      ),
      p = draft[active.contour].points[active.index],
      old = drag.original[active.contour].points[active.index];
    const x = Math.round(point.x * 100) / 100,
      y = Math.round(point.y * 100) / 100;
    if (drag.handle === "anchor") {
      p.x = x;
      p.y = y;
      for (const key of ["in", "out"])
        p[key] = { x: old[key].x + x - old.x, y: old[key].y + y - old.y };
    } else {
      p[drag.handle] = { x, y };
      if (e.shiftKey)
        p[drag.handle === "in" ? "out" : "in"] = {
          x: 2 * p.x - x,
          y: 2 * p.y - y,
        };
    }
    drag.moved = true;
    c.renderScene();
    return true;
  }
  async function up() {
    const drag = c.state.drag;
    if (drag?.kind !== "vector") return false;
    const data = pathData(draft);
    c.state.drag = null;
    draft = null;
    if (drag.revision !== c.state.project.revision) {
      c.notice("O canvas mudou. A edição da curva foi descartada.", true);
      c.renderScene();
      return true;
    }
    if (drag.moved)
      await c.commit([
        { type: "update_node", id: editing, changes: { pathData: data } },
      ]);
    c.renderScene();
    return true;
  }
  async function act(name) {
    if (name.startsWith("boolean-")) {
      const id = c.uuid();
      if (
        await c.commit([
          {
            type: "boolean_nodes",
            operation: name.slice(8),
            ids: c.state.selectedIds,
            id,
          },
        ])
      ) {
        editing = null;
        c.select(
          c.state.project.document.nodes.some((n) => n.id === id) ? id : null,
        );
      }
      return true;
    }
    if (name === "edit-path") {
      const n = c.selected();
      if (!n) return true;
      if (await c.commit([{ type: "normalize_path", id: n.id }])) {
        editing = n.id;
        active = { contour: 0, index: 0 };
        c.refresh();
      }
      return true;
    }
    if (name === "finish-path") {
      editing = null;
      draft = null;
      c.refresh();
      return true;
    }
    if (
      !["split-path", "smooth-point", "corner-point", "delete-point"].includes(
        name,
      )
    )
      return false;
    const n = c.selected();
    if (n?.id !== editing) return true;
    const contours = parsePath(n.pathData),
      contour = contours[active.contour],
      p = contour?.points[active.index];
    if (!p) return true;
    if (name === "split-path") {
      if (!splitCurve(contour, active.index)) {
        c.notice("Selecione um nó que tenha um segmento seguinte.");
        return true;
      }
      active.index++;
    } else if (name === "delete-point") {
      if (contour.points.length <= (contour.closed ? 3 : 2)) {
        c.notice("Mantenha ao menos dois nós, ou três em um contorno fechado.");
        return true;
      }
      contour.points.splice(active.index, 1);
      active.index = Math.max(0, active.index - 1);
    } else if (name === "corner-point") {
      p.in = { x: p.x, y: p.y };
      p.out = { x: p.x, y: p.y };
    } else {
      const prev =
          contour.points[
            (active.index - 1 + contour.points.length) % contour.points.length
          ],
        next = contour.points[(active.index + 1) % contour.points.length];
      const dx = (next.x - prev.x) / 6,
        dy = (next.y - prev.y) / 6;
      p.in = { x: p.x - dx, y: p.y - dy };
      p.out = { x: p.x + dx, y: p.y + dy };
    }
    await c.commit([
      {
        type: "update_node",
        id: n.id,
        changes: { pathData: pathData(contours) },
      },
    ]);
    return true;
  }
  return { decorate, decorateScene, down, move, up, act };
}
