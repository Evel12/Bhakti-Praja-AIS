import { createMotionScope } from "./interactions.js";
import { motionEngine } from "./engine.js";
import { safeTokens, observeMotionPolicy } from "./policy.js";

// Navigation and Motion Lab have their own reviewed batches/scopes.
const excluded = ".sidebar,nav,.tabs,.number-grid,[data-liquid-scope='local']";
const eligible = (el) =>
  !el.closest(excluded) &&
  !el.matches(
    ".skip-link,.brand,.drawer-overlay,#menu-trigger,.collapse-control",
  );

/** One delegated scope covers current and future atoms, including dialog slots.
 * Vue owns all content/wrappers; only temporary decorative ripples are appended.
 */
export function createAtomMotionScope(root, { engine = motionEngine } = {}) {
  const previous = root.getAttribute("data-liquid-atoms");
  root.setAttribute("data-liquid-atoms", "");
  const scope = createMotionScope(root, {
    selector: "button,a[href]",
    filter: eligible,
    hover: false,
    magnetic: false,
    optionsFor: (el) => ({
      ripple: el.matches(".btn,.icon-btn,[data-liquid-interactive]"),
      spatialPress: el.matches("button,.btn,.icon-btn"),
    }),
    engine,
  });
  const rings = new Map();
  const win = root.ownerDocument.defaultView;
  let disposed = false;
  function fieldFor(el) {
    if (
      !el?.matches?.("input,select,textarea") ||
      !eligible(el) ||
      el.matches(":disabled,[aria-disabled='true']")
    )
      return null;
    const field = el.closest(".liquid-field");
    return field && root.contains(field) ? field : null;
  }
  function draw(field, active) {
    const ring = field.querySelector(".liquid-focus-ring");
    const tokens = safeTokens(field);
    if (!ring || !tokens) return;
    rings.set(field, ring);
    if (tokens.mode === "off" || root.ownerDocument.hidden)
      return engine.reset(ring);
    engine.animate(
      ring,
      { opacity: active ? 1 : 0 },
      {
        preset: "gentle",
        tokens,
        retain: true,
      },
    );
  }
  function focusIn(e) {
    const field = fieldFor(e.target);
    if (field) draw(field, true);
  }
  function focusOut(e) {
    const field = fieldFor(e.target);
    if (field && !field.contains(e.relatedTarget)) draw(field, false);
  }
  function refresh() {
    for (const ring of rings.values()) engine.reset(ring);
    if (!disposed) {
      const field = fieldFor(root.ownerDocument.activeElement);
      if (field) draw(field, true);
    }
  }
  root.addEventListener("focusin", focusIn);
  root.addEventListener("focusout", focusOut);
  const stopPolicy = observeMotionPolicy(root, refresh, engine);
  const observer = new win.MutationObserver(() => {
    for (const [field, ring] of rings) {
      if (
        !root.contains(field) ||
        field.querySelector("input:disabled,select:disabled,textarea:disabled")
      ) {
        engine.reset(ring);
        rings.delete(field);
      }
    }
  });
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled"],
  });
  return {
    refresh() {
      scope.refresh();
      refresh();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scope.dispose();
      stopPolicy();
      observer.disconnect();
      root.removeEventListener("focusin", focusIn);
      root.removeEventListener("focusout", focusOut);
      for (const ring of rings.values()) engine.reset(ring);
      rings.clear();
      if (previous === null) root.removeAttribute("data-liquid-atoms");
      else root.setAttribute("data-liquid-atoms", previous);
    },
  };
}
