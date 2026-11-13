import { motionEngine } from "./engine.js";
import { safeTokens, observeMotionPolicy } from "./policy.js";
import { getStaggerDelay } from "./tokens.js";

/** Finite feedback only: no spinner loop, decode gate, fake progress or pre-hide. */
export function createMediaScope(root, { engine = motionEngine } = {}) {
  const handles = new Map(),
    loaded = new WeakMap(),
    loaders = new WeakSet();
  let disposed = false;
  function stop() {
    for (const [el, handle] of handles) {
      handle.cancel();
      engine.reset(el);
    }
    handles.clear();
  }
  function play(elements) {
    if (disposed || root.ownerDocument.hidden) return;
    // Batch computed styles before animation writes. Only opacity on media/icons.
    const ready = elements
      .filter(
        (el) => root.contains(el) && !el.closest('#route-scene,dialog,.sidebar,.panel,.bank-card,.help-card,[data-liquid-list],[data-liquid-scope="local"],.brand,[data-motion="off"]'),
      )
      .map((el) => ({ el, tokens: safeTokens(el) }))
      .filter((item) => item.tokens && item.tokens.mode !== "off");
    ready.forEach(({ el }) => handles.get(el)?.cancel());
    const opacity = new Map(
      ready.map(({ el }) => [el, engine.prepare(el).base.opacity]),
    );
    ready.forEach(({ el, tokens }, index) => {
      const h = engine.animate(
        el,
        { opacity: opacity.get(el) },
        {
          from: { opacity: 0 },
          tokens,
          preset: "gentle",
          delay: getStaggerDelay(index, tokens),
        },
      );
      handles.set(el, h);
      h.finished.then(() => {
        if (handles.get(el) === h) handles.delete(el);
      });
    });
  }
  function image(el) {
    if (
      el.tagName !== "IMG" ||
      !el.complete ||
      !el.naturalWidth ||
      el.closest(".brand,.exam-shell")
    )
      return;
    const source = el.currentSrc || el.src;
    if (loaded.get(el) === source) return;
    loaded.set(el, source);
    // Container presence already introduces its content; avoid nested entrances.
    if (!el.closest(".panel,.bank-card,.help-card,[data-liquid-list]"))
      play([el]);
  }
  function register(node) {
    if (node.nodeType !== 1) return;
    const images = [...node.querySelectorAll("img")];
    if (node.matches("img")) images.unshift(node);
    images.forEach(image);
    const statuses = [...node.querySelectorAll("[data-liquid-loader]")];
    if (node.matches("[data-liquid-loader]")) statuses.unshift(node);
    for (const status of statuses) {
      if (loaders.has(status)) continue;
      loaders.add(status);
      play([...status.querySelectorAll("[data-liquid-dot]")]);
    }
  }
  function load(e) {
    image(e.target);
  }
  function error(e) {
    const h = handles.get(e.target);
    h?.cancel();
    handles.delete(e.target);
  }
  const observer = new root.ownerDocument.defaultView.MutationObserver(
    (records) => {
      for (const [el, h] of handles)
        if (!root.contains(el)) {
          h.cancel();
          handles.delete(el);
        }
      const changed = new Set();
      for (const record of records) {
        if (record.type === "childList") record.addedNodes.forEach(register);
        else if (
          record.oldValue !==
            record.target.getAttribute(record.attributeName) &&
          !record.target.closest(".exam-shell,.brand")
        )
          changed.add(record.target);
      }
      play([...changed]);
    },
  );
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ["data-liquid-icon", "data-media-key"],
  });
  const stopPolicy = observeMotionPolicy(root, stop, engine);
  root.addEventListener("load", load, true);
  root.addEventListener("error", error, true);
  register(root);
  return {
    dispose() {
      disposed = true;
      stop();
      observer.disconnect();
      stopPolicy();
      root.removeEventListener("load", load, true);
      root.removeEventListener("error", error, true);
    },
  };
}
