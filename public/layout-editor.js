export function installLayoutEditor(c) {
  return {
    decorate(panel, n) {
      const parent = c.state.project.document.nodes.find(
        (p) => p.id === n.parentId,
      );
      const select = (key, label, options, value) =>
        `<label class="work-label">${label}<select aria-label="${label}" data-layout-option="${key}">${Object.entries(
          options,
        )
          .map(
            ([id, label]) =>
              `<option value="${id}" ${id === value ? "selected" : ""}>${label}</option>`,
          )
          .join("")}</select></label>`;
      const constraints = n.constraints || {
        horizontal: "left",
        vertical: "top",
      };
      panel.insertAdjacentHTML(
        "beforeend",
        `<section class="inspector-section"><h3>Layout responsivo</h3>${parent ? select("horizontal", "Constraint horizontal", { left: "Esquerda", right: "Direita", center: "Centro", stretch: "Esticar", scale: "Escalar" }, constraints.horizontal) + select("vertical", "Constraint vertical", { top: "Topo", bottom: "Base", center: "Centro", stretch: "Esticar", scale: "Escalar" }, constraints.vertical) : '<p class="muted">O frame exportado se adapta à largura disponível. Configure os filhos com constraints ou auto layout.</p>'}${n.type === "frame" ? `<label class="work-label layout-check"><input data-layout-flag="wrap" type="checkbox" ${n.wrap ? "checked" : ""}> Quebrar linha no auto layout</label><label class="work-label layout-check"><input data-layout-flag="clip" type="checkbox" ${n.clip ? "checked" : ""}> Recortar conteúdo do frame</label>` : ""}${["frame", "rectangle", "ellipse", "text"].includes(n.type) ? select("semanticTag", "Elemento HTML", { div: "Div", section: "Seção", main: "Conteúdo principal", header: "Cabeçalho", footer: "Rodapé", article: "Artigo", button: "Botão", p: "Parágrafo", h1: "Título H1", h2: "Título H2", h3: "Título H3", span: "Texto inline", nav: "Navegação" }, n.semanticTag || (n.type === "text" ? "p" : parent ? "div" : "section")) : ""}</section>`,
      );
      for (const input of panel.querySelectorAll("[data-layout-option]"))
        input.onchange = () => {
          const key = input.dataset.layoutOption;
          return c.commit([
            {
              type: "update_node",
              id: n.id,
              changes:
                key === "semanticTag"
                  ? { semanticTag: input.value }
                  : { constraints: { ...constraints, [key]: input.value } },
            },
          ]);
        };
      for (const input of panel.querySelectorAll("[data-layout-flag]"))
        input.onchange = () =>
          c.commit([
            {
              type: "update_node",
              id: n.id,
              changes: { [input.dataset.layoutFlag]: input.checked },
            },
          ]);
    },
  };
}
