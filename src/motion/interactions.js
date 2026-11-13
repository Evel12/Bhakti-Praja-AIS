import { motionEngine, completed } from "./engine.js";
import { safeTokens, observeMotionPolicy } from "./policy.js";

export function pointerRipple(
  surface,
  event,
  { tokens = safeTokens(surface), engine = motionEngine } = {},
) {
  if (!tokens || tokens.mode === "off") return completed();
  const node = surface.ownerDocument.createElement("span");
  node.className = "liquid-ripple";
  node.setAttribute("aria-hidden", "true");
  const rect = surface.getBoundingClientRect(),
    size = Math.hypot(rect.width, rect.height) * 2;
  if (tokens.mode === "full")
    Object.assign(node.style, {
      width: `${size}px`,
      height: `${size}px`,
      left: `${(event?.clientX ?? rect.left + rect.width / 2) - rect.left - size / 2}px`,
      top: `${(event?.clientY ?? rect.top + rect.height / 2) - rect.top - size / 2}px`,
    });
  else Object.assign(node.style, { inset: "0", borderRadius: "inherit" });
  surface.append(node);
  const handle = engine.animate(
    node,
    { scaleX: 1, scaleY: 1, opacity: 0 },
    {
      from: {
        scaleX: tokens.mode === "full" ? 0 : 1,
        scaleY: tokens.mode === "full" ? 0 : 1,
        opacity: tokens.effects.rippleOpacity,
      },
      preset: "smooth",
      tokens,
    },
  );
  handle.finished.then(() => node.remove());
  return {
    ...handle,
    cancel() {
      handle.cancel();
      node.remove();
    },
  };
}

/** Delegated interactions automatically cover future controls inside root.
 * An inner [data-liquid-surface] keeps the outer hitbox/focus ring stationary.
 */
