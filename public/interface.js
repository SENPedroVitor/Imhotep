import { artwork } from "./kendrick-art.js";
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = "cubic-bezier(.22,1,.36,1)";
export function enter(
  element,
  key = "default",
  { distance = 7, duration = 220 } = {},
) {
  if (!element || reduced() || element.dataset.entranceKey === key) return;
  element.dataset.entranceKey = key;
  element.getAnimations().forEach((a) => a.cancel());
  element.animate(
    [
      { opacity: 0, transform: `translateY(${distance}px)` },
      { opacity: 1, transform: "translateY(0)" },
    ],
    { duration, easing: ease },
  );
}
export function transitionView(update) {
  if (document.startViewTransition && !reduced())
    return document.startViewTransition(update);
  update();
}
// A single pointer subscription serves every mounted avatar. No per-frame DOM
// queries or timers survive after an avatar is disconnected.
const avatars = new Set();
const cursor = { x: 0, y: 0, visible: false };
let cursorFrame = 0;
function trackCursor(event) {
  if (event.pointerType === "touch") return;
  cursor.x = event.clientX;
  cursor.y = event.clientY;
  cursor.visible = true;
  if (cursorFrame) return;
  cursorFrame = requestAnimationFrame(() => {
    cursorFrame = 0;
    for (const avatar of avatars) {
      avatar.noteActivity();
      avatar.followCursor();
    }
  });
}
document.addEventListener("pointermove", trackCursor, { passive: true });
document.addEventListener("pointerout", (event) => {
  if (event.relatedTarget) return;
  cursor.visible = false;
  for (const avatar of avatars) avatar.glance(0, 0);
});
for (const type of ["focusin", "input"])
  document.addEventListener(type, (event) => {
    if (!event.target.closest?.("[data-kendrick-form]")) return;
    for (const avatar of avatars) {
      avatar.noteActivity();
      avatar.react("listening", 1500);
    }
  });
