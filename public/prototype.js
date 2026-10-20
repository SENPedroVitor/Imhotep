// Self-contained so the exact same runtime can be embedded in an offline export.
export function mountPrototype(
  doc,
  { stage, renderSvg, evaluateMotion, flowId, initialFrame },
) {
  const roots = doc.nodes.filter((n) => n.type === "frame" && !n.parentId);
  const flow = (doc.flows || []).find((f) => f.id === flowId) || doc.flows?.[0];
  let first = roots.some((n) => n.id === initialFrame)
    ? initialFrame
    : flow?.startFrameId || roots[0]?.id;
  let active = first,
    overlay = null,
    stack = [],
    timers = [],
    frame = 0,
    hovered = [],
    destroyed = false;
  const clock = new Map(),
    controller = new AbortController();
  const signal = controller.signal;
  let clearTransition = () => {};
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rootId = (id) => {
    let node = doc.nodes.find((n) => n.id === id);
    while (node?.parentId) node = doc.nodes.find((n) => n.id === node.parentId);
    return node?.id;
  };
  const visible = (id) => rootId(id) === (overlay || active);
  const manual = new Set(
    (doc.interactions || [])
      .filter((i) => i.action === "animate")
      .map((i) => i.animationId),
  );
  function startAutomatic() {
    const now = performance.now();
    for (const animation of doc.animations || [])
      if (
        !manual.has(animation.id) &&
        [active, overlay].includes(rootId(animation.nodeId))
      )
        clock.set(animation.id, now);
  }
  function render(now = performance.now()) {
    if (destroyed) return;
    cancelAnimationFrame(frame);
    const times = Object.fromEntries(
      (doc.animations || [])
        .filter((a) => clock.has(a.id))
        .map((a) => [a.id, reduced() ? a.duration : now - clock.get(a.id)]),
    );
    const animated = evaluateMotion(doc, 0, times);
    stage.innerHTML = active
      ? renderSvg(animated, active)
      : renderSvg(animated);
    stage.dataset.activeFrame = active || "";
    stage.dataset.overlay = overlay || "";
    if (overlay) {
      const layer = document.createElement("div");
      layer.className = "overlay";
      layer.innerHTML = renderSvg(animated, overlay);
      stage.append(layer);
    }
    for (const interaction of doc.interactions || []) {
      for (const node of stage.querySelectorAll(
        `[data-node-id="${CSS.escape(interaction.nodeId)}"]`,
      )) {
        node.dataset.hotspot = "";
        node.style.cursor = "pointer";
      }
    }
    if (
      !reduced() &&
      (doc.animations || []).some(
        (a) =>
          clock.has(a.id) &&
          now - clock.get(a.id) < a.duration &&
          [active, overlay].includes(rootId(a.nodeId)),
      )
    )
      frame = requestAnimationFrame(render);
  }
  function schedule() {
    timers.forEach(clearTimeout);
    timers = (doc.interactions || [])
      .filter((i) => i.trigger === "after-delay" && visible(i.nodeId))
      .map((i) => setTimeout(() => act(i), i.delay ?? i.duration));
  }
  function act(i) {
    const now = performance.now();
    if (i.action === "animate") {
      const animation = doc.animations.find((a) => a.id === i.animationId);
      if (animation && [active, overlay].includes(rootId(animation.nodeId))) {
        clock.set(animation.id, now);
        render(now);
      }
      return;
    }
    clearTransition();
    let previous;
    if (i.transition !== "instant" && !reduced() && i.duration > 0) {
      const box = stage.getBoundingClientRect();
      previous = stage.cloneNode(true);
      previous.removeAttribute("id");
      previous.className = "prototype-transition-layer";
      previous.setAttribute("aria-hidden", "true");
      previous.inert = true;
      previous.style.cssText = `position:fixed;left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;display:grid;place-items:center;overflow:hidden;pointer-events:none;z-index:3`;
      for (const svg of previous.querySelectorAll(":scope>svg")) {
        svg.style.maxWidth = "95vw";
        svg.style.maxHeight = "90vh";
      }
      document.body.append(previous);
    }
    if (i.action === "back") {
      active = stack.pop() || first;
      overlay = null;
    } else if (i.action === "close") overlay = null;
    else if (i.action === "overlay") overlay = i.targetId;
    else {
      stack.push(active);
      active = i.targetId;
      overlay = null;
      clock.clear();
    }
    hovered = [];
    startAutomatic();
    render(now);
    schedule();
    if (previous) {
      const animations = [],
        oldIndex = stage.style.zIndex;
      stage.style.zIndex = "2";
      const animate = (element, frames) =>
        animations.push(
          element.animate(frames, {
            duration: i.duration,
            easing: "cubic-bezier(.22,1,.36,1)",
            fill: "both",
          }),
        );
      if (i.transition === "move-in") {
        previous.style.zIndex = "1";
        animate(stage, [
          { transform: "translateX(100%)" },
          { transform: "translateX(0)" },
        ]);
      } else if (i.transition === "move-out") {
        animate(previous, [
          { transform: "translateX(0)" },
          { transform: "translateX(-100%)" },
        ]);
      } else if (i.transition === "push") {
        animate(previous, [
          { transform: "translateX(0)" },
          { transform: "translateX(-100%)" },
        ]);
        animate(stage, [
          { transform: "translateX(100%)" },
          { transform: "translateX(0)" },
        ]);
      } else if (i.transition === "slide") {
        animate(previous, [
          { opacity: 1, transform: "translateX(0)" },
          { opacity: 0, transform: "translateX(-35px)" },
        ]);
        animate(stage, [
          { opacity: 0, transform: "translateX(35px)" },
          { opacity: 1, transform: "translateX(0)" },
        ]);
      } else {
        animate(previous, [{ opacity: 1 }, { opacity: 0 }]);
      }
      const cleanup = () => {
        previous.remove();
        animations.forEach((a) => a.cancel());
        if (clearTransition === cleanup) {
          stage.style.zIndex = oldIndex;
          clearTransition = () => {};
        }
      };
      clearTransition = cleanup;
      Promise.all(animations.map((a) => a.finished.catch(() => {}))).then(
        cleanup,
      );
    }
  }
  function ancestry(target) {
    const ids = [];
    for (
      let node = target?.closest?.("[data-node-id]");
      node;
      node = node.parentElement?.closest("[data-node-id]")
    )
      ids.push(node.dataset.nodeId);
    return ids;
  }
  function dispatch(trigger, ids, key) {
    for (const id of ids) {
      const interaction = (doc.interactions || []).find(
        (i) =>
          i.nodeId === id &&
          i.trigger === trigger &&
          (trigger !== "key" || i.key === key),
      );
      if (interaction && visible(id)) {
        act(interaction);
        return true;
      }
    }
    return false;
  }
  for (const [event, trigger] of [
    ["click", "click"],
    ["pointerdown", "press"],
    ["pointerup", "release"],
  ])
    stage.addEventListener(
      event,
      (e) => dispatch(trigger, ancestry(e.target)),
      { signal },
    );
  stage.addEventListener(
    "pointermove",
    (e) => {
      const ids = ancestry(e.target),
        previous = hovered;
      hovered = ids;
      dispatch(
        "mouse-leave",
        previous.filter((id) => !ids.includes(id)),
      );
      dispatch(
        "hover",
        ids.filter((id) => !previous.includes(id)),
      );
    },
    { signal },
  );
  stage.addEventListener(
    "pointerleave",
    () => {
      const previous = hovered;
      hovered = [];
      dispatch("mouse-leave", previous);
    },
    { signal },
  );
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.target.closest?.("input,textarea,select,[contenteditable]")) return;
      const ids = doc.nodes.filter((n) => visible(n.id)).map((n) => n.id);
      if (dispatch("key", ids, e.key)) e.preventDefault();
    },
    { signal },
  );
  document.querySelector("[data-restart-prototype]")?.addEventListener(
    "click",
    () => {
      clearTransition();
      active = first;
      overlay = null;
      stack = [];
      hovered = [];
      clock.clear();
      startAutomatic();
      render();
      schedule();
    },
    { signal },
  );
  const flowSelect = document.querySelector("[data-prototype-flow]");
  if (flowSelect) {
    if (flow) flowSelect.value = flow.id;
    flowSelect.addEventListener(
      "change",
      () => {
        const next = doc.flows.find((f) => f.id === flowSelect.value);
        if (!next) return;
        clearTransition();
        first = next.startFrameId;
        active = first;
        overlay = null;
        stack = [];
        hovered = [];
        clock.clear();
        startAutomatic();
        render();
        schedule();
      },
      { signal },
    );
  }
  const hotspotButton = document.querySelector("[data-toggle-hotspots]");
  hotspotButton?.addEventListener(
    "click",
    () => {
      const visible = document.body.classList.toggle("show-hotspots");
      hotspotButton.setAttribute("aria-pressed", String(visible));
    },
    { signal },
  );
  startAutomatic();
  render();
  schedule();
  return {
    destroy() {
      clearTransition();
      destroyed = true;
      controller.abort();
      timers.forEach(clearTimeout);
      cancelAnimationFrame(frame);
    },
  };
}