export function createMotionScope(
  root,
  {
    selector = "[data-liquid-interactive]",
    preset = "snappy",
    press = true,
    hover = false,
    magnetic = false,
    ripple = true,
    spatialPress = true,
    filter = () => true,
    optionsFor = () => ({}),
    engine = motionEngine,
  } = {},
) {
  const states = new Map(),
    ripples = new Set(),
    cleanup = [];
  const win = root.ownerDocument.defaultView;
  let pointerFrame = null,
    disposed = false;
  const on = (target, name, fn, options) => {
    target.addEventListener(name, fn, options);
    cleanup.push(() => target.removeEventListener(name, fn, options));
  };
  const target = (e) => {
    const el = e.target.closest?.(selector);
    return el &&
      root.contains(el) &&
      filter(el) &&
      !el.matches(':disabled,[aria-disabled="true"]')
      ? el
      : null;
  };
  function state(el) {
    if (!states.has(el)) {
      const surface = el.querySelector("[data-liquid-surface]") || el;
      states.set(el, {
        surface,
        options: {
          press,
          hover,
          magnetic,
          ripple,
          spatialPress,
          ...optionsFor(el),
        },
        hover: false,
        pressed: false,
        x: 0,
        y: 0,
        rect: null,
        tokens: safeTokens(el),
      });
    }
    return states.get(el);
  }
  function draw(s) {
    if (!s.tokens || disposed) return;
    if (s.tokens.mode === "off") {
      engine.reset(s.surface);
      return;
    }
    const spatial = s.tokens.mode === "full",
      over = spatial && s.tokens.limits.hover && s.options.hover && s.hover;
    const scale = over ? s.tokens.scales.hover : 1;
    engine.animate(
      s.surface,
      {
        x: over && s.options.magnetic ? s.x : 0,
        y: over
          ? (s.options.magnetic ? s.y : 0) - s.tokens.distances.hoverLift
          : 0,
        scaleX:
          s.pressed && s.options.press && s.options.spatialPress
            ? s.tokens.scales.pressX
            : scale,
        scaleY:
          s.pressed && s.options.press && s.options.spatialPress
            ? s.tokens.scales.pressY
            : scale,
        opacity:
          s.pressed && s.options.press ? s.tokens.effects.pressOpacity : 1,
      },
      { preset, tokens: s.tokens, retain: true },
    );
  }
  function reset() {
    for (const [el, s] of states) {
      s.hover = false;
      s.pressed = false;
      s.x = s.y = 0;
      s.rect = null;
      s.tokens = safeTokens(el);
      engine.reset(s.surface);
    }
    for (const h of ripples) h.cancel();
    ripples.clear();
  }
  on(root, "pointerover", (e) => {
    const el = target(e);
    if (!el || el.contains(e.relatedTarget)) return;
    const s = state(el);
    s.tokens = safeTokens(el);
    s.hover = true;
    if (s.options.hover && s.options.magnetic)
      s.rect = el.getBoundingClientRect();
    if (s.options.hover) draw(s);
  });
  on(root, "pointerout", (e) => {
    const el = target(e);
    if (!el || el.contains(e.relatedTarget)) return;
    const s = state(el);
    s.hover = false;
    s.x = s.y = 0;
    if (s.options.hover) draw(s);
  });
  on(
    root,
    "pointermove",
    (e) => {
      if (!magnetic) return;
      const el = target(e);
      if (!el) return;
      const s = state(el);
      if (
        !s.tokens?.limits.hover ||
        !s.options.hover ||
        !s.options.magnetic ||
        !s.hover
      )
        return;
      const r = s.rect || (s.rect = el.getBoundingClientRect());
      s.x =
        Math.max(
          -1,
          Math.min(1, (e.clientX - r.left - r.width / 2) / (r.width / 2 || 1)),
        ) * s.tokens.distances.magnetic;
      s.y =
        Math.max(
          -1,
          Math.min(1, (e.clientY - r.top - r.height / 2) / (r.height / 2 || 1)),
        ) * s.tokens.distances.magnetic;
      if (pointerFrame === null)
        pointerFrame = win.requestAnimationFrame(() => {
          pointerFrame = null;
          for (const s of states.values()) if (s.hover) draw(s);
        });
    },
    { passive: true },
  );
  function down(el, event) {
    const s = state(el);
    s.tokens = safeTokens(el);
    s.pressed = true;
    draw(s);
    if (s.options.ripple) {
      const h = pointerRipple(s.surface, event, { tokens: s.tokens, engine });
      ripples.add(h);
      h.finished.then(() => ripples.delete(h));
    }
  }
  on(root, "pointerdown", (e) => {
    const el = target(e);
    if (el && e.button === 0) down(el, e);
  });
  const release = () => {
    for (const s of states.values())
      if (s.pressed) {
        s.pressed = false;
        draw(s);
      }
  };
  on(win, "pointerup", release);
  on(win, "pointercancel", release);
  on(win, "blur", reset);
  on(root, "keydown", (e) => {
    if (e.repeat || !["Enter", " "].includes(e.key)) return;
    const el = target(e);
    if (
      el &&
      el.matches('button,a,[role="button"]') &&
      (e.key === "Enter" || el.matches('button,[role="button"]'))
    )
      down(el);
  });
  on(root, "keyup", (e) => {
    if (["Enter", " "].includes(e.key)) release();
  });
  on(root, "focusout", (e) => {
    const el = target(e);
    if (el) {
      const s = state(el);
      s.pressed = false;
      draw(s);
    }
  });
  const invalidate = () => {
    for (const s of states.values()) s.rect = null;
  };
  on(win, "resize", invalidate, { passive: true });
  on(win, "scroll", invalidate, { passive: true, capture: true });
  cleanup.push(observeMotionPolicy(root, reset, engine));
  const removals = new win.MutationObserver(() => {
    for (const [el, s] of states)
      if (
        !root.contains(el) ||
        el.matches(':disabled,[aria-disabled="true"]')
      ) {
        engine.reset(s.surface);
        states.delete(el);
      }
  });
  removals.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["disabled", "aria-disabled"],
  });
  cleanup.push(() => removals.disconnect());
  return {
    refresh: reset,
    dispose() {
      if (disposed) return;
      reset();
      disposed = true;
      if (pointerFrame !== null) win.cancelAnimationFrame(pointerFrame);
      cleanup.forEach((fn) => fn());
      states.clear();
    },
    stats: () => engine.stats(),
  };
}