document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest?.("#canvas")) return;
  for (const avatar of avatars) {
    avatar.noteActivity();
    avatar.canvasFocused = true;
    avatar.react("working", 900);
  }
});
document.addEventListener("pointerup", () => {
  for (const avatar of avatars)
    if (avatar.canvasFocused) {
      avatar.canvasFocused = false;
      avatar.react("listening", 1000);
    }
});
const poses = new Map();
function getPose(name) {
  if (!poses.has(name)) {
    const doc = new DOMParser().parseFromString(
      artwork[name] || artwork.idle,
      "image/svg+xml",
    );
    const shapes = [...doc.documentElement.children].filter(
      (n) => n.tagName.toLowerCase() === "svg",
    );
    poses.set(
      name,
      shapes.slice(1).map((shape) => ({
        x: Number(shape.getAttribute("x")),
        y: Number(shape.getAttribute("y")),
        width: Number(shape.getAttribute("width")),
        height: Number(shape.getAttribute("height")),
        rotation: Number(
          shape.getAttribute("transform")?.match(/rotate\(([-\d.]+)/)?.[1] || 0,
        ),
        viewBox: shape.getAttribute("viewBox"),
        path: shape.querySelector("path").getAttribute("d"),
      })),
    );
  }
  return poses.get(name);
}
class KendrickAvatar extends HTMLElement {
  static observedAttributes = ["mood"];
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.controller = null;
    this.blinkTimer = null;
    this.ambientTimer = null;
    this.expressionTimer = null;
    this.poseFrame = 0;
    this.lastActivity = performance.now();
    this.idleStep = 0;
  }
  get baseMood() {
    const value = this.getAttribute("mood") || "idle";
    return Object.hasOwn(artwork, value) ? value : "idle";
  }
  get busy() {
    return ["thinking", "working", "attention", "success", "offline"].includes(
      this.baseMood,
    );
  }
  connectedCallback() {
    this.build();
    avatars.add(this);
    this.controller = new AbortController();
    this.addEventListener(
      "pointerenter",
      () => {
        this.noteActivity();
        this.react("greeting", 1100);
      },
      { signal: this.controller.signal },
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) {
          this.pause();
          this.shadowRoot.querySelector(".breathing").style.animationPlayState =
            "paused";
        } else {
          this.shadowRoot.querySelector(".breathing").style.animationPlayState =
            "";
          this.noteActivity();
          this.react("greeting", 1000);
          this.schedule();
        }
      },
      { signal: this.controller.signal },
    );
    this.setExpression(this.baseMood, true);
    if (!this.busy) this.react("greeting", 1000);
    this.followCursor();
    this.schedule();
  }
  disconnectedCallback() {
    avatars.delete(this);
    this.pause();
    this.controller?.abort();
    cancelAnimationFrame(this.poseFrame);
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (
      !this.isConnected ||
      !this.shadowRoot.querySelector(".art") ||
      oldValue === newValue
    )
      return;
    clearTimeout(this.expressionTimer);
    this.setExpression(this.baseMood);
    this.schedule();
    this.followCursor();
  }
  pause() {
    clearTimeout(this.blinkTimer);
    clearTimeout(this.ambientTimer);
    clearTimeout(this.expressionTimer);
  }
  build() {
    this.setAttribute("role", "img");
    this.setAttribute("aria-label", "Kendrick");
    this.shadowRoot.innerHTML = `<style>:host{display:inline-block;width:48px;height:48px;flex-shrink:0;vertical-align:middle;contain:layout style}.breathing{display:block;width:100%;height:100%;transform-origin:50% 80%;animation:breathe 4.8s ease-in-out infinite}.glow{display:block;width:100%;height:100%;rotate:var(--head-tilt,0deg);transform-origin:50% 72%;transition:rotate 240ms ease-out;filter:drop-shadow(0 2px 4px #0003)}.art{display:block;width:100%;height:100%;overflow:visible}.art>svg{overflow:visible}.eye{transform:translate(var(--gaze-x,0px),var(--gaze-y,0px));transition:transform 160ms ease-out}.eyelid{transform-box:fill-box;transform-origin:center}:host([data-expression=thinking]) .breathing{animation:breathe 3.6s ease-in-out infinite,ponder 6s ease-in-out infinite}:host([data-expression=success]) .breathing{animation:breathe 4.8s ease-in-out infinite,celebrate 700ms cubic-bezier(.22,1,.36,1) 1}:host([data-expression=offline]) .breathing{animation-duration:6s}@keyframes breathe{0%,100%{transform:translateY(1px) scale(.985,1)}50%{transform:translateY(-2px) scale(1.018,1.028)}}@keyframes ponder{0%,100%{rotate:-3deg}50%{rotate:3deg}}@keyframes celebrate{40%{translate:0 -5px}70%{translate:0 1px}100%{translate:0 0}}@media(prefers-reduced-motion:reduce){.breathing{animation:none!important}.eye,.glow{transition:none}}</style><span class="breathing"><span class="glow">${artwork.idle}</span></span>`;
    const svg = this.shadowRoot.querySelector("svg");
    svg.classList.add("art");
    const shapes = [...svg.children].filter(
      (n) => n.tagName.toLowerCase() === "svg",
    );
    this.eyes = shapes.slice(1);
    this.currentPose = getPose("idle").map((p) => ({ ...p }));
    this.eyes.forEach((shape, index) => {
      // Pencil stretches the same eye path for squints, smiles and closed lids.
      shape.setAttribute("preserveAspectRatio", "none");
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.classList.add("eye");
      group.dataset.eye = index ? "right" : "left";
      shape.replaceWith(group);
      group.append(shape);
      shape.querySelectorAll("path").forEach((p) => p.classList.add("eyelid"));
    });
  }
  setExpression(name, immediate = false) {
    if (this.dataset.expression === name && !immediate) return;
    const target = getPose(name),
      from = this.currentPose.map((p) => ({ ...p }));
    this.dataset.expression = name;
    this.setAttribute(
      "aria-label",
      `Kendrick — ${{ idle: "neutro", greeting: "piscando", listening: "curioso", thinking: "pensando", working: "focado", attention: "surpreso", success: "feliz", offline: "descansando" }[name]}`,
    );
    cancelAnimationFrame(this.poseFrame);
    const start = performance.now(),
      duration = immediate || reduced() ? 0 : 260;
    const tick = (now) => {
      const t = duration
        ? Math.min(1, Math.max(0, (now - start) / duration))
        : 1;
      const eased = 1 - (1 - t) ** 3;
      this.eyes.forEach((shape, i) => {
        const next = {};
        for (const key of ["x", "y", "width", "height", "rotation"])
          next[key] = from[i][key] + (target[i][key] - from[i][key]) * eased;
        this.currentPose[i] = next;
        for (const key of ["x", "y", "width", "height"])
          shape.setAttribute(key, next[key]);
        shape.setAttribute(
          "transform",
          `rotate(${next.rotation} ${next.x + next.width / 2} ${next.y + next.height / 2})`,
        );
        shape.setAttribute("viewBox", target[i].viewBox);
        shape.querySelector("path").setAttribute("d", target[i].path);
      });
      if (t < 1 && this.isConnected)
        this.poseFrame = requestAnimationFrame(tick);
    };
    tick(start);
  }
  react(name, duration = 1200) {
    if (this.busy) return;
    clearTimeout(this.expressionTimer);
    this.setExpression(name);
    this.expressionTimer = setTimeout(() => {
      if (this.isConnected) this.setExpression(this.baseMood);
    }, duration);
  }
  noteActivity() {
    const resting = this.dataset.expression === "offline" && !this.busy;
    this.lastActivity = performance.now();
    if (resting) this.react("greeting", 1100);
  }
  followCursor() {
    if (reduced() || !cursor.visible || this.dataset.expression === "offline") {
      this.glance(0, 0);
      return;
    }
    const box = this.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const dx = cursor.x - box.left - box.width / 2,
      dy = cursor.y - box.top - box.height / 2,
      distance = Math.max(100, Math.hypot(dx, dy));
    this.glance(dx / distance, dy / distance);
  }
  glance(x, y) {
    const art = this.shadowRoot.querySelector(".art");
    if (!art) return;
    art.style.setProperty("--gaze-x", `${x * 15}px`);
    art.style.setProperty("--gaze-y", `${y * 10}px`);
    this.shadowRoot
      .querySelector(".glow")
      .style.setProperty("--head-tilt", `${x * 2.8}deg`);
  }
  blink() {
    if (
      reduced() ||
      document.hidden ||
      ["offline", "greeting"].includes(this.dataset.expression)
    )
      return;
    for (const eye of this.shadowRoot.querySelectorAll(".eyelid"))
      eye.animate(
        [
          { transform: "scaleY(1)", offset: 0 },
          { transform: "scaleY(.06)", offset: 0.42 },
          { transform: "scaleY(1)", offset: 1 },
        ],
        { duration: 165, easing: "ease-in-out" },
      );
  }
  updateAmbient() {
    if (this.busy) return;
    if (performance.now() - this.lastActivity >= 20000) {
      clearTimeout(this.expressionTimer);
      this.setExpression("offline");
      this.glance(0, 0);
      return;
    }
    if (this.dataset.expression === this.baseMood) {
      const expression = ["listening", "greeting", "idle"][this.idleStep++ % 3];
      this.react(expression, expression === "greeting" ? 1000 : 1700);
    }
  }
  schedule() {
    clearTimeout(this.blinkTimer);
    clearTimeout(this.ambientTimer);
    if (document.hidden) return;
    const blink = () => {
      this.blink();
      this.blinkTimer = setTimeout(blink, 2800 + Math.random() * 3600);
    };
    this.blinkTimer = setTimeout(blink, 1800 + Math.random() * 2000);
    const act = () => {
      this.updateAmbient();
      this.ambientTimer = setTimeout(act, 4500);
    };
    this.ambientTimer = setTimeout(act, 4500);
  }
}
customElements.define("kendrick-avatar", KendrickAvatar);
export function installInterface(dialog) {
  const show = dialog.showModal.bind(dialog),
    close = dialog.close.bind(dialog);
  let closing = null;
  function decorate() {
    if (dialog.classList.contains("preview-dialog")) return;
    const host = dialog.querySelector("form") || dialog;
    if (host.querySelector(".dialog-heading")) return;
    const title = host.querySelector("h2");
    if (!title) return;
    const heading = document.createElement("header");
    heading.className = "dialog-heading";
    heading.innerHTML =
      '<div class="dialog-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7h16v13H4zM8 4v6m8-6v6M4 11h16"/></svg></div><div class="dialog-heading-copy"><span class="dialog-eyebrow">IMHOTEP / WORKSPACE</span></div><button type="button" class="dialog-dismiss" data-action="close-dialog" aria-label="Fechar diálogo">×</button>';
    host.prepend(heading);
    heading.querySelector(".dialog-heading-copy").append(title);
    const body = document.createElement("div");
    body.className = "dialog-body";
    const footer = host.querySelector(":scope > footer");
    for (const child of [...host.childNodes])
      if (child !== heading && child !== footer) body.append(child);
    heading.after(body);
    dialog.setAttribute("aria-labelledby", "studio-dialog-title");
    title.id = "studio-dialog-title";
  }
  dialog.showModal = () => {
    closing?.cancel();
    closing = null;
    dialog.classList.remove("closing");
    decorate();
    show();
    if (!reduced()) {
      dialog.animate(
        [
          { opacity: 0, transform: "translateY(14px) scale(.975)" },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ],
        { duration: 240, easing: ease },
      );
    }
  };
  dialog.close = (value) => {
    if (!dialog.open) return;
    if (reduced()) {
      close(value);
      return;
    }
    if (closing) return;
    dialog.classList.add("closing");
    const animation = dialog.animate(
      [
        { opacity: 1, transform: "translateY(0) scale(1)" },
        { opacity: 0, transform: "translateY(7px) scale(.985)" },
      ],
      { duration: 130, easing: "ease-in", fill: "forwards" },
    );
    closing = animation;
    animation.finished
      .then(() => {
        if (closing !== animation) return;
        close(value);
        dialog.classList.remove("closing");
        closing = null;
        animation.cancel();
      })
      .catch(() => {});
  };
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    dialog.close();
  });
  dialog.addEventListener("click", (e) => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      dialog.close();
  });
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      const panel = document.querySelector("#inspector");
      if (panel) {
        const title = panel.querySelector(".inspector-title strong");
        const key =
          panel.dataset.mode ||
          (title?.querySelector("input")
            ? "design"
            : title?.textContent?.trim() || "design");
        if (panel.dataset.entranceKey !== key) {
          panel.dataset.entranceKey = key;
          [...panel.children]
            .slice(0, 8)
            .forEach((child) =>
              enter(child, key, { distance: 5, duration: 190 }),
            );
        }
      }
      const home = document.querySelector(".home-content");
      if (home && !home.dataset.entered) {
        home.dataset.entered = "true";
        enter(home, "home");
        home.querySelectorAll(".project-card,.new-card").forEach((card, i) => {
          if (!reduced())
            card.animate(
              [
                { opacity: 0, transform: "translateY(10px)" },
                { opacity: 1, transform: "none" },
              ],
              {
                duration: 260,
                delay: Math.min(i * 35, 175),
                easing: ease,
                fill: "backwards",
              },
            );
        });
      }
    });
  }).observe(document.querySelector("#app"), {
    childList: true,
    subtree: true,
  });
}
