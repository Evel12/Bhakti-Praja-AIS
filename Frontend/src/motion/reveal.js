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
    dynamic = false,
    initialHide = true,
    stagger = false,
    filter = () => true,
  } = {},
) {
  const nodes = new Set(),
    originalOpacity = new Map(),
    win = root.ownerDocument.defaultView,
    handles = new Map(),
    revealed = new WeakSet();
  let observer,
    mutations,
    disposed = false;
  const restore = (el) => {
    engine.reset(el);
    if (originalOpacity.has(el)) el.style.opacity = originalOpacity.get(el);
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
        let index = 0;
        const ready = entries
          .filter(
            (entry) =>
              nodes.has(entry.target) &&
              root.contains(entry.target) &&
              entry.isIntersecting &&
              !(once && revealed.has(entry.target)),
          )
          .map((entry) => ({
            ...entry,
            target: entry.target,
            tokens: safeTokens(entry.target),
          }));
        // Read all base styles before any animation writes in this batch.
        ready.forEach((entry) => engine.prepare(entry.target));
        for (const entry of ready) {
          const el = entry.target;
          if (once) {
            observer.unobserve(el);
            revealed.add(el);
          }
          if (
            !filter(el) ||
            !entry.tokens ||
            entry.tokens.mode === "off" ||
            root.ownerDocument.hidden ||
            el.contains(root.ownerDocument.activeElement)
          ) {
            restore(el);
            continue;
          }
          const h = animatePresence(el, {
            preset,
            index: stagger ? index++ : 0,
            tokens: entry.tokens,
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
    add();
  } catch {
    observer?.disconnect();
    nodes.forEach(restore);
    return { dispose() {}, refresh() {} };
  }
  function add() {
    if (disposed || !observer) return;
    for (const el of [...nodes])
      if (!root.contains(el)) {
        observer.unobserve(el);
        handles.get(el)?.cancel();
        handles.delete(el);
        restore(el);
        originalOpacity.delete(el);
        nodes.delete(el);
      }
    const pending = [];
    for (const el of root.querySelectorAll(selector)) {
      if (nodes.has(el) || !filter(el)) continue;
      nodes.add(el);
      originalOpacity.set(el, el.style.opacity);
      const tokens = safeTokens(el);
      if (
        !tokens ||
        tokens.mode === "off" ||
        (once && revealed.has(el)) ||
        root.ownerDocument.hidden ||
        el.contains(root.ownerDocument.activeElement)
      ) {
        revealed.add(el);
        continue;
      }
      observer.observe(el);
      pending.push(el);
    }
    // Setup/base reads precede optional writes; container defaults stay visible.
    if (initialHide) {
      pending.forEach((el) => engine.prepare(el));
      pending.forEach((el) => {
        el.style.opacity = "0";
      });
    }
  }
  if (dynamic) {
    mutations = new win.MutationObserver(add);
    mutations.observe(root, { subtree: true, childList: true });
  }
  const focus = (e) => {
    const el = [...nodes].find((node) => node.contains(e.target));
    if (el) {
      observer.unobserve(el);
      revealed.add(el);
      restore(el);
    }
  };
  root.addEventListener("focusin", focus);
  const stopPolicy = observeMotionPolicy(root, visible, engine);
  return {
    add,
    refresh: visible,
    dispose() {
      if (disposed) return;
      disposed = true;
      stopPolicy();
      observer.disconnect();
      mutations?.disconnect();
      root.removeEventListener("focusin", focus);
      for (const h of handles.values()) h.cancel();
      nodes.forEach(restore);
      handles.clear();
      nodes.clear();
      originalOpacity.clear();
    },
  };
}
