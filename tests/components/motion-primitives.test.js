import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createMotionEngine } from "../../src/motion/engine.js";
import {
  createMotionScope,
  pointerRipple,
} from "../../src/motion/interactions.js";
import { flipLayout } from "../../src/motion/layout.js";
import { observeReveals } from "../../src/motion/reveal.js";
import { routeKeyframes, transitionRoute } from "../../src/motion/route.js";
import { observeMotionPolicy } from "../../src/motion/policy.js";
import {
  tokens,
  clock,
  element,
  installMedia,
  installTokenStyles,
} from "./motion-fixture.js";
let media;
beforeEach(() => {
  media = installMedia();
  installTokenStyles();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});
afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("motion primitives and lifecycle", () => {
  it("coalesces magnetic pointer movement and keeps the outer hitbox unchanged", () => {
    const c = clock(),
      engine = createMotionEngine({ ...c, getTokens: () => tokens() }),
      root = element();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(
      c.requestFrame,
    );
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(c.cancelFrame);
    root.innerHTML =
      "<button data-liquid-interactive><span data-liquid-surface>Magnet</span></button>";
    const button = root.firstChild,
      surface = button.firstChild;
    button.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 100,
      height: 40,
    });
    const scope = createMotionScope(root, { engine, ripple: false });
    button.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    button.dispatchEvent(
      new MouseEvent("pointermove", {
        bubbles: true,
        clientX: 90,
        clientY: 20,
      }),
    );
    button.dispatchEvent(
      new MouseEvent("pointermove", {
        bubbles: true,
        clientX: 90,
        clientY: 20,
      }),
    );
    c.flush();
    expect(surface.style.transform).toContain("3.2px");
    expect(button.style.transform).toBe("");
    scope.dispose();
    expect(c.pending()).toBe(0);
  });
  it("restores focused reveal content and ignores stale observer callbacks", () => {
    let callback;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb) {
          callback = cb;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const c = clock(),
      engine = createMotionEngine({ ...c, getTokens: () => tokens() }),
      root = element();
    root.innerHTML =
      "<article data-liquid-reveal><button>Focus me</button></article>";
    const panel = root.firstChild,
      api = observeReveals(root, { engine });
    panel.firstChild.dispatchEvent(
      new FocusEvent("focusin", { bubbles: true }),
    );
    expect(panel.style.opacity).toBe("");
    callback([{ target: panel, isIntersecting: true }]);
    expect(engine.stats().active).toBe(0);
    api.dispose();
    callback([{ target: panel, isIntersecting: true }]);
    expect(c.pending()).toBe(0);
  });
  it("preserves button clicks/keyboard behavior and restores all listeners/styles on scope disposal", async () => {
    const c = clock(),
      engine = createMotionEngine({ ...c, getTokens: () => tokens() }),
      root = element();
    root.innerHTML =
      "<button data-liquid-interactive><span data-liquid-surface>Try</span></button>";
    const button = root.firstChild,
      surface = button.firstChild,
      click = vi.fn();
    button.addEventListener("click", click);
    const scope = createMotionScope(root, { engine, ripple: false });
    button.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    c.step();
    expect(surface.style.transform).toContain("scale(");
    button.click();
    button.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Enter", bubbles: true }),
    );
    c.flush();
    expect(click).toHaveBeenCalledTimes(1);
    scope.dispose();
    expect(surface.style.transform).toBe("");
    expect(media.every((m) => m.listeners.size === 0)).toBe(true);
    button.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(c.pending()).toBe(0);
  });
  it("opted-out and disabled controls do not get press/ripple effects", () => {
    const c = clock(),
      engine = createMotionEngine({ ...c, getTokens: () => tokens() }),
      root = element();
    root.dataset.motion = "off";
    root.innerHTML =
      "<button data-liquid-interactive>Off</button><button data-liquid-interactive disabled>Disabled</button>";
    const scope = createMotionScope(root, { engine });
    for (const button of root.children)
      button.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, button: 0 }),
      );
    expect(engine.stats().active).toBe(0);
    expect(root.querySelector(".liquid-ripple")).toBeNull();
    scope.dispose();
  });
  it("creates a pointer-origin ripple and removes it on completion or cancel", async () => {
    const c = clock(),
      engine = createMotionEngine({ ...c, getTokens: () => tokens() }),
      el = element();
    el.getBoundingClientRect = () => ({
      left: 10,
      top: 20,
      width: 100,
      height: 40,
    });
    const h = pointerRipple(
      el,
      { clientX: 30, clientY: 40 },
      { tokens: tokens(), engine },
    );
    expect(el.querySelector(".liquid-ripple")).not.toBeNull();
    c.flush();
    await h.finished;
    await Promise.resolve();
    expect(el.children.length).toBe(0);
    const cancelled = pointerRipple(el, null, { tokens: tokens(), engine });
    cancelled.cancel();
    expect(el.children.length).toBe(0);
  });
  it("batches FLIP geometry reads before animation writes and performs update exactly once", async () => {
    const els = [element(), element()];
    let moved = false;
    const order = [];
    els.forEach((el, i) => {
      el.getBoundingClientRect = () => {
        order.push("read");
        return { left: moved ? 100 - i * 100 : i * 100, top: 0 };
      };
    });
    const engine = {
        reset: () => order.push("reset"),
        animate: vi.fn(() => {
          order.push("animate");
          return { finished: Promise.resolve(), cancel() {} };
        }),
      },
      update = vi.fn(() => {
        moved = true;
      });
    await flipLayout(els, update, { tokens: tokens(), engine });
    expect(update).toHaveBeenCalledTimes(1);
    expect(order.lastIndexOf("read")).toBeLessThan(order.indexOf("animate"));
    expect(engine.animate.mock.calls[0][2].from.x).toBe(-100);
  });
  it("leaves reveal content visible without IntersectionObserver", () => {
    const root = element();
    root.innerHTML =
      '<article data-liquid-reveal style="opacity:.6">Visible</article>';
    const api = observeReveals(root);
    expect(root.firstChild.style.opacity).toBe("0.6");
    api.dispose();
  });
  it("reveals once, restores inline opacity and disconnects observer/focus cleanup", async () => {
    const instances = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback) {
          this.callback = callback;
          this.observe = vi.fn();
          this.unobserve = vi.fn();
          this.disconnect = vi.fn();
          instances.push(this);
        }
      },
    );
    const c = clock(),
      engine = createMotionEngine({ ...c, getTokens: () => tokens() }),
      root = element();
    root.innerHTML =
      '<article data-liquid-reveal style="opacity:.6"><button>Focus</button></article>';
    const panel = root.firstChild,
      api = observeReveals(root, { engine });
    expect(panel.style.opacity).toBe("0");
    instances[0].callback([{ isIntersecting: true, target: panel }]);
    c.flush();
    await Promise.resolve();
    expect(panel.style.opacity).toBe("0.6");
    expect(instances[0].unobserve).toHaveBeenCalledWith(panel);
    api.dispose();
    expect(instances[0].disconnect).toHaveBeenCalled();
    expect(c.pending()).toBe(0);
  });
  it("observes policy changes on ancestors and unregisters all media listeners", async () => {
    const root = element(),
      callback = vi.fn(),
      engine = { cancelWithin: vi.fn() };
    const stop = observeMotionPolicy(root, callback, engine);
    document.body.dataset.motion = "reduced";
    await Promise.resolve();
    await Promise.resolve();
    expect(callback).toHaveBeenCalled();
    stop();
    expect(media.every((m) => m.listeners.size === 0)).toBe(true);
    delete document.body.dataset.motion;
  });
  it("generates transform/opacity-only route frames and opacity-only reduced frames", () => {
    for (const mode of ["full", "reduced"]) {
      const t = tokens(mode),
        keyframes = routeKeyframes(t);
      expect(keyframes.duration).toBeGreaterThan(0);
      for (const frame of keyframes.frames)
        expect(
          Object.keys(frame).every((k) =>
            ["transform", "opacity", "offset"].includes(k),
          ),
        ).toBe(true);
      if (mode === "reduced")
        expect(keyframes.frames.every((f) => !("transform" in f))).toBe(true);
    }
  });
  it("never calls a route update twice when native snapshots reject", async () => {
    const target = element(),
      update = vi.fn();
    const doc = target.ownerDocument;
    const original = doc.startViewTransition;
    doc.startViewTransition = (fn) => {
      const p = fn();
      return {
        ready: Promise.reject(new Error("snapshot")),
        updateCallbackDone: p,
        finished: Promise.resolve(),
        skipTransition() {},
      };
    };
    try {
      await transitionRoute(update, {
        target,
        engine: {
          stats: () => ({ active: 0 }),
          prepare: () => ({ base: { opacity: 1 } }),
          animate: () => ({ finished: Promise.resolve(), cancel() {} }),
        },
      });
      expect(update).toHaveBeenCalledTimes(1);
    } finally {
      doc.startViewTransition = original;
    }
  });
  it("animates native snapshots within a shared budget and restores view-transition attributes", async () => {
    const target = element(),
      root = document.documentElement,
      update = vi.fn(),
      release = vi.fn(),
      original = document.startViewTransition,
      originalAnimate = root.animate;
    target.style.viewTransitionName = "existing-name";
    const animate = vi.fn(() => ({
      finished: Promise.resolve(),
      cancel: vi.fn(),
    }));
    root.animate = animate;
    document.startViewTransition = (fn) => {
      const p = fn();
      return {
        ready: p,
        updateCallbackDone: p,
        finished: Promise.resolve(),
        skipTransition: vi.fn(),
      };
    };
    try {
      await expect(
        transitionRoute(update, {
          target,
          engine: { reserve: vi.fn(() => release) },
        }),
      ).resolves.toEqual({ mode: "native" });
      expect(update).toHaveBeenCalledTimes(1);
      expect(animate).toHaveBeenCalledTimes(2);
      expect(release).toHaveBeenCalledTimes(1);
      expect(root.hasAttribute("data-liquid-route")).toBe(false);
      expect(target.style.viewTransitionName).toBe("existing-name");
    } finally {
      document.startViewTransition = original;
      root.animate = originalAnimate;
    }
  });
  it("propagates real route update errors without retrying the transaction", async () => {
    const target = element(),
      update = vi.fn(() => {
        throw new Error("navigation failed");
      });
    await expect(
      transitionRoute(update, { target, native: false }),
    ).rejects.toThrow("navigation failed");
    expect(update).toHaveBeenCalledTimes(1);
  });
});
