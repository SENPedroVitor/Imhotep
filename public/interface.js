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
class KendrickAvatar extends HTMLElement {
  static observedAttributes = ["mood"];
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.blinkTimer = null;
    this.lookTimer = null;
    this.controller = null;
  }
  connectedCallback() {
    this.render();
    this.controller = new AbortController();
    this.addEventListener("pointerenter", () => this.glance(1, -1), {
      signal: this.controller.signal,
    });
    this.addEventListener("pointerleave", () => this.glance(0, 0), {
      signal: this.controller.signal,
    });
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) this.pause();
        else this.schedule();
      },
      { signal: this.controller.signal },
    );
  }
  disconnectedCallback() {
    this.pause();
    this.controller?.abort();
  }
  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }
  pause() {
    clearTimeout(this.blinkTimer);
    clearTimeout(this.lookTimer);
  }
  render() {
    this.pause();
    const mood = this.getAttribute("mood") || "idle";
    this.setAttribute("role", "img");
    this.setAttribute("aria-label", "Kendrick");
    this.shadowRoot.innerHTML = `<style>:host{display:inline-block;width:48px;height:48px;flex-shrink:0;vertical-align:middle;contain:layout style}.breathing{display:block;width:100%;height:100%;transform-origin:50% 80%;animation:breathe 4.8s ease-in-out infinite}.art{display:block;width:100%;height:100%;overflow:visible}.art>svg{overflow:visible}.eye{transform:translate(var(--gaze-x,0px),var(--gaze-y,0px));transition:transform 700ms cubic-bezier(.22,1,.36,1)}.eyelid{transform-box:fill-box;transform-origin:center}.glow{filter:drop-shadow(0 2px 4px #0003)}:host([mood=thinking]) .breathing{animation:breathe 3.6s ease-in-out infinite,ponder 6s ease-in-out infinite}:host([mood=success]) .breathing{animation:breathe 4.8s ease-in-out infinite,celebrate 700ms cubic-bezier(.22,1,.36,1) 1}:host([mood=offline]) .breathing{animation-duration:6s}@keyframes breathe{0%,100%{transform:translateY(1px) scale(.985,1)}50%{transform:translateY(-2px) scale(1.018,1.028)}}@keyframes ponder{0%,100%{rotate:-3deg}50%{rotate:3deg}}@keyframes celebrate{40%{translate:0 -5px}70%{translate:0 1px}100%{translate:0 0}}@media(prefers-reduced-motion:reduce){.breathing{animation:none!important}.eye{transition:none}}</style><span class="breathing"><span class="glow">${artwork[mood] || artwork.idle}</span></span>`;
    const svg = this.shadowRoot.querySelector("svg");
    svg.classList.add("art");
    const shapes = [...svg.children].filter(
      (n) => n.tagName.toLowerCase() === "svg",
    );
    shapes.slice(1).forEach((shape, index) => {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.classList.add("eye");
      group.dataset.eye = index ? "right" : "left";
      shape.replaceWith(group);
      group.append(shape);
      shape.querySelectorAll("path").forEach((p) => p.classList.add("eyelid"));
    });
    this.schedule();
  }
  blink() {
    if (reduced() || document.hidden) return;
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
  glance(x, y) {
    this.shadowRoot
      .querySelector(".art")
      ?.style.setProperty("--gaze-x", `${x * 2.5}px`);
    this.shadowRoot
      .querySelector(".art")
      ?.style.setProperty("--gaze-y", `${y * 1.8}px`);
  }
  schedule() {
    this.pause();
    if (document.hidden || reduced()) return;
    const blink = () => {
      this.blink();
      this.blinkTimer = setTimeout(blink, 2800 + Math.random() * 3600);
    };
    this.blinkTimer = setTimeout(blink, 1800 + Math.random() * 2000);
    const look = () => {
      const mood = this.getAttribute("mood");
      if (mood !== "offline") {
        this.glance((Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 0.9);
        this.lookTimer = setTimeout(look, 2800 + Math.random() * 3500);
      }
    };
    this.lookTimer = setTimeout(look, 2200 + Math.random() * 2200);
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
