import { enter } from "./interface.js";
import { evaluateMotion } from "./motion.js";
import { renderSvg, position, layoutDocument } from "./renderer.js";
import { icons } from "./icons.js";
import { installVectorEditor } from "./vector-editor.js";
import { installLayoutEditor } from "./layout-editor.js";
export function installWorkbench(c) {
  const vector = installVectorEditor(c);
  const responsive = installLayoutEditor(c);
  const {
    state,
    api,
    commit,
    selected,
    select,
    refresh,
    renderScene,
    notice,
    uuid,
    dialog,
    fit,
    esc,
  } = c;
  let timer = null,
    providerList = [],
    sessions = [],
    loading = false,
    frameRequest = 0,
    motionTime = null,
    chatOpen = false,
    chatProject = null,
    submitting = false,
    applying = false,
    feedbackUntil = 0,
    feedbackTimer = null;
  const drafts = new Map();
  const presenceId = uuid();
  let presenceKey = "",
    presenceSentAt = 0,
    presenceTimer;
  function publishPresence() {
    if (!state.project || document.hidden) return;
    const projectId = state.project.id;
    const pageId = state.pageId || pages()[0].id;
    const nodeIds = (
      state.selectedIds || (state.selected ? [state.selected] : [])
    ).filter((id) =>
      current().nodes.some((n) => n.id === id && n.pageId === pageId),
    );
    const key = JSON.stringify({ projectId, pageId, nodeIds });
    if (key === presenceKey && Date.now() - presenceSentAt < 30000) return;
    presenceKey = key;
    presenceSentAt = Date.now();
    clearTimeout(presenceTimer);
    presenceTimer = setTimeout(
      () =>
        api(`/api/projects/${projectId}/selection`, {
          clientId: presenceId,
          pageId,
          nodeIds,
        }).catch(() => {
          presenceSentAt = 0;
        }),
      100,
    );
  }
  const current = () => state.project?.document;
  const button = (name, text) =>
    `<button class="text-button" data-work="${name}">${text}</button>`;
  const section = (title, content) =>
    `<section class="inspector-section"><h3>${title}</h3>${content}</section>`;
  const input = (name, label, value, type = "text") =>
    `<label class="work-label">${label}<input name="${name}" type="${type}" value="${esc(value ?? "")}" ${type === "number" ? 'step="any"' : ""}></label>`;
  function pages() {
    return current()?.pages || [{ id: "page-1", name: "Página 1" }];
  }
  function visibleDocument() {
    const doc = current();
    if (!doc) return null;
    if (!pages().some((p) => p.id === state.pageId))
      state.pageId = pages()[0].id;
    const result = {
      ...doc,
      nodes: doc.nodes.filter(
        (n) => (n.pageId || pages()[0].id) === state.pageId,
      ),
    };
    return layoutDocument(
      motionTime === null ? result : evaluateMotion(result, motionTime),
    );
  }
  function mount() {
    if (!state.project) {
      clearInterval(timer);
      timer = null;
      return;
    }
    const pill = document.querySelector(".page-pill");
    if (pill && !document.querySelector("#page-select"))
      pill.innerHTML = `<select id="page-select" aria-label="Página ativa"></select><button data-work="new-page" title="Nova página">+</button>`;
    updatePages();
    publishPresence();
    if (chatProject !== state.project.id) {
      chatProject = state.project.id;
      sessions = [];
      chatOpen = false;
      feedbackUntil = 0;
      clearTimeout(feedbackTimer);
      document.querySelector("#kendrick-popover")?.remove();
      queueMicrotask(() => loadSessions(false).catch(() => {}));
    }
    updateDock();
    const foot = document.querySelector(".sidebar .side-foot");
    if (foot && !document.querySelector(".work-nav"))
      foot.insertAdjacentHTML(
        "beforebegin",
        `<nav class="work-nav">${button("settings", "Workspace")}${button("prototype", "Protótipo")}${button("components", "Componentes")}${button("resources", "Recursos")}${button("tokens", "Tokens")}${button("vector", "Vetor")}${button("agents", "Kendrick")}${button("wendler", "Wendler")}</nav>`,
      );
    if (!timer)
      timer = setInterval(() => {
        if (!state.project) {
          clearInterval(timer);
          timer = null;
          return;
        }
        publishPresence();
        if (
          !loading &&
          (state.mode === "agents" ||
            chatOpen ||
            sessions.some((s) => ["thinking", "queued"].includes(s.status)))
        )
          loadSessions(false).catch(() => {});
      }, 2000);
  }
  function updatePages() {
    const select = document.querySelector("#page-select");
    if (select) {
      select.innerHTML = pages()
        .map(
          (p) =>
            `<option value="${esc(p.id)}" ${p.id === state.pageId ? "selected" : ""}>${esc(p.name)}</option>`,
        )
        .join("");
    }
  }
  async function setData(field, value) {
    return commit([{ type: "set_project_data", field, value }]);
  }
  function openForm(title, fields, submit) {
    dialog.className = "";
    dialog.innerHTML = `<form id="work-form"><h2>${esc(title)}</h2>${fields}<footer><button type="button" class="text-button" data-action="close-dialog">Cancelar</button><button type="submit" class="primary">Salvar</button></footer></form>`;
    dialog.showModal();
    dialog.querySelector("input,textarea,select")?.focus();
    dialog.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target,
        submitButton = form.querySelector("[type=submit]");
      submitButton.disabled = true;
      try {
        const data = new FormData(form);
        if ((await submit(data)) !== false) dialog.close();
      } catch (err) {
        notice(err.message, true);
      } finally {
        submitButton.disabled = false;
      }
    };
  }
  function mode(name) {
    stopMotion();
    state.mode = name;
    document
      .querySelectorAll(".mode-switch button")
      .forEach((b) => b.classList.toggle("active", b.dataset.action === name));
    if (name === "agents") closeChat();
    c.renderInspector();
    renderScene();
  }
  async function loadSessions(force = true) {
    if (!state.project) return;
    const projectId = state.project.id;
    loading = true;
    try {
      if (!providerList.length || force)
        providerList = await api("/api/agents/providers");
      const result = await api(`/api/projects/${projectId}/sessions`);
      if (state.project?.id !== projectId) return;
      const changed = JSON.stringify(sessions) !== JSON.stringify(result);
      const justApplied = result.some(
        (s) =>
          s.status === "applied" &&
          sessions.some(
            (previous) => previous.id === s.id && previous.status !== "applied",
          ),
      );
      sessions = result;
      if (justApplied) {
        feedbackUntil = performance.now() + 4500;
        clearTimeout(feedbackTimer);
        feedbackTimer = setTimeout(updateDock, 4550);
      }
      updateDock();
      if (state.mode === "agents" && (force || changed)) renderAgents();
      if (chatOpen && (force || changed))
        renderAgents(document.querySelector("#kendrick-popover"));
    } finally {
      loading = false;
    }
  }
  function mood() {
    if (applying || submitting || sessions.some((s) => s.status === "queued"))
      return "working";
    if (sessions.some((s) => s.status === "thinking")) return "thinking";
    if (sessions.some((s) => s.status === "proposed")) return "attention";
    if (performance.now() < feedbackUntil) return "success";
    if (sessions[0]?.status === "failed") return "attention";
    return chatOpen || state.mode === "agents" ? "listening" : "idle";
  }
  function updateDock() {
    const launcher = document.querySelector(".kendrick-launcher");
    if (launcher) {
      launcher.setAttribute("aria-expanded", String(chatOpen));
      launcher.classList.toggle("is-open", chatOpen);
      const avatar = launcher.querySelector("kendrick-avatar");
      if (avatar?.getAttribute("mood") !== mood())
        avatar?.setAttribute("mood", mood());
    }
    for (const avatar of document.querySelectorAll(
      ".kendrick-chat-heading kendrick-avatar",
    ))
      if (avatar.getAttribute("mood") !== mood())
        avatar.setAttribute("mood", mood());
    const context = document.querySelector(
      "#kendrick-popover .chat-context-label",
    );
    if (context) context.textContent = selected()?.name || "Canvas completo";
    const scope = document.querySelector("#kendrick-popover .context-scope");
    if (scope) scope.textContent = selected() ? "Seleção" : "Projeto";
  }
  function saveDraft(target) {
    const form = target?.querySelector("[data-kendrick-form]");
    if (form)
      drafts.set(state.project?.id, {
        prompt: form.elements.prompt.value,
        provider: form.elements.provider.value,
      });
  }
  function closeChat() {
    const pop = document.querySelector("#kendrick-popover");
    if (pop) {
      saveDraft(pop);
      pop.removeAttribute("id");
      pop.setAttribute("inert", "");
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const out = pop.animate(
          [
            { opacity: 1, transform: "translateY(0)" },
            { opacity: 0, transform: "translateY(7px)" },
          ],
          { duration: 120, easing: "ease-in", fill: "forwards" },
        );
        out.finished.then(() => pop.remove()).catch(() => pop.remove());
      } else pop.remove();
    }
    chatOpen = false;
    updateDock();
  }
  async function toggleChat() {
    if (chatOpen) {
      closeChat();
      document.querySelector(".kendrick-launcher")?.focus();
      return;
    }
    if (state.mode === "agents") {
      state.mode = "design";
      c.renderInspector();
    }
    chatOpen = true;
    const pop = document.createElement("section");
    pop.id = "kendrick-popover";
    pop.className = "kendrick-popover";
    pop.setAttribute("role", "region");
    pop.setAttribute("aria-label", "Conversa com Kendrick");
    document.querySelector(".canvas-dock")?.append(pop);
    renderAgents(pop);
    enter(pop, "chat-open", { distance: 10, duration: 240 });
    updateDock();
    pop.querySelector("textarea")?.focus({ preventScroll: true });
    await loadSessions(false);
  }
  function renderAgents(target = document.querySelector("#inspector")) {
    if (!target) return;
    const isPopover = target.id === "kendrick-popover",
      active = sessions.some((s) => ["queued", "thinking"].includes(s.status)),
      proposals = sessions.filter((s) => s.status === "proposed");
    const focused = target.contains(document.activeElement)
      ? document.activeElement?.name
      : null;
    saveDraft(target);
    const draft = drafts.get(state.project.id) || {
      prompt: "",
      provider: providerList.find((p) => p.available)?.id || "codex",
    };
    const conversation = target.querySelector(".chat-conversation");
    const pinned =
      !conversation ||
      conversation.scrollHeight -
        conversation.scrollTop -
        conversation.clientHeight <
        45;
    const scrollTop = conversation?.scrollTop || 0;
    target.innerHTML = `<header class="kendrick-chat-heading"><kendrick-avatar mood="${mood()}"></kendrick-avatar><div class="chat-identity"><strong>Kendrick</strong><span>${active ? "Pensando no seu canvas…" : proposals.length ? "Alterações prontas para revisar" : "Seu parceiro de design"}</span></div>${isPopover ? '<button class="icon-button" data-work="close-chat" aria-label="Fechar conversa">×</button>' : ""}</header><div class="chat-context"><span class="context-mark">◇</span><span class="chat-context-label">${esc(selected()?.name || "Canvas completo")}</span><span class="context-scope">${selected() ? "Seleção" : "Projeto"}</span></div><div class="chat-conversation" aria-live="polite" aria-relevant="additions">${
      sessions.length
        ? sessions
            .slice()
            .reverse()
            .map(
              (s) =>
                `<article class="chat-exchange"><div class="chat-user-message">${esc(s.prompt)}</div><div class="chat-answer"><span class="chat-answer-author">Kendrick <small>${esc(s.provider)}</small></span>${s.message ? `<p>${esc(s.message)}</p>` : s.status === "thinking" || s.status === "queued" ? '<div class="thinking-dots" aria-label="Preparando resposta"><i></i><i></i><i></i></div>' : ""}${s.error ? `<p class="work-error">${esc(s.error)}</p>` : ""}${s.operations?.length ? `<details class="proposal-details" data-session-diff="${s.id}"><summary><span class="proposal-tag">PROPOSTA</span>${s.operations.length} ${s.operations.length === 1 ? "alteração" : "alterações"} no canvas</summary><div class="proposal-diff"><p class="muted">Abra para comparar antes e depois.</p></div></details>` : ""}${s.status === "proposed" ? `<div class="proposal-actions"><button class="primary" data-session="${s.id}" data-command="apply">Aplicar proposta</button><button class="text-button" data-session="${s.id}" data-command="cancel">Descartar</button></div>` : s.status === "applied" ? '<span class="proposal-applied">✓ Aplicada no canvas</span>' : ["queued", "thinking"].includes(s.status) ? `<button class="text-button" data-session="${s.id}" data-command="cancel">Cancelar sessão</button>` : ""}</div></article>`,
            )
            .join("")
        : `<div class="chat-welcome"><kendrick-avatar mood="listening"></kendrick-avatar><h3>Vamos dar forma à sua ideia.</h3><p>Selecione um elemento ou me conte o que você quer criar neste canvas.</p><div class="chat-suggestions"><button data-suggestion="Refine o espaçamento da seleção, preservando os tokens e o estilo atual.">Refinar seleção <span>↗</span></button><button data-suggestion="Proponha uma animação suave de entrada para o elemento selecionado.">Criar uma animação <span>↗</span></button></div></div>`
    }</div><form data-kendrick-form class="kendrick-compose"><label class="sr-only" for="${isPopover ? "dock" : "panel"}-kendrick-message">Mensagem para Kendrick</label><textarea id="${isPopover ? "dock" : "panel"}-kendrick-message" name="prompt" required maxlength="6000" placeholder="Peça uma alteração…" aria-label="Mensagem para Kendrick">${esc(draft.prompt)}</textarea><div class="compose-controls"><label class="provider-picker"><span class="provider-dot"></span><select name="provider" aria-label="Provedor do Kendrick">${(providerList.length ? providerList : [{ id: "codex", name: "Codex", available: true }]).map((p) => `<option value="${p.id}" ${draft.provider === p.id ? "selected" : ""} ${p.available ? "" : "disabled"}>${esc(p.name)}${p.available ? "" : " · não instalado"}</option>`).join("")}</select></label><button class="send-kendrick" ${active ? "disabled" : ""} type="submit" aria-label="Enviar para Kendrick" title="Enviar · Enter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button></div><div class="compose-caption"><span>Enter envia · Shift + Enter quebra linha</span><span>Contexto do canvas</span></div></form><p class="chat-privacy">O contexto será enviado ao provedor escolhido.</p>`;
    for (const details of target.querySelectorAll("[data-session-diff]")) {
      details.addEventListener("toggle", async () => {
        if (!details.open || details.dataset.loaded) return;
        details.dataset.loaded = "true";
        const container = details.querySelector(".proposal-diff");
        container.textContent = "Comparando alterações…";
        try {
          const diff = await api(
            `/api/projects/${state.project.id}/sessions/${details.dataset.sessionDiff}/diff`,
          );
          const labels = {
            x: "Posição X",
            y: "Posição Y",
            width: "Largura",
            height: "Altura",
            fill: "Cor",
            stroke: "Borda",
            strokeWidth: "Espessura",
            text: "Texto",
            name: "Nome",
            opacity: "Opacidade",
            radius: "Raio",
            rotation: "Rotação",
            fontSize: "Tamanho da fonte",
            fontFamily: "Fonte",
            fontWeight: "Peso",
            parentId: "Frame",
            gap: "Espaçamento",
            padding: "Padding",
            pathData: "Geometria",
            pages: "Páginas",
            tokens: "Tokens",
            interactions: "Conexões",
            animations: "Animações",
            fonts: "Fontes",
            flows: "Fluxos",
          };
          const display = (value) =>
            esc(
              value === null
                ? "—"
                : typeof value === "object"
                  ? JSON.stringify(value).slice(0, 120)
                  : String(value).slice(0, 180),
            );
          container.innerHTML = `<p class="muted">Revisão ${diff.baseRevision} → proposta${diff.conflict ? " · O canvas mudou; esta proposta precisa ser refeita antes de aplicar." : ""}</p>${diff.changes
            .map(
              (change) =>
                `<article class="diff-node"><strong>${esc(change.name)} <small>${{ created: "Adicionar", deleted: "Excluir", updated: "Alterar" }[change.kind]}</small></strong>${change.fields
                  .filter(
                    (f) =>
                      !["id", "type", "pageId", "name", "fontOutline"].includes(
                        f.property,
                      ),
                  )
                  .map(
                    (f) =>
                      `<div class="diff-field"><span>${esc(labels[f.property] || f.property)}</span><del>${display(f.before)}</del><ins>${display(f.after)}</ins></div>`,
                  )
                  .join("")}</article>`,
            )
            .join(
              "",
            )}${diff.projectChanges.map((key) => `<p class="muted">${esc(labels[key] || key)} alterado(s).</p>`).join("")}`;
        } catch (error) {
          container.textContent = error.message;
          delete details.dataset.loaded;
        }
      });
    }
    const form = target.querySelector("form");
    form.oninput = () => saveDraft(target);
    form.onchange = () => saveDraft(target);
    form.elements.prompt.onkeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        if (!active) form.requestSubmit();
      }
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      form.querySelector("button[type=submit]").disabled = true;
      submitting = true;
      updateDock();
      try {
        await api(`/api/projects/${state.project.id}/sessions`, {
          provider: data.get("provider"),
          prompt: data.get("prompt"),
          selectionId: state.selected,
        });
        drafts.set(state.project.id, {
          prompt: "",
          provider: data.get("provider"),
        });
        form.elements.prompt.value = "";
        await loadSessions();
      } catch (err) {
        notice(err.message, true);
        form.querySelector("button[type=submit]").disabled = false;
      } finally {
        submitting = false;
        updateDock();
      }
    };
    const next = target.querySelector(".chat-conversation");
    next.scrollTop = sessions.length
      ? pinned
        ? next.scrollHeight
        : scrollTop
      : 0;
    if (focused) {
      form.elements[focused]?.focus({ preventScroll: true });
      if (focused === "prompt") {
        const input = form.elements.prompt;
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
    if (!isPopover) target.classList.add("agent-inspector");
  }
  function renderMotion() {
    const panel = document.querySelector("#inspector");
    const n = selected();
    const animations = current().animations || [];
    panel.innerHTML = `<div class="inspector-title"><strong>Motion Studio</strong><small>Timeline e keyframes persistidos</small></div>${section("Reprodução", `<input id="motion-time" type="range" min="0" max="${Math.max(1000, ...animations.map((a) => a.duration))}" value="${motionTime || 0}" aria-label="Tempo da animação">${button("play-motion", "▶ Reproduzir")}${button("stop-motion", "Parar")}`)}${section(n ? esc(n.name) : "Seleção", n ? button("new-animation", "Adicionar animação") : "Selecione um elemento para animar.")}${animations.map((a) => section(esc(current().nodes.find((n) => n.id === a.nodeId)?.name || a.nodeId), `<p class="muted">${a.duration} ms · ${esc(a.easing)} · ${a.keyframes.length} keyframes</p><button class="text-button" data-animation="${a.id}">Editar keyframes</button><button class="text-button" data-delete-animation="${a.id}">Excluir</button>`)).join("")}${section("Exportação", `${button("export-motion", "Exportar HTML animado")}`)}`;
    panel.querySelector("#motion-time").oninput = (e) => {
      cancelAnimationFrame(frameRequest);
      motionTime = Number(e.target.value);
      renderScene();
    };
  }
  function stopMotion() {
    cancelAnimationFrame(frameRequest);
    motionTime = null;
  }
  let editingInteractionId = null;
  function renderPrototype() {
    const doc = current(),
      n = selected();
    const frames = doc.nodes.filter((n) => n.type === "frame" && !n.parentId);
    const editing = doc.interactions.find(
      (i) => i.id === editingInteractionId && i.nodeId === n?.id,
    );
    const values = editing || {
      trigger: "click",
      action: "navigate",
      transition: "dissolve",
      duration: 280,
      delay: 1000,
    };
    const options = (items, value) =>
      Object.entries(items)
        .map(
          ([id, label]) =>
            `<option value="${esc(id)}" ${id === value ? "selected" : ""}>${esc(label)}</option>`,
        )
        .join("");
    const panel = document.querySelector("#inspector");
    panel.innerHTML = `<div class="inspector-title"><strong>Prototype Mode</strong><small>Conecte telas e ative animações</small></div>${section("Fluxos", `<p class="muted">Arraste o círculo azul da seleção até um frame de destino.</p>${(doc.flows || []).map((f) => `<div class="work-item"><button class="text-button" data-preview-flow="${f.id}">${esc(f.name)} ↗</button><button data-delete-flow="${f.id}" aria-label="Excluir fluxo ${esc(f.name)}">×</button></div>`).join("")}${button("new-flow", "+ Novo fluxo")}`)}${section(editing ? "Editar conexão" : "Conectar seleção", n ? `<p>${esc(n.name)}</p><form id="connection-form"><label class="work-label">Gatilho<select name="trigger">${options({ click: "Clique", hover: "Hover", "mouse-leave": "Ao sair", press: "Pressionar", release: "Soltar", key: "Tecla", "after-delay": "Após atraso" }, values.trigger)}</select></label><label class="work-label" data-trigger-key>Tecla<input name="key" value="${esc(values.key || "Enter")}" maxlength="40"></label><label class="work-label" data-trigger-delay>Atraso (ms)<input name="delay" type="number" min="0" max="60000" value="${values.delay ?? values.duration}"></label><label class="work-label">Ação<select name="action">${options({ navigate: "Navegar", overlay: "Abrir overlay", back: "Voltar", close: "Fechar overlay", animate: "Executar animação" }, values.action)}</select></label><label class="work-label" data-action-target>Destino<select name="targetId">${options(Object.fromEntries(frames.map((f) => [f.id, f.name])), values.targetId)}</select></label><label class="work-label" data-action-animation>Animação<select name="animationId">${options(Object.fromEntries(doc.animations.map((a) => [a.id, doc.nodes.find((n) => n.id === a.nodeId)?.name + " · " + a.duration + " ms"])), values.animationId)}</select></label><label class="work-label" data-action-transition>Transição<select name="transition">${options({ instant: "Instantânea", dissolve: "Dissolver", slide: "Deslizar", push: "Empurrar", "move-in": "Entrada", "move-out": "Saída" }, values.transition)}</select></label><div data-action-duration>${input("duration", "Duração (ms)", values.duration, "number")}</div><button type="submit" class="primary">${editing ? "Salvar conexão" : "Criar conexão"}</button>${editing ? `<button type="button" class="text-button" data-work="stop-editing-connection">Nova conexão</button>` : ""}</form>` : "Selecione um botão ou elemento no canvas.")}${section("Conexões", doc.interactions.map((i) => `<div class="work-item"><button class="text-button" data-edit-interaction="${i.id}">${esc(doc.nodes.find((n) => n.id === i.nodeId)?.name)} → ${esc(i.action === "animate" ? "Animação" : doc.nodes.find((n) => n.id === i.targetId)?.name || i.action)}</button><button data-delete-interaction="${i.id}" aria-label="Excluir conexão">×</button></div>`).join("") || '<p class="muted">Nenhuma conexão ainda.</p>')}${section("Preview", `${button("play-prototype", "▶ Abrir protótipo")}${button("export-prototype", "Exportar HTML navegável")}`)}`;
    const form = panel.querySelector("#connection-form");
    if (!form) return;
    function fields() {
      const navigate = ["navigate", "overlay"].includes(
        form.elements.action.value,
      );
      for (const [selector, visible] of [
        ["[data-trigger-key]", form.elements.trigger.value === "key"],
        ["[data-trigger-delay]", form.elements.trigger.value === "after-delay"],
        ["[data-action-target]", navigate],
        ["[data-action-animation]", form.elements.action.value === "animate"],
        ["[data-action-transition]", navigate],
        ["[data-action-duration]", navigate],
      ])
        form.querySelector(selector).hidden = !visible;
    }
    form.onchange = fields;
    fields();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const item = {
        id: editing?.id || uuid(),
        nodeId: n.id,
        trigger: data.get("trigger"),
        action: data.get("action"),
        transition: data.get("transition"),
        duration: Number(data.get("duration")),
      };
      if (["navigate", "overlay"].includes(item.action))
        item.targetId = data.get("targetId");
      if (item.action === "animate") item.animationId = data.get("animationId");
      if (item.trigger === "key") item.key = data.get("key");
      if (item.trigger === "after-delay")
        item.delay = Number(data.get("delay"));
      try {
        await setData("interactions", [
          ...current().interactions.filter((i) => i.id !== item.id),
          item,
        ]);
      } catch (error) {
        notice(error.message, true);
      }
    };
  }
  function canvasPoint(event) {
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(
      document.querySelector("#viewport").getScreenCTM().inverse(),
    );
  }
  function dropFrame(event) {
    const id = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest("[data-node-id]")?.dataset.nodeId;
    let node = current().nodes.find((n) => n.id === id);
    while (node?.parentId)
      node = current().nodes.find((n) => n.id === node.parentId);
    return node?.type === "frame" ? node : null;
  }
  function connectorDown(event) {
    if (event.button !== 0 || state.pan || event.altKey) return false;
    const handle = event.target.closest("[data-prototype-handle]");
    if (state.mode !== "prototype" || !handle) return false;
    event.preventDefault();
    state.drag = {
      kind: "connection",
      nodeId: handle.dataset.prototypeHandle,
      revision: state.project.revision,
      point: canvasPoint(event),
    };
    return true;
  }
  function connectorMove(event) {
    if (state.drag?.kind !== "connection") return false;
    state.drag.point = canvasPoint(event);
    state.drag.targetId = dropFrame(event)?.id;
    renderScene();
    return true;
  }
  async function connectorUp(event) {
    if (state.drag?.kind !== "connection") return false;
    const drag = state.drag,
      target = dropFrame(event);
    state.drag = null;
    renderScene();
    if (!target) return true;
    if (drag.revision !== state.project.revision) {
      notice("O canvas mudou. Arraste a conexão novamente.", true);
      return true;
    }
    const item = {
      id: uuid(),
      nodeId: drag.nodeId,
      targetId: target.id,
      trigger: "click",
      action: "navigate",
      transition: "dissolve",
      duration: 280,
    };
    editingInteractionId = item.id;
    try {
      await setData("interactions", [...current().interactions, item]);
    } catch (error) {
      notice(error.message, true);
    }
    return true;
  }
  function renderResources() {
    const panel = document.querySelector("#inspector");
    panel.innerHTML = `<div class="inspector-title"><strong>Recursos locais</strong><small>Imagens, SVG e ícones</small></div>${section("Importar", `<label class="work-label">Imagem PNG, JPEG ou WebP<input id="image-upload" type="file" accept="image/png,image/jpeg,image/webp"></label><label class="work-label">Fonte local TTF, OTF, WOFF ou WOFF2<input id="font-upload" type="file" accept=".ttf,.otf,.woff,.woff2"></label><div>${(current().fonts || []).map((f) => `<button class="text-button" data-font="${f.id}">${esc(f.name)}</button>`).join("")}</div><label class="work-label">SVG editável<input id="svg-upload" type="file" accept="image/svg+xml"></label><p class="muted">SVG: formas básicas, texto e paths sem scripts nem recursos externos.</p>`)}${section(
      "Ícones Lucide",
      `<div class="icon-library">${Object.keys(icons)
        .map(
          (name) =>
            `<button data-icon="${name}" title="${name}" aria-label="Inserir ${name}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${icons[name]}</svg></button>`,
        )
        .join("")}</div>`,
    )}${section(
      "Recursos no documento",
      current()
        .nodes.filter((n) => n.type === "image" || n.type === "path")
        .map(
          (n) =>
            `<button class="text-button" data-select="${n.id}">${esc(n.name)}</button>`,
        )
        .join("") || '<p class="muted">Nenhum recurso importado.</p>',
    )}`;
    panel.querySelector("#font-upload").onchange = async (e) => {
      try {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 700000) throw new Error("Fonte acima de 700 KB.");
        const ext = file.name.split(".").at(-1).toLowerCase();
        if (!["ttf", "otf", "woff", "woff2"].includes(ext))
          throw new Error("Formato de fonte inválido");
        const raw = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        const data = `data:font/${ext};base64,${raw.split(",")[1]}`;
        await setData("fonts", [
          ...(current().fonts || []),
          { id: "font-" + uuid(), name: file.name, data },
        ]);
      } catch (err) {
        notice(err.message, true);
      }
    };
    panel.querySelector("#image-upload").onchange = async (e) => {
      try {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 700000)
          throw new Error(
            "Imagem acima de 700 KB. Reduza o arquivo antes de importar.",
          );
        const src = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const image = new Image();
        image.src = src;
        await image.decode();
        const scale = Math.min(1, 800 / image.width, 800 / image.height);
        await commit([
          {
            type: "create_node",
            node: {
              id: uuid(),
              type: "image",
              name: file.name,
              x: 30,
              y: 30,
              width: image.width * scale,
              height: image.height * scale,
              pageId: state.pageId,
              src,
            },
          },
        ]);
      } catch (err) {
        notice(err.message, true);
      }
    };
    panel.querySelector("#svg-upload").onchange = async (e) => {
      try {
        const file = e.target.files[0];
        if (file) await importSvg(await file.text(), file.name);
      } catch (err) {
        notice(err.message, true);
      }
    };
  }
  async function importSvg(text, name) {
    if (text.length > 300000) throw new Error("SVG acima de 300 KB");
    const svg = new DOMParser().parseFromString(text, "image/svg+xml");
    if (
      svg.querySelector("parsererror,script,foreignObject,image,use,style") ||
      [...svg.querySelectorAll("*")].some((el) =>
        [...el.attributes].some(
          (a) =>
            a.name.startsWith("on") ||
            a.name === "transform" ||
            a.name === "href" ||
            a.value.includes("url("),
        ),
      )
    )
      throw new Error(
        "SVG contém recursos não suportados. Exporte formas sem scripts, transforms ou referências externas.",
      );
    const root = svg.documentElement;
    const v = (root.getAttribute("viewBox") || "0 0 500 500")
      .split(/[ ,]+/)
      .map(Number);
    const parent = {
      id: uuid(),
      type: "frame",
      name,
      x: 0,
      y: 0,
      width: v[2] || 500,
      height: v[3] || 500,
      fill: "none",
      pageId: state.pageId,
    };
    const nodes = [parent];
    for (const el of root.querySelectorAll("rect,ellipse,circle,path,text")) {
      const num = (key, fallback = 0) =>
        Number(el.getAttribute(key) ?? fallback);
      let type =
        el.tagName === "rect"
          ? "rectangle"
          : el.tagName === "circle"
            ? "ellipse"
            : el.tagName;
      const width =
          type === "ellipse" ? num("rx", num("r")) * 2 : num("width", 100),
        height =
          type === "ellipse" ? num("ry", num("r")) * 2 : num("height", 30);
      const n = {
        id: uuid(),
        type,
        name: el.getAttribute("id") || type,
        x: num("x", type === "ellipse" ? num("cx") - width / 2 : 0) - v[0],
        y: num("y", type === "ellipse" ? num("cy") - height / 2 : 0) - v[1],
        width: Math.max(1, width),
        height: Math.max(1, height),
        fill: el.getAttribute("fill") || "#000000",
        pageId: state.pageId,
        parentId: parent.id,
      };
      if (type === "path") n.pathData = el.getAttribute("d");
      if (type === "text") {
        n.text = el.textContent;
        n.fontSize = num("font-size", 16);
        n.y -= n.fontSize;
      }
      if (el.hasAttribute("stroke")) {
        n.stroke = el.getAttribute("stroke");
        n.strokeWidth = num("stroke-width", 1);
      }
      nodes.push(n);
    }
    if (nodes.length > 200)
      throw new Error("SVG excede o limite de 199 formas por importação.");
    await commit(nodes.map((node) => ({ type: "create_node", node })));
    fit();
  }
  function renderTokens() {
    const doc = current();
    document.querySelector("#inspector").innerHTML =
      `<div class="inspector-title"><strong>Design tokens</strong><small>Cores, números e strings</small></div>${section("Biblioteca", `${button("new-token", "Adicionar token")}${(doc.tokens || []).map((t) => `<div class="work-item"><button data-token="${t.id}" title="Aplicar à seleção">${t.type === "color" ? `<i style="background:${t.value}"></i>` : ""}${esc(t.name)} <small>${esc(t.value)}</small></button><button data-delete-token="${t.id}" aria-label="Excluir token">×</button></div>`).join("")}`)}`;
  }
  function renderComponents() {
    const doc = current(),
      n = selected();
    document.querySelector("#inspector").innerHTML =
      `<div class="inspector-title"><strong>Componentes e variantes</strong><small>Masters e instâncias persistidos</small></div>${section("Seleção", n?.type === "frame" ? `${button("make-component", "Criar componente")}${n.componentMain ? button("make-variant", "Criar variante") : ""}` : "Selecione um frame para criar um componente.")}${section(
        "Biblioteca",
        doc.nodes
          .filter((n) => n.componentMain)
          .map(
            (n) =>
              `<div class="work-item"><span>${esc(n.name)} · ${esc(n.variant)}</span><button data-component="${n.id}">Inserir</button></div>`,
          )
          .join("") || "Nenhum componente ainda.",
      )}${
        n?.componentId && !n.componentMain
          ? section(
              "Instância",
              `${button("sync-component", "Sincronizar com principal")}<label class="work-label">Variante<select id="variant-select">${doc.nodes
                .filter(
                  (v) =>
                    v.componentMain &&
                    v.componentSetId ===
                      doc.nodes.find((v) => v.id === n.componentId)
                        ?.componentSetId,
                )
                .map(
                  (v) =>
                    `<option value="${v.id}" ${n.componentId === v.id ? "selected" : ""}>${esc(v.variant)}</option>`,
                )
                .join("")}</select></label>`,
            )
          : ""
      }`;
    document
      .querySelector("#variant-select")
      ?.addEventListener("change", (e) => replaceInstance(n, e.target.value));
  }
  async function replaceInstance(n, componentId) {
    return commit([
      { type: "delete_node", id: n.id },
      {
        type: "instantiate_component",
        componentId,
        id: n.id,
        pageId: n.pageId,
        x: n.x,
        y: n.y,
      },
    ]);
  }
  function renderWendler() {
    const panel = document.querySelector("#inspector");
    panel.innerHTML = `<div class="inspector-title"><strong>Wendler</strong><small>Seus agentes no mesmo canvas</small></div><section class="inspector-section" id="wendler-status" aria-live="polite"><p class="muted">Verificando conexão…</p></section>${section("Trabalhar neste projeto", `<p class="muted">No Wendler, peça ao agente para abrir este projeto no Imhotep. Ele pode consultar sua seleção, renderizar frames e editar o canvas. As alterações aparecem aqui e ficam no histórico.</p>${button("copy-wendler-context", "Copiar contexto do projeto")}`)}`;
    api("/api/integrations/wendler")
      .then((link) => {
        const target = panel.querySelector("#wendler-status");
        if (!target) return;
        let uiUrl = "";
        try {
          if (new URL(link.uiUrl).protocol === "https:") uiUrl = link.uiUrl;
        } catch {}
        target.innerHTML = `<h3>${link.configured && link.online ? (link.executorReady === false ? "Reconectar executor" : "Conectado") : link.configured ? "Wendler fora do ar" : "Aguardando conexão"}</h3><p class="muted">${link.configured ? (link.online ? (link.executorReady === false ? "A integração está cadastrada. Abra o Wendler para reconectar a conta do executor e voltar a conversar com os agentes." : "Integração cadastrada. Os agentes têm acesso às ferramentas do Imhotep.") : "A integração está cadastrada, mas o Wendler não respondeu. Seus projetos continuam salvos aqui.") : "O Imhotep ainda não foi cadastrado neste Wendler."}</p>${uiUrl ? `<a class="text-button" href="${esc(uiUrl)}" target="_blank" rel="noopener noreferrer">Abrir Wendler ↗</a>` : ""}`;
      })
      .catch((err) => {
        const target = panel.querySelector("#wendler-status");
        if (target) target.textContent = err.message;
      });
  }
  function renderSettings() {
    const panel = document.querySelector("#inspector");
    panel.innerHTML = `<div class="inspector-title"><strong>Workspace</strong><small>Projetos, páginas e backups</small></div>${section(
      "Páginas",
      pages()
        .map(
          (p) =>
            `<div class="work-item"><span>${esc(p.name)}</span><button data-rename-page="${p.id}">Renomear</button><button data-delete-page="${p.id}">Excluir</button></div>`,
        )
        .join(""),
    )}${section("Projeto", `${button("rename-project", "Renomear projeto")}<label class="work-label">Restaurar / importar projeto JSON<input id="project-upload" type="file" accept="application/json,.json"></label>`)}${section("Backup do workspace", `${button("backup", "Criar backup verificado")}<p class="muted">Backups automáticos a cada 6 horas enquanto o servidor está ativo. Incluem projetos e conversas do workspace.</p><div id="backups-list"></div>`)}`;
    panel.querySelector("#project-upload").onchange = async (e) => {
      try {
        const f = e.target.files[0];
        if (!f) return;
        const document = JSON.parse(await f.text());
        const project = await api("/api/projects", { document });
        location.href = "/?project=" + project.id;
      } catch (err) {
        notice(err.message, true);
      }
    };
    api("/api/backups")
      .then((items) => {
        const list = document.querySelector("#backups-list");
        if (list)
          list.innerHTML = items
            .map(
              (b) =>
                `<p><a href="/api/backups/${b.name}" download>${esc(b.name)}</a></p>`,
            )
            .join("");
      })
      .catch((e) => notice(e.message, true));
  }
  function renderInspector() {
    mount();
    if (state.mode !== "agents")
      document.querySelector("#inspector")?.classList.remove("agent-inspector");
    if (state.mode === "agents") {
      if (!providerList.length)
        loadSessions().catch((e) => notice(e.message, true));
      else renderAgents();
      return true;
    }
    if (state.mode === "motion") {
      renderMotion();
      return true;
    }
    if (state.mode === "prototype") {
      renderPrototype();
      return true;
    }
    if (state.mode === "resources") {
      renderResources();
      return true;
    }
    if (state.mode === "tokens") {
      renderTokens();
      return true;
    }
    if (state.mode === "settings") {
      renderSettings();
      return true;
    }
    if (state.mode === "components") {
      renderComponents();
      return true;
    }
    if (state.mode === "wendler") {
      renderWendler();
      return true;
    }
    return false;
  }
  function decorateInspector(panel, n) {
    if (!n) return;
    vector.decorate(panel, n);
    responsive.decorate(panel, n);
    panel.insertAdjacentHTML(
      "beforeend",
      section(
        "Organização",
        `${button("duplicate", "Duplicar")}${button("forward", "Trazer à frente")}${button("backward", "Enviar para trás")}${button("group", "Agrupar seleção")}${button("ungroup", "Desagrupar")}${input("rotation", "Rotação", n.rotation || 0, "number")}${n.type === "frame" ? `<label class="work-label">Auto layout<select id="layout-select"><option value="none">Livre</option><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></label>${input("gap", "Gap", n.gap || 0, "number")}${input("padding", "Padding", n.padding || 0, "number")}` : ""}${n.type === "path" ? `<label class="work-label">Curva SVG<textarea id="path-data" aria-label="Geometria vetorial">${esc(n.pathData)}</textarea></label>` : ""}`,
      ),
    );
    for (const key of ["rotation", "gap", "padding"])
      panel.querySelector(`[name="${key}"]`)?.addEventListener("change", (e) =>
        commit([
          {
            type: "update_node",
            id: n.id,
            changes: { [key]: Number(e.target.value) },
          },
        ]),
      );
    const layout = panel.querySelector("#layout-select");
    if (layout) {
      layout.value = n.layout || "none";
      layout.onchange = (e) =>
        commit([
          {
            type: "update_node",
            id: n.id,
            changes: { layout: e.target.value },
          },
        ]);
    }
    panel.querySelector("#path-data")?.addEventListener("change", (e) =>
      commit([
        {
          type: "update_node",
          id: n.id,
          changes: { pathData: e.target.value },
        },
      ]),
    );
    const foot = panel.querySelector(".inspector-foot");
    if (foot) panel.append(foot);
  }
  async function downloadCode(format) {
    const p = state.project;
    let frame = selected();
    if (["react", "tailwind"].includes(format))
      while (frame && frame.type !== "frame")
        frame = p.document.nodes.find((n) => n.id === frame.parentId);
    const scope =
      ["react", "tailwind"].includes(format) && frame
        ? "&frame=" + encodeURIComponent(frame.id)
        : "";
    const r = await fetch(
      `/api/projects/${p.id}/${format === "prototype" ? "prototype" : "code?format=" + format + scope}`,
    );
    if (!r.ok) throw new Error((await r.json()).error);
    const blob = await r.blob(),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `${["react", "tailwind"].includes(format) ? "Design.tsx" : "imhotep-export.html"}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function act(name) {
    if (await vector.act(name)) return true;
    if (name === "stop-editing-connection") {
      editingInteractionId = null;
      renderPrototype();
      return true;
    }
    if (name === "new-flow") {
      const frames = current().nodes.filter(
        (n) => n.type === "frame" && !n.parentId,
      );
      if (!frames.length) {
        notice("Adicione um frame para iniciar um fluxo.");
        return true;
      }
      openForm(
        "Novo fluxo",
        `${input("name", "Nome do fluxo", "Fluxo " + ((current().flows || []).length + 1))}<label class="work-label">Tela inicial<select name="startFrameId">${frames.map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join("")}</select></label>`,
        (data) =>
          setData("flows", [
            ...(current().flows || []),
            {
              id: uuid(),
              name: data.get("name"),
              startFrameId: data.get("startFrameId"),
            },
          ]),
      );
      return true;
    }
    if (name === "copy-wendler-context") {
      const node = selected();
      await c.copyText(
        `Abra o projeto ${state.project.id} (${state.project.document.name}) usando as ferramentas MCP imhotep. Consulte get_document_tree e get_selection antes de editar. ${node ? `Seleção: ${node.name} (${node.id}).` : "Sem seleção específica."} Preserve o visual, use a revisão atual e identifique a autoria como wendler. Editor: ${location.origin}/?project=${state.project.id}`,
      );
      notice("Contexto do projeto copiado.");
      return true;
    }
    if (
      [
        "agents",
        "prototype",
        "motion",
        "resources",
        "tokens",
        "components",
        "wendler",
      ].includes(name)
    ) {
      mode(name);
      return true;
    }
    if (name === "toggle-chat") {
      await toggleChat();
      return true;
    }
    if (name === "close-chat") {
      closeChat();
      return true;
    }
    if (name === "settings") {
      mode(name);
      return true;
    }
    if (name === "backup") {
      const result = await api("/api/backups", {});
      notice("Backup criado e verificado: " + result.name);
      renderSettings();
      return true;
    }
    if (name === "rename-project") {
      openForm(
        "Renomear projeto",
        input("name", "Nome", current().name),
        (data) => commit([{ type: "rename_project", name: data.get("name") }]),
      );
      return true;
    }
    if (name === "new-page") {
      openForm(
        "Nova página",
        input("name", "Nome", "Página " + (pages().length + 1)),
        async (data) => {
          const id = uuid();
          if (
            await setData("pages", [...pages(), { id, name: data.get("name") }])
          ) {
            state.pageId = id;
            state.selected = null;
            refresh();
            fit();
          }
        },
      );
      return true;
    }
    if (name === "vector") {
      const id = uuid();
      if (
        await commit([
          {
            type: "create_node",
            node: {
              id,
              type: "path",
              name: "Curva Bézier",
              pageId: state.pageId,
              x: 50,
              y: 50,
              width: 220,
              height: 140,
              fill: "none",
              stroke: "#328BFF",
              strokeWidth: 3,
              pathData: "M0 110 C40 0 160 0 220 110",
            },
          },
        ])
      )
        select(id);
      return true;
    }
    if (name === "new-token") {
      openForm(
        "Novo token",
        input("name", "Nome", "Cor primária") +
          '<label class="work-label">Tipo<select name="type"><option value="color">Cor</option><option value="number">Número</option><option value="string">Texto</option></select></label>' +
          input("value", "Valor", "#328BFF"),
        (data) =>
          setData("tokens", [
            ...(current().tokens || []),
            {
              id: uuid(),
              name: data.get("name"),
              type: data.get("type"),
              value:
                data.get("type") === "number"
                  ? Number(data.get("value"))
                  : data.get("value"),
            },
          ]),
      );
      return true;
    }
    if (name === "make-component" && selected()) {
      await commit([{ type: "create_component", id: selected().id }]);
      return true;
    }
    if (name === "make-variant" && selected()) {
      const n = selected();
      openForm(
        "Nova variante",
        input("variant", "Nome da variante", "Hover"),
        async (data) => {
          const id = uuid();
          return commit([
            {
              type: "instantiate_component",
              componentId: n.id,
              id,
              pageId: state.pageId,
            },
            {
              type: "create_component",
              id,
              setId: n.componentSetId,
              variant: data.get("variant"),
            },
          ]);
        },
      );
      return true;
    }
    if (name === "sync-component" && selected()) {
      await replaceInstance(selected(), selected().componentId);
      return true;
    }
    if (name === "forward" || name === "backward") {
      if (selected())
        await commit([
          {
            type: "reorder_node",
            id: selected().id,
            index: name === "forward" ? current().nodes.length - 1 : 0,
          },
        ]);
      return true;
    }
    if (name === "duplicate" && selected()) {
      const n = selected(),
        all = [n];
      for (let i = 0; i < all.length; i++)
        all.push(...current().nodes.filter((c) => c.parentId === all[i].id));
      const map = new Map(all.map((n) => [n.id, uuid()]));
      const ops = all.map((original) => {
        const node = structuredClone(original);
        node.id = map.get(node.id);
        if (map.has(node.parentId)) node.parentId = map.get(node.parentId);
        if (original === n) {
          node.x += 24;
          node.y += 24;
          node.name += " · cópia";
        }
        if (node.componentMain) {
          delete node.componentMain;
          delete node.componentId;
          delete node.componentSetId;
        }
        return { type: "create_node", node };
      });
      if (await commit(ops)) select(map.get(n.id));
      return true;
    }
    if (name === "group") {
      const ids = state.selectedIds || [state.selected];
      const nodes = current().nodes.filter((n) => ids.includes(n.id));
      if (!nodes.length) return true;
      const parentId = nodes[0].parentId;
      if (nodes.some((n) => n.parentId !== parentId))
        throw new Error("Agrupe elementos com o mesmo pai.");
      const x = Math.min(...nodes.map((n) => n.x)),
        y = Math.min(...nodes.map((n) => n.y)),
        id = uuid();
      const group = {
        id,
        type: "frame",
        name: "Grupo",
        pageId: state.pageId,
        x,
        y,
        width: Math.max(...nodes.map((n) => n.x + n.width)) - x,
        height: Math.max(...nodes.map((n) => n.y + n.height)) - y,
        fill: "none",
        ...(parentId ? { parentId } : {}),
      };
      if (
        await commit([
          { type: "create_node", node: group },
          ...nodes.map((n) => ({
            type: "update_node",
            id: n.id,
            changes: { parentId: id, x: n.x - x, y: n.y - y },
          })),
        ])
      )
        select(id);
      return true;
    }
    if (name === "ungroup" && selected()) {
      const n = selected();
      const children = current().nodes.filter((c) => c.parentId === n.id);
      await commit([
        ...children.map((child) => ({
          type: "update_node",
          id: child.id,
          changes: {
            parentId: n.parentId || "",
            x: child.x + n.x,
            y: child.y + n.y,
          },
        })),
        { type: "delete_node", id: n.id },
      ]);
      return true;
    }
    if (name === "new-animation") {
      const n = selected();
      if (n)
        editAnimation({
          id: uuid(),
          nodeId: n.id,
          duration: 600,
          easing: "ease-in-out",
          keyframes: [
            { time: 0, values: { opacity: 0 } },
            { time: 600, values: { opacity: 1 } },
          ],
        });
      return true;
    }
    if (name === "stop-motion") {
      stopMotion();
      renderScene();
      return true;
    }
    if (name === "play-motion") {
      cancelAnimationFrame(frameRequest);
      const start = performance.now(),
        duration = Math.max(
          1,
          ...(current().animations || []).map((a) => a.duration),
        );
      const tick = (now) => {
        motionTime = Math.min(duration, now - start);
        renderScene();
        const slider = document.querySelector("#motion-time");
        if (slider) slider.value = motionTime;
        if (motionTime < duration && state.mode === "motion")
          frameRequest = requestAnimationFrame(tick);
      };
      frameRequest = requestAnimationFrame(tick);
      return true;
    }
    if (name === "play-prototype") {
      window.open(
        `/api/projects/${state.project.id}/prototype`,
        "_blank",
        "noopener",
      );
      return true;
    }
    if (["export-prototype", "export-motion"].includes(name)) {
      await downloadCode("prototype");
      return true;
    }
    if (name === "export-html") {
      await downloadCode("html");
      return true;
    }
    if (name === "export-react") {
      await downloadCode("react");
      return true;
    }
    if (name === "export-tailwind") {
      await downloadCode("tailwind");
      return true;
    }
    return false;
  }
  function editAnimation(animation) {
    const properties = {
      opacity: "Opacidade",
      x: "Posição X",
      y: "Posição Y",
      width: "Largura",
      height: "Altura",
      rotation: "Rotação",
    };
    const row = (time, key, value) =>
      `<div class="keyframe-row"><label><span class="sr-only">Tempo em milissegundos</span><input name="kf-time" type="number" min="0" step="10" value="${time}" required><span class="field-unit">ms</span></label><select name="kf-property" aria-label="Propriedade do keyframe">${Object.entries(
        properties,
      )
        .map(
          ([id, label]) =>
            `<option value="${id}" ${key === id ? "selected" : ""}>${label}</option>`,
        )
        .join(
          "",
        )}</select><input name="kf-value" type="number" step="any" aria-label="Valor do keyframe" value="${value}" required><button type="button" data-remove-keyframe aria-label="Remover keyframe">×</button></div>`;
    openForm(
      "Editar animação",
      `<p>Defina os momentos e valores da animação. A duração e o easing controlam o movimento entre eles.</p><div class="motion-form-top">${input("duration", "Duração", animation.duration, "number")}<label class="work-label">Curva de movimento<select name="easing">${Object.entries(
        {
          linear: "Linear",
          "ease-in": "Acelerar",
          "ease-out": "Desacelerar",
          "ease-in-out": "Suave",
        },
      )
        .map(
          ([key, label]) =>
            `<option value="${key}" ${key === animation.easing ? "selected" : ""}>${label}</option>`,
        )
        .join(
          "",
        )}</select></label></div><div class="keyframe-heading"><span>Tempo</span><span>Propriedade</span><span>Valor</span></div><div id="keyframe-rows">${animation.keyframes.flatMap((f) => Object.entries(f.values).map(([key, value]) => row(f.time, key, value))).join("")}</div><button type="button" class="add-keyframe">+ Adicionar keyframe</button>`,
      (data) => {
        const times = data.getAll("kf-time"),
          keys = data.getAll("kf-property"),
          values = data.getAll("kf-value"),
          frames = new Map();
        times.forEach((value, index) => {
          const time = Number(value);
          if (!frames.has(time)) frames.set(time, { time, values: {} });
          frames.get(time).values[keys[index]] = Number(values[index]);
        });
        const result = {
          ...animation,
          duration: Number(data.get("duration")),
          easing: data.get("easing"),
          keyframes: [...frames.values()].sort((a, b) => a.time - b.time),
        };
        return setData("animations", [
          ...(current().animations || []).filter((a) => a.id !== animation.id),
          result,
        ]);
      },
    );
    dialog.classList.add("motion-dialog");
    const rows = dialog.querySelector("#keyframe-rows");
    dialog.querySelector(".add-keyframe").onclick = () => {
      const time = Number(dialog.querySelector('[name="duration"]').value);
      rows.insertAdjacentHTML("beforeend", row(time, "opacity", 1));
      rows.lastElementChild.querySelector("input").focus();
    };
    rows.onclick = (e) => {
      const button = e.target.closest("[data-remove-keyframe]");
      if (button) {
        if (rows.children.length <= 2) {
          notice("Mantenha ao menos dois keyframes.");
          return;
        }
        button.closest(".keyframe-row").remove();
      }
    };
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches?.("[data-prototype-handle]")) {
      e.preventDefault();
      document.querySelector('#connection-form [name="targetId"]')?.focus();
      return;
    }
    if (e.key === "Escape" && state.drag?.kind === "connection") {
      state.drag = null;
      renderScene();
      return;
    }
    if (
      state.project &&
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "k" &&
      !dialog.open
    ) {
      e.preventDefault();
      toggleChat().catch((err) => notice(err.message, true));
    } else if (e.key === "Escape" && chatOpen && !dialog.open) {
      e.preventDefault();
      closeChat();
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "page-select") {
      stopMotion();
      state.pageId = e.target.value;
      state.selected = null;
      state.selectedIds = [];
      refresh();
      fit();
      document
        .querySelector("#canvas")
        ?.animate([{ opacity: 0.15 }, { opacity: 1 }], {
          duration: 220,
          easing: "ease-out",
        });
    }
  });
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b || !state.project || b.disabled) return;
    try {
      if (b.dataset.suggestion) {
        const form = b
          .closest("#kendrick-popover,#inspector")
          ?.querySelector("[data-kendrick-form]");
        if (form) {
          form.elements.prompt.value = b.dataset.suggestion;
          form.elements.prompt.focus();
          saveDraft(b.closest("#kendrick-popover,#inspector"));
        }
      }
      if (b.dataset.work) await act(b.dataset.work);
      if (b.dataset.editInteraction) {
        const item = current().interactions.find(
          (i) => i.id === b.dataset.editInteraction,
        );
        if (item) {
          editingInteractionId = item.id;
          select(item.nodeId);
        }
      }
      if (b.dataset.previewFlow)
        window.open(
          `/api/projects/${state.project.id}/prototype?flow=${encodeURIComponent(b.dataset.previewFlow)}`,
          "_blank",
          "noopener",
        );
      if (b.dataset.deleteFlow)
        await setData(
          "flows",
          (current().flows || []).filter((f) => f.id !== b.dataset.deleteFlow),
        );
      if (b.dataset.font && selected()?.type === "text")
        await commit([
          {
            type: "update_node",
            id: selected().id,
            changes: { fontFamily: b.dataset.font },
          },
        ]);
      if (b.dataset.component) {
        await commit([
          {
            type: "instantiate_component",
            componentId: b.dataset.component,
            id: uuid(),
            pageId: state.pageId,
          },
        ]);
        fit();
      }
      if (b.dataset.icon) {
        const id = uuid();
        if (
          await commit([
            {
              type: "create_node",
              node: {
                id,
                type: "icon",
                name: b.dataset.icon,
                icon: b.dataset.icon,
                pageId: state.pageId,
                x: 40,
                y: 40,
                width: 32,
                height: 32,
                fill: "#328BFF",
              },
            },
          ])
        )
          select(id);
      }
      if (b.dataset.deleteInteraction)
        await setData(
          "interactions",
          current().interactions.filter(
            (i) => i.id !== b.dataset.deleteInteraction,
          ),
        );
      if (b.dataset.deleteAnimation)
        await commit([
          {
            type: "set_project_data",
            field: "interactions",
            value: current().interactions.filter(
              (i) => i.animationId !== b.dataset.deleteAnimation,
            ),
          },
          {
            type: "set_project_data",
            field: "animations",
            value: current().animations.filter(
              (a) => a.id !== b.dataset.deleteAnimation,
            ),
          },
        ]);
      if (b.dataset.animation)
        editAnimation(
          current().animations.find((a) => a.id === b.dataset.animation),
        );
      if (b.dataset.deleteToken)
        await setData(
          "tokens",
          current().tokens.filter((t) => t.id !== b.dataset.deleteToken),
        );
      if (b.dataset.token && selected()) {
        const token = current().tokens.find((t) => t.id === b.dataset.token),
          key =
            token.type === "color"
              ? "fill"
              : token.type === "number"
                ? "gap"
                : "text";
        await commit([
          {
            type: "update_node",
            id: selected().id,
            changes: {
              [key]: token.value,
              tokenBindings: {
                ...(selected().tokenBindings || {}),
                [key]: token.id,
              },
            },
          },
        ]);
      }
      if (b.dataset.renamePage) {
        const p = pages().find((p) => p.id === b.dataset.renamePage);
        openForm("Renomear página", input("name", "Nome", p.name), (data) =>
          commit([{ type: "rename_page", id: p.id, name: data.get("name") }]),
        );
      }
      if (b.dataset.deletePage) {
        openForm(
          "Excluir página e seus elementos?",
          `<p>Esta alteração pode ser desfeita pelo histórico.</p>`,
          () => commit([{ type: "delete_page", id: b.dataset.deletePage }]),
        );
      }
      if (b.dataset.session) {
        applying = b.dataset.command === "apply";
        updateDock();
        try {
          await api(
            `/api/projects/${state.project.id}/sessions/${b.dataset.session}/${b.dataset.command}`,
            {},
          );
          state.project = await api(`/api/projects/${state.project.id}`);
          refresh();
          await loadSessions();
        } finally {
          applying = false;
          updateDock();
        }
      }
    } catch (err) {
      notice(err.message, true);
    }
  });
  return {
    mount,
    visibleDocument,
    renderInspector,
    connectorDown,
    connectorMove,
    connectorUp,
    vectorDown: vector.down,
    vectorMove: vector.move,
    vectorUp: vector.up,
    decorateScene: vector.decorateScene,
    decorateInspector,
    act,
    stopMotion,
    updatePages,
    connectionMarkup(doc) {
      if (state.mode !== "prototype") return "";
      const scale = state.view.scale,
        node = doc.nodes.find((n) => n.id === state.selected);
      const point = (n) => {
        const p = position(n, doc.nodes);
        return { x: p.x + n.width, y: p.y + n.height / 2 };
      };
      const curve = (a, b) =>
        `M${a.x} ${a.y} C${a.x + 80} ${a.y} ${b.x - 80} ${b.y} ${b.x} ${b.y}`;
      const connections = doc.interactions
        .map((i) => {
          if (!["navigate", "overlay"].includes(i.action)) return "";
          const source = doc.nodes.find((n) => n.id === i.nodeId),
            target = doc.nodes.find((n) => n.id === i.targetId);
          if (!source || !target) return "";
          const a = point(source),
            p = position(target, doc.nodes),
            b = { x: p.x, y: p.y + target.height / 2 };
          return `<path d="${curve(a, b)}" fill="none" stroke="#A28CFF" stroke-width="${2 / scale}" marker-end="url(#prototype-arrow)"/>`;
        })
        .join("");
      let draft = "";
      if (state.drag?.kind === "connection") {
        const source = doc.nodes.find((n) => n.id === state.drag.nodeId),
          target = doc.nodes.find((n) => n.id === state.drag.targetId);
        if (source)
          draft += `<path d="${curve(point(source), state.drag.point)}" fill="none" stroke="#328BFF" stroke-width="${2 / scale}" stroke-dasharray="${5 / scale} ${4 / scale}"/>`;
        if (target) {
          const p = position(target, doc.nodes);
          draft += `<rect x="${p.x}" y="${p.y}" width="${target.width}" height="${target.height}" fill="none" stroke="#328BFF" stroke-width="${3 / scale}"/>`;
        }
      }
      const handle = node ? point(node) : null;
      return `<defs><marker id="prototype-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#A28CFF"/></marker></defs><g pointer-events="none">${connections}${draft}</g>${handle ? `<circle data-prototype-handle="${node.id}" cx="${handle.x + 8 / scale}" cy="${handle.y}" r="${7 / scale}" fill="#328BFF" stroke="#fff" stroke-width="${1.5 / scale}" pointer-events="all" style="cursor:crosshair" role="button" tabindex="0" aria-label="Arrastar conexão de ${esc(node.name)}"><title>Arraste até o frame de destino ou use o formulário de conexão</title></circle>` : ""}`;
    },
  };
}
