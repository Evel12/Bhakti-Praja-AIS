import { motionEngine } from "./engine.js";
import { animatePresence, animateSheet } from "./presence.js";
import { safeTokens, observeMotionPolicy } from "./policy.js";

/** Real overlays close immediately. Exit copies never hold focus or delay actions. */
export function createOverlayMotion(
  root,
  { engine = motionEngine, variant = "auto" } = {},
) {
  let handle,
    ghost,
    target,
    disposed = false;
  const doc = root.ownerDocument,
    win = doc.defaultView;
  function isSheet() {
    if (variant === "sheet") return true;
    if (variant === "dialog" || variant === "toast") return false;
    return Boolean(win.matchMedia?.("(max-width: 768px)")?.matches);
  }
  function stop() {
    handle?.cancel();
    handle = undefined;
    if (target) engine.reset(target);
    target = undefined;
    ghost?.remove();
    ghost = undefined;
  }
  function track(el, h, copy) {
    target = el;
    handle = h;
    h.finished.then(() => {
      copy?.remove();
      if (handle === h) {
        handle = target = ghost = undefined;
      }
    });
  }
  function enabled(el) {
    const tokens = safeTokens(el);
    return !disposed && !doc.hidden && tokens?.mode !== "off" && tokens;
  }
  const stopPolicy = observeMotionPolicy(root, stop, engine);
  const interaction = () => {
    if (!ghost) stop();
  };
  root.addEventListener("pointerdown", interaction, true);
  root.addEventListener("keydown", interaction, true);
  root.addEventListener("focusin", interaction);
  const handleScroll = (event) => {
    const node = event?.target;
    if (!node?.nodeType || !target?.contains?.(node)) stop();
  };
  win.addEventListener("resize", stop, { passive: true });
  win.addEventListener("scroll", handleScroll, { passive: true, capture: true });
  return {
    enter(el) {
      stop();
      const tokens = enabled(el);
      if (!tokens) return;
      const h = isSheet()
        ? animateSheet(el, { direction: "enter", tokens, engine, preset: "smooth" })
        : animatePresence(el, { tokens, engine, preset: "smooth" });
      track(el, h);
    },
    exit(el) {
      stop();
      const tokens = enabled(el);
      if (!tokens || engine.stats().active >= tokens.limits.maxConcurrent)
        return;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      // Static geometry is captured once, never tweened.
      const sheet = isSheet();
      const copy = doc.createElement("div");
      copy.className = sheet
        ? "liquid-overlay-ghost is-sheet"
        : variant === "toast"
          ? "liquid-overlay-ghost is-toast"
          : "liquid-overlay-ghost";
      copy.setAttribute("aria-hidden", "true");
      copy.setAttribute("inert", "");
      Object.assign(copy.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
      const surface = doc.createElement("div");
      surface.className = el.className;
      for (const child of el.childNodes) surface.append(child.cloneNode(true));
      surface.setAttribute("data-motion", "off");
      for (const node of [surface, ...surface.querySelectorAll("*")]) {
        for (const attr of [
          "id",
          "name",
          "for",
          "href",
          "autofocus",
          "aria-labelledby",
          "aria-describedby",
          "aria-live",
          "role",
        ])
          node.removeAttribute(attr);
        if (
          node.matches(
            "input,textarea,select,button,a,[tabindex],[contenteditable]",
          )
        ) {
          node.setAttribute("tabindex", "-1");
          node.removeAttribute("contenteditable");
        }
        node.style.willChange = "";
      }
      // Preserve the scroll position and unsaved control values in the visual copy only.
      const originals = el.querySelectorAll("input,textarea,select");
      surface
        .querySelectorAll("input,textarea,select")
        .forEach((node, index) => {
          node.value = originals[index].value;
          if ("checked" in node) node.checked = originals[index].checked;
        });
      copy.append(surface);
      doc.body.append(copy);
      surface.scrollTop = el.scrollTop;
      ghost = copy;
      track(
        copy,
        sheet
          ? animateSheet(copy, {
              direction: "exit",
              tokens,
              engine,
              preset: "smooth",
            })
          : animatePresence(copy, {
              direction: "exit",
              tokens,
              engine,
              preset: "smooth",
            }),
        copy,
      );
    },
    stop,
    dispose() {
      disposed = true;
      stop();
      stopPolicy();
      root.removeEventListener("pointerdown", interaction, true);
      root.removeEventListener("keydown", interaction, true);
      root.removeEventListener("focusin", interaction);
      win.removeEventListener("resize", stop);
      win.removeEventListener("scroll", handleScroll, true);
    },
  };
}
