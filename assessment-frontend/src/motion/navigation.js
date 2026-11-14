import { motionEngine } from "./engine.js";
import { createMotionScope } from "./interactions.js";
import { safeTokens, observeMotionPolicy } from "./policy.js";
import { resolveMotionProfile } from "./tokens.js";
import { sampleSpring, easeFade } from "./spring.js";
import { captureLayout, animateLayout } from "./layout.js";

/** Native links keep their behavior; only press opacity/ripple and decorative tips move. */
export function createNavigationScope(root, { engine = motionEngine } = {}) {
  const scope = createMotionScope(root, {
    selector: "button,a[href]",
    filter: (el) =>
      !!el.closest(".sidebar,nav,.tabs") &&
      !el.matches(".collapse-control,.brand,.mobile-bottom-link") &&
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
    if (
      !tip ||
      parent.contains(e.relatedTarget) ||
      parent.closest("[data-sidebar-animating]") ||
      root.ownerDocument.hidden
    )
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
  root.addEventListener("pointerdown", clear);
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
      root.removeEventListener("pointerdown", clear);
      root.removeEventListener("focusin", show);
      root.removeEventListener("focusout", leave);
      root.removeEventListener("keydown", escape);
    },
  };
}

/** Synchronize desktop sidebar track width and header toggle button on one spring. */
export function createSidebarMotion(
  root,
  {
    engine = motionEngine,
    requestFrame = (fn) =>
      root.ownerDocument.defaultView.requestAnimationFrame(fn),
    cancelFrame = (id) =>
      root.ownerDocument.defaultView.cancelAnimationFrame(id),
    now = () => root.ownerDocument.defaultView.performance.now(),
  } = {},
) {
  const win = root.ownerDocument.defaultView;
  let frame = null,
    release = null,
    handles = [],
    snapshot = null,
    activeWidth = null,
    activeVelocity = 0;

  function clearStyles(sidebar) {
    root.style.removeProperty("--sidebar-width");
    root.style.removeProperty("--sidebar-copy-opacity");
    sidebar?.removeAttribute("data-sidebar-animating");
  }

  function stop(resetElements = true) {
    if (frame !== null) {
      cancelFrame(frame);
      frame = null;
    }
    if (release) {
      release();
      release = null;
    }
    if (resetElements) {
      handles.forEach((h) => h.cancel());
      clearStyles(root.querySelector("#sidebar"));
    }
    handles = [];
    snapshot = null;
    activeWidth = null;
    activeVelocity = 0;
  }

  const stopPolicy = observeMotionPolicy(root, () => stop(true), engine);
  const onResize = () => stop(true);
  win.addEventListener("resize", onResize);

  return {
    capture() {
      const sidebar = root.querySelector("#sidebar");
      if (
        !sidebar ||
        root.ownerDocument.hidden ||
        root.querySelector("[data-liquid-page-motion]") ||
        win.matchMedia?.("(max-width: 1023px)").matches
      ) {
        stop(true);
        return;
      }
      const tokens = safeTokens(root);
      if (!tokens || tokens.mode === "off") {
        stop(true);
        return;
      }
      const collapseBtn = sidebar.querySelector(".collapse-control");
      const brandImg = sidebar.querySelector(".brand img");
      const btnRect = collapseBtn?.getBoundingClientRect() ?? null;
      const imgRect = brandImg?.getBoundingClientRect() ?? null;
      const fromWidth = activeWidth ?? sidebar.getBoundingClientRect().width;
      const fromVelocity = activeVelocity;

      if (frame !== null) {
        cancelFrame(frame);
        frame = null;
      }
      if (release) {
        release();
        release = null;
      }
      handles.forEach((h) => h.cancel());
      handles = [];
      clearStyles(sidebar);

      snapshot = {
        tokens,
        fromWidth,
        fromVelocity,
        btnRect,
        imgRect,
      };
    },
    play(collapsed) {
      const captured = snapshot;
      snapshot = null;
      const sidebar = root.querySelector("#sidebar");
      if (
        !captured ||
        !sidebar ||
        root.ownerDocument.hidden ||
        root.querySelector("[data-liquid-page-motion]") ||
        win.matchMedia?.("(max-width: 1023px)").matches
      ) {
        stop(true);
        return;
      }
      const tokens = safeTokens(root) || captured.tokens;
      const profile = resolveMotionProfile("smooth", tokens);
      if (profile.kind === "off") {
        stop(true);
        return;
      }

      const collapseBtn = sidebar.querySelector(".collapse-control");
      const brandImg = sidebar.querySelector(".brand img");
      if (collapseBtn) engine.reset(collapseBtn);
      if (brandImg) engine.reset(brandImg);
      clearStyles(sidebar);

      const toWidth = sidebar.getBoundingClientRect().width;
      const afterBtn = collapseBtn?.getBoundingClientRect() ?? null;
      const afterImg = brandImg?.getBoundingClientRect() ?? null;

      if (profile.kind === "fade") {
        if (collapsed || profile.duration <= 0) {
          stop(true);
          return;
        }
        const slot = engine.reserve?.(1, tokens);
        if (!slot) {
          stop(true);
          return;
        }
        release = slot;
        const startTime = now();
        root.style.setProperty("--sidebar-copy-opacity", "0");
        const stepFade = (timestamp) => {
          frame = null;
          if (!root.isConnected || root.closest('[data-motion="off"]')) {
            stop(true);
            return;
          }
          const progress = Math.max(
            0,
            Math.min(1, (timestamp - startTime) / profile.duration),
          );
          const eased = easeFade(progress, profile.easing);
          root.style.setProperty("--sidebar-copy-opacity", String(eased));
          if (progress < 1) {
            frame = requestFrame(stepFade);
          } else {
            stop(true);
          }
        };
        frame = requestFrame(stepFade);
        return;
      }

      const widthDelta = toWidth - captured.fromWidth;
      if (
        Math.abs(widthDelta) < 0.5 &&
        Math.abs(captured.fromVelocity) <= profile.restSpeed
      ) {
        stop(true);
        return;
      }

      const slot = engine.reserve?.(1, tokens);
      if (!slot) {
        stop(true);
        return;
      }
      release = slot;

      if (collapseBtn && captured.btnRect && afterBtn) {
        const dx = captured.btnRect.left - afterBtn.left;
        const dy = captured.btnRect.top - afterBtn.top;
        if (Math.abs(dx) >= 0.5 || Math.abs(dy) >= 0.5) {
          handles.push(
            engine.animate(
              collapseBtn,
              { x: 0, y: 0 },
              { from: { x: dx, y: dy }, preset: "smooth", tokens },
            ),
          );
        }
      }
      if (brandImg && captured.imgRect && afterImg) {
        const dx = captured.imgRect.left - afterImg.left;
        const dy = captured.imgRect.top - afterImg.top;
        if (Math.abs(dx) >= 0.5 || Math.abs(dy) >= 0.5) {
          handles.push(
            engine.animate(
              brandImg,
              { x: 0, y: 0 },
              { from: { x: dx, y: dy }, preset: "smooth", tokens },
            ),
          );
        }
      }

      const { fromWidth, fromVelocity } = captured;
      const amplitude = Math.abs(widthDelta);
      const margin = amplitude * profile.overshootLimit;
      const minBound = Math.max(0, Math.min(fromWidth, toWidth) - margin);
      const maxBound = Math.max(fromWidth, toWidth) + margin;
      const startTime = now();

      activeWidth = fromWidth;
      activeVelocity = fromVelocity;
      sidebar.setAttribute("data-sidebar-animating", "");
      root.style.setProperty("--sidebar-width", `${fromWidth}px`);
      if (!collapsed) {
        root.style.setProperty("--sidebar-copy-opacity", "0");
      }

      const tick = (timestamp) => {
        frame = null;
        if (!root.isConnected || root.closest('[data-motion="off"]')) {
          stop(true);
          return;
        }
        const elapsed = Math.max(0, timestamp - startTime);
        const state = sampleSpring(
          elapsed / 1000,
          profile,
          fromWidth,
          toWidth,
          fromVelocity,
        );
        const width = Math.max(minBound, Math.min(maxBound, state.position));
        activeWidth = width;
        activeVelocity = state.velocity;
        root.style.setProperty("--sidebar-width", `${width.toFixed(2)}px`);

        if (!collapsed && amplitude > 0) {
          const rawProgress = (width - fromWidth) / widthDelta;
          const copyOpacity = Math.max(
            0,
            Math.min(1, (rawProgress - 0.35) / 0.65),
          );
          root.style.setProperty(
            "--sidebar-copy-opacity",
            copyOpacity.toFixed(3),
          );
        }

        const settled =
          Math.abs(state.position - toWidth) <= profile.restDelta &&
          Math.abs(state.velocity) <= profile.restSpeed;
        if (settled || elapsed >= profile.maxDuration) {
          stop(false);
          clearStyles(sidebar);
          return;
        }
        frame = requestFrame(tick);
      };

      frame = requestFrame(tick);
    },
    dispose() {
      stop(true);
      stopPolicy();
      win.removeEventListener("resize", onResize);
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
      if (root.querySelector('[data-liquid-page-motion]')) return;
      const tokens = safeTokens(root);
      if (!root.ownerDocument.hidden && tokens?.mode !== "off") {
        elements.forEach((el) => engine.reset(el));
        before = captureLayout(elements);
      }
    },
    play(elements) {
      const snapshot = before;
      before = new Map();
      if (root.ownerDocument.hidden || root.querySelector('[data-liquid-page-motion]')) return;
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
