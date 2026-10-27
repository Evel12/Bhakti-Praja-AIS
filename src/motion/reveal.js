import { motionEngine } from "./engine.js";
import { safeTokens, observeMotionPolicy } from "./policy.js";
import { animatePresence } from "./presence.js";

export function observeReveals(
  root,
  {
    selector = "[data-liquid-reveal]",
    once = true,
    preset = "gentle",
    engine = motionEngine,
  } = {},
) {
  const nodes = [...root.querySelectorAll(selector)],
    originalOpacity = new Map(nodes.map((el) => [el, el.style.opacity])),
    win = root.ownerDocument.defaultView,
    handles = new Map(),
    revealed = new WeakSet();
  let observer,
    disposed = false;
  const restore = (el) => {
    engine.reset(el);
    el.style.opacity = originalOpacity.get(el);
  };
  const visible = () => {
    nodes.forEach((el) => {
      restore(el);
      observer?.unobserve(el);
      revealed.add(el);
    });
    handles.clear();
  };
  if (!win.IntersectionObserver) return { dispose() {}, refresh() {} };
  try {
    const tokens = safeTokens(root);
    if (!tokens || tokens.mode === "off") return { dispose() {}, refresh() {} };
    observer = new win.IntersectionObserver(
      (entries) => {
        if (disposed) return;
        for (const entry of entries)
          if (entry.isIntersecting && !(once && revealed.has(entry.target))) {
            const el = entry.target;
            if (once) {
              observer.unobserve(el);
              revealed.add(el);
            }
            const h = animatePresence(el, {
              preset,
              tokens: safeTokens(el),
              engine,
            });
            handles.set(el, h);
            h.finished.then(() => {
              if (handles.get(el) === h) handles.delete(el);
            });
          }
      },
      { threshold: tokens.effects.revealThreshold },
    );
    const eligible = nodes.filter((el) => safeTokens(el)?.mode !== "off");
    eligible.forEach((el) => observer.observe(el));
    // Observer is established first; content remains visible on setup failure.
    eligible.forEach((el) => engine.prepare(el));
    eligible.forEach((el) => {
      el.style.opacity = "0";
    });
  } catch {
    observer?.disconnect();
    nodes.forEach(restore);
    return { dispose() {}, refresh() {} };
  }
  const focus = (e) => {
    const el = nodes.find((node) => node.contains(e.target));
    if (el) {
      observer.unobserve(el);
      revealed.add(el);
      restore(el);
    }
  };
  root.addEventListener("focusin", focus);
  const stopPolicy = observeMotionPolicy(root, visible, engine);
  return {
    refresh: visible,
    dispose() {
      if (disposed) return;
      disposed = true;
      stopPolicy();
      observer.disconnect();
      root.removeEventListener("focusin", focus);
      for (const h of handles.values()) h.cancel();
      nodes.forEach(restore);
      handles.clear();
    },
  };
}
