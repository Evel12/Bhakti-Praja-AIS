import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushPromises } from "@vue/test-utils";
import {
  isLimitedDevice,
  installMotionCapabilities,
} from "../../src/motion/capabilities.js";
import { installMotionTuning } from "../../src/motion/tuning.js";
import { readMotionTokens } from "../../src/motion/tokens.js";
import { createMotionEngine } from "../../src/motion/engine.js";
import { observeMotionPolicy } from "../../src/motion/policy.js";
import { auditMotionSource } from "../../scripts/check-motion.mjs";
import {
  tokens,
  clock,
  element,
  installMedia,
  installTokenStyles,
} from "./motion-fixture.js";
let cleanup;
beforeEach(() => {
  cleanup = [];
  installMedia();
  installTokenStyles();
});
afterEach(() => {
  cleanup.forEach((fn) => fn());
  document.body.innerHTML = "";
  delete window.examniaMotion;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("phase 10 motion safeguards", () => {
  it("uses conservative limited-device hints and does not mistake absent values for zero", () => {
    expect(isLimitedDevice({})).toBe(false);
    expect(isLimitedDevice({ hardwareConcurrency: 0, deviceMemory: NaN })).toBe(
      false,
    );
    expect(isLimitedDevice({ hardwareConcurrency: 4 })).toBe(true);
    expect(isLimitedDevice({ deviceMemory: 2 })).toBe(true);
    expect(isLimitedDevice({ connection: { saveData: true } })).toBe(true);
    expect(isLimitedDevice({ hardwareConcurrency: 8, deviceMemory: 8 })).toBe(
      false,
    );
  });
  it("updates Save-Data policy and restores the original DOM/listener on disposal", () => {
    const root = element(),
      listeners = new Set(),
      connection = {
        saveData: false,
        addEventListener: (_, fn) => listeners.add(fn),
        removeEventListener: (_, fn) => listeners.delete(fn),
      };
    root.dataset.motionTier = "custom";
    const cap = installMotionCapabilities(root, { connection });
    connection.saveData = true;
    listeners.forEach((fn) => fn());
    expect(root.dataset.motionTier).toBe("lite");
    cap.dispose();
    expect(root.dataset.motionTier).toBe("custom");
    expect(listeners.size).toBe(0);
  });
  it("lite enforces opacity-only and two shared jobs even under nested full token values", () => {
    const root = element(),
      child = document.createElement("div");
    root.dataset.motionTier = "lite";
    root.append(child);
    const t = readMotionTokens(child);
    expect(t.mode).toBe("reduced");
    expect(t.allowedProperties).toEqual(["opacity"]);
    expect(t.limits.maxConcurrent).toBe(2);
    expect(t.limits.gooey).toBe(false);
    root.dataset.motion = "off";
    expect(readMotionTokens(child).mode).toBe("off");
  });
  it("tuning scales every sibling preset together and rejects invalid input atomically", () => {
    const root = element(),
      base = readMotionTokens(root),
      api = installMotionTuning(root);
    cleanup.push(() => api.dispose());
    api.set({
      stiffnessFactor: 1.1,
      dampingFactor: 1.2,
      staggerMs: 0,
      overshoot: 0,
    });
    for (const [name, spring] of Object.entries(base.springs)) {
      expect(
        Number(
          root.style.getPropertyValue(`--motion-spring-${name}-stiffness`),
        ),
      ).toBeCloseTo(spring.stiffness * 1.1);
      expect(
        Number(root.style.getPropertyValue(`--motion-spring-${name}-damping`)),
      ).toBeCloseTo(spring.damping * 1.2);
    }
    const css = root.getAttribute("style");
    expect(() => api.set({ stiffnessFactor: -1 })).toThrow();
    expect(() => api.set({ duration: 100 })).toThrow();
    expect(root.getAttribute("style")).toBe(css);
    expect(api.inspect().settings.overshoot).toBe(0);
    api.reset();
    expect(root.style.getPropertyValue("--motion-stagger-step")).toBe("");
  });
  it("preserves existing inline overrides/global API and notifies policy when tuning changes", async () => {
    const root = element();
    root.style.setProperty("--motion-overshoot-limit", ".02", "important");
    const originalPriority = root.style.getPropertyPriority(
      "--motion-overshoot-limit",
    );
    const previous = { old: true };
    window.examniaMotion = previous;
    const change = vi.fn(),
      stop = observeMotionPolicy(root, change);
    cleanup.push(stop);
    const api = installMotionTuning(root);
    api.set({ overshoot: 0 });
    await flushPromises();
    expect(change).toHaveBeenCalled();
    api.dispose();
    expect(root.style.getPropertyValue("--motion-overshoot-limit")).toBe(".02");
    expect(root.style.getPropertyPriority("--motion-overshoot-limit")).toBe(
      originalPriority,
    );
    expect(window.examniaMotion).toBe(previous);
    expect(root.hasAttribute("data-motion-tuning")).toBe(false);
  });
  it("caps a burst, performs no geometry/style reads in RAF ticks, and leaves no idle work", async () => {
    const c = clock(),
      engine = createMotionEngine({
        ...c,
        getTokens: () => tokens("full", { "--motion-max-concurrent": "2" }),
      });
    const nodes = Array.from({ length: 20 }, () => element());
    nodes.forEach((el) => engine.prepare(el));
    const style = vi.spyOn(window, "getComputedStyle");
    const bounds = nodes.map((el) => vi.spyOn(el, "getBoundingClientRect"));
    nodes.forEach((el) =>
      engine.animate(
        el,
        { opacity: 1 },
        {
          from: { opacity: 0 },
          tokens: tokens("full", { "--motion-max-concurrent": "2" }),
        },
      ),
    );
    style.mockClear();
    c.flush();
    await flushPromises();
    expect(engine.stats().peak).toBe(2);
    expect(engine.stats().active).toBe(0);
    expect(c.pending()).toBe(0);
    expect(style).not.toHaveBeenCalled();
    expect(bounds.every((spy) => spy.mock.calls.length === 0)).toBe(true);
    expect(nodes.every((el) => el.style.willChange === "")).toBe(true);
  });
  it("guard catches forbidden CSS and hardcoded motion while exempting assessment time", () => {
    expect(
      auditMotionSource(
        ".x { transition: width 200ms ease; will-change: transform; }",
        "src/test.css",
      ),
    ).toHaveLength(2);
    expect(
      auditMotionSource(
        'const fx={duration:250, stiffness:200, easing:"ease"}',
        "src/components/Test.vue",
      ),
    ).toHaveLength(3);
    expect(
      auditMotionSource(
        "const assessment={duration:30}",
        "src/domain/assessment.js",
      ),
    ).toHaveLength(0);
    expect(
      auditMotionSource(".x { transition: none !important; }", "src/test.css"),
    ).toHaveLength(0);
  });
});
