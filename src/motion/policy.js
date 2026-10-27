import { readMotionTokens } from "./tokens.js";
import { motionEngine } from "./engine.js";

export function observeMotionPolicy(root, onChange, engine = motionEngine) {
  const win = root.ownerDocument.defaultView,
    media = [
      "(prefers-reduced-motion: reduce)",
      "(max-width: 1023px)",
      "(hover: none)",
      "(pointer: coarse)",
    ].map((q) => win.matchMedia(q));
  let alive = true;
  const update = () => {
    engine.cancelWithin(root);
    queueMicrotask(() => {
      if (alive) onChange?.();
    });
  };
  media.forEach((m) => m.addEventListener("change", update));
  const observer = new win.MutationObserver((records) => {
    if (records.some((r) => root.contains(r.target) || r.target.contains(root)))
      update();
  });
  observer.observe(root.ownerDocument.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ["data-motion"],
  });
  const visibility = () => {
    if (root.ownerDocument.hidden) update();
  };
  root.ownerDocument.addEventListener("visibilitychange", visibility);
  return () => {
    alive = false;
    media.forEach((m) => m.removeEventListener("change", update));
    observer.disconnect();
    root.ownerDocument.removeEventListener("visibilitychange", visibility);
  };
}
export function safeTokens(el) {
  try {
    return readMotionTokens(el);
  } catch {
    return null;
  }
}
