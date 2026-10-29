import { motionEngine } from "./engine.js";
import { createMotionScope } from "./interactions.js";
import { safeTokens, observeMotionPolicy } from "./policy.js";
import { captureLayout, animateLayout } from "./layout.js";

/** Native links keep their behavior; only press opacity/ripple and decorative tips move. */
export function createNavigationScope(root, { engine = motionEngine } = {}) {
  const scope = createMotionScope(root, {
    selector: "button,a[href]",
    filter: (el) =>
      !!el.closest(".sidebar,nav,.tabs") &&
      !el.closest('.exam-shell,[data-liquid-scope="local"]'),
    hover: false,
    magnetic: false,
    spatialPress: false,
    ripple: false,
    engine,
  });
  const tips = new Set();
  const removed = new root.ownerDocument.defaultView.MutationObserver(() => {
    for (const tip of tips) if (!root.contains(tip)) hide(tip);
  });
  removed.observe(root, { childList: true, subtree: true });
  function hide(tip) {
    engine.reset(tip);
    tip.removeAttribute("data-liquid-visible");
    tips.delete(tip);
  }
  function clear() {
    for (const tip of tips) hide(tip);
  }
  function owner(e) {
    return e.target.closest?.(".tip-parent");
  }
  function show(e) {
    const parent = owner(e),
      tip = parent?.querySelector(":scope > .rail-tooltip");
    if (!tip || parent.contains(e.relatedTarget) || root.ownerDocument.hidden)
      return;
    tip.setAttribute("data-liquid-visible", "");
    tips.add(tip);
    const tokens = safeTokens(tip);
    if (tokens)
      engine.animate(
        tip,
        { opacity: 1 },
        { from: { opacity: 0 }, preset: "gentle", tokens },
      );
  }
  function leave(e) {
    const parent = owner(e);
    if (parent?.contains(e.relatedTarget)) return;
    const tip = parent?.querySelector(":scope > .rail-tooltip");
    if (tip) hide(tip);
  }
  const escape = (e) => {
    if (e.key === "Escape") clear();
  };
  root.addEventListener("pointerover", show);
  root.addEventListener("pointerout", leave);
  root.addEventListener("focusin", show);
  root.addEventListener("focusout", leave);
  root.addEventListener("keydown", escape);
  const stopPolicy = observeMotionPolicy(root, clear, engine);
  return {
    dispose() {
      removed.disconnect();
      clear();
      scope.dispose();
      stopPolicy();
      root.removeEventListener("pointerover", show);
      root.removeEventListener("pointerout", leave);
      root.removeEventListener("focusin", show);
      root.removeEventListener("focusout", leave);
      root.removeEventListener("keydown", escape);
    },
  };
}

/** Snap layout once, then FLIP retained surfaces. No grid/size tween. */
export function createNavigationLayout(root, { engine = motionEngine } = {}) {
  let handles = [],
    before = new Map();
  const stop = () => {
    handles.forEach((h) => h.cancel());
    handles = [];
    before.clear();
  };
  const stopPolicy = observeMotionPolicy(root, stop, engine);
  const win = root.ownerDocument.defaultView;
  root.addEventListener("keydown", stop, true);
  root.addEventListener("pointerdown", stop, true);
  win.addEventListener("resize", stop);
  return {
    capture(elements) {
      stop();
      const tokens = safeTokens(root);
      if (!root.ownerDocument.hidden && tokens?.mode !== "off") {
        elements.forEach((el) => engine.reset(el));
        before = captureLayout(elements);
      }
    },
    play(elements) {
      const snapshot = before;
      before = new Map();
      if (root.ownerDocument.hidden) return;
      handles = animateLayout(
        snapshot,
        elements.filter((el) => !el.contains(root.ownerDocument.activeElement)),
        { engine },
      );
    },
    dispose() {
      stop();
      stopPolicy();
      root.removeEventListener("keydown", stop, true);
      root.removeEventListener("pointerdown", stop, true);
      win.removeEventListener("resize", stop);
    },
  };
}
