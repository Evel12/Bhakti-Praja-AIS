import { describe, it, expect, afterEach } from "vitest";
import { createMotionEngine } from "../../src/motion/engine.js";
import { sampleSpring } from "../../src/motion/spring.js";
import { animatePresence } from "../../src/motion/presence.js";
import { tokens, clock, element } from "./motion-fixture.js";
afterEach(() => {
  document.body.innerHTML = "";
});
describe("liquid spring engine", () => {
  it("shares its concurrency budget with native snapshot animations", async () => {
    const c = clock(),
      t = tokens("full", { "--motion-max-concurrent": "2" }),
      engine = createMotionEngine({ ...c, getTokens: () => t }),
      release = engine.reserve(2, t),
      el = element();
    expect(release).toBeTypeOf("function");
    await expect(engine.animate(el, { x: 20 }).finished).resolves.toEqual({
      status: "skipped",
    });
    expect(engine.stats().active).toBe(2);
    release();
    release();
    expect(engine.stats().active).toBe(0);
    const h = engine.animate(el, { x: 20 });
    c.flush();
    await h.finished;
    expect(engine.stats().peak).toBe(2);
  });
  it("solves underdamped, critical and overdamped systems with correct initial state and settle", () => {
    for (const damping of [10, 20, 30]) {
      const p = { stiffness: 100, mass: 1, damping };
      expect(sampleSpring(0, p, 3, 8, 2).position).toBeCloseTo(3);
      expect(sampleSpring(0, p, 3, 8, 2).velocity).toBeCloseTo(2);
      expect(sampleSpring(10, p, 3, 8, 2).position).toBeCloseTo(8);
    }
  });
  it("renders spring frames, preserves static transforms, and restores style/will-change on completion", async () => {
    const c = clock(),
      t = tokens(),
      engine = createMotionEngine({ ...c, getTokens: () => t }),
      el = element();
    el.style.transform = "rotate(4deg)";
    el.style.opacity = ".7";
    const h = engine.animate(el, { x: 20 }, { retain: false });
    c.step();
    expect(el.style.transform).toContain("rotate(4deg)");
    expect(el.style.willChange).toBe("transform");
    c.flush();
    await expect(h.finished).resolves.toEqual({ status: "finished" });
    expect(el.style.transform).toBe("rotate(4deg)");
    expect(el.style.opacity).toBe("0.7");
    expect(el.style.willChange).toBe("");
    expect(engine.stats().active).toBe(0);
    expect(c.pending()).toBe(0);
  });
  it("retargets from the rendered position and settles every interrupted promise", async () => {
    const c = clock(),
      engine = createMotionEngine({ ...c, getTokens: () => tokens() }),
      el = element();
    const first = engine.animate(el, { x: 40 }, { retain: true });
    c.step(80);
    const before = el.style.transform;
    const second = engine.animate(el, { x: 0 }, { retain: true });
    expect(el.style.transform).toBe(before);
    await expect(first.finished).resolves.toEqual({ status: "cancelled" });
    c.flush();
    await expect(second.finished).resolves.toEqual({ status: "finished" });
    expect(el.style.transform).toBe("");
    engine.reset(el);
  });
  it("caps simultaneous jobs and makes overflow content visible immediately", async () => {
    const c = clock(),
      t = tokens("full", { "--motion-max-concurrent": "2" }),
      engine = createMotionEngine({ ...c, getTokens: () => t });
    const els = [element(), element(), element()];
    const hs = els.map((el) => animatePresence(el, { engine, tokens: t }));
    expect(engine.stats().active).toBe(2);
    expect(els[2].style.opacity).toBe("");
    await expect(hs[2].finished).resolves.toEqual({ status: "skipped" });
    c.flush();
    expect(engine.stats().peak).toBe(2);
  });
  it("reduced mode writes only opacity; opt-out skips every spatial effect", async () => {
    const c = clock(),
      engine = createMotionEngine({ ...c, getTokens: () => tokens("reduced") }),
      el = element();
    el.style.transform = "translateX(2px)";
    const h = engine.animate(
      el,
      { x: 90, scaleX: 2, blur: 5, opacity: 1 },
      { from: { opacity: 0 } },
    );
    c.step();
    expect(el.style.transform).toBe("translateX(2px)");
    expect(el.style.filter).toBe("");
    c.flush();
    await h.finished;
    const off = engine.animate(el, { x: 50 }, { tokens: tokens("off") });
    await expect(off.finished).resolves.toEqual({ status: "skipped" });
    expect(c.pending()).toBe(0);
  });
  it("cancels on opt-out/removal, never leaves a queued RAF, and rejects layout properties", async () => {
    const c = clock(),
      engine = createMotionEngine({ ...c, getTokens: () => tokens() }),
      el = element();
    const h = engine.animate(el, { y: 50 });
    el.dataset.motion = "off";
    c.step();
    await expect(h.finished).resolves.toEqual({ status: "cancelled" });
    expect(el.style.transform).toBe("");
    expect(() => engine.animate(el, { width: 20 })).toThrow(/Unsupported/);
    el.removeAttribute("data-motion");
    const removed = engine.animate(el, { y: 30 });
    el.remove();
    c.step();
    await expect(removed.finished).resolves.toEqual({ status: "cancelled" });
    engine.dispose();
    expect(c.pending()).toBe(0);
  });
  it("handles zero-duration fades and long frame gaps without NaN or runaway work", async () => {
    const c = clock(),
      engine = createMotionEngine({
        ...c,
        getTokens: () => tokens("reduced", { "--motion-duration-fade": "0ms" }),
      }),
      el = element();
    await engine.animate(el, { opacity: 1 }, { from: { opacity: 0 } }).finished;
    expect(c.pending()).toBe(0);
    const h = engine.animate(el, { x: 20 }, { tokens: tokens() });
    c.step(10000);
    await h.finished;
    expect(engine.stats().active).toBe(0);
    expect(el.style.transform).toBe("");
  });
});
