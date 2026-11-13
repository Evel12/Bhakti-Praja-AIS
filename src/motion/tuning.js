import { readMotionTokens, SPRING_PRESET_NAMES } from "./tokens.js";
import { motionEngine } from "./engine.js";

/** Loaded by a DEV-only dynamic import; tuning never persists or changes data. */
export function installMotionTuning(
  root,
  win = root.ownerDocument.defaultView,
) {
  const baseline = readMotionTokens(root),
    saved = new Map(),
    previous = win.examniaMotion,
    previousRevision = root.getAttribute("data-motion-tuning");
  let revision = 0,
    disposed = false;
  let settings = {
    stiffnessFactor: 1,
    dampingFactor: 1,
    staggerMs: baseline.stagger.step,
    overshoot: baseline.solver.overshootLimit,
  };
  function stamp() {
    root.setAttribute("data-motion-tuning", String(++revision));
  }
  function write(key, value) {
    if (!saved.has(key))
      saved.set(key, [
        root.style.getPropertyValue(key),
        root.style.getPropertyPriority(key),
      ]);
    root.style.setProperty(key, String(value));
  }
  function restore() {
    for (const [key, [value, priority]] of saved) {
      if (value) root.style.setProperty(key, value, priority);
      else root.style.removeProperty(key);
    }
    saved.clear();
  }
  const api = {
    set(values) {
      if (disposed) throw new Error("Motion tuning has been disposed.");
      if (!values || typeof values !== "object" || Array.isArray(values))
        throw new TypeError("Expected motion tuning options.");
      const next = { ...settings, ...values };
      for (const [key, value] of Object.entries(next)) {
        if (!Object.hasOwn(settings, key) || !Number.isFinite(value))
          throw new TypeError(`Invalid tuning option: ${key}`);
        if (
          (key.endsWith("Factor") && (value <= 0 || value > 4)) ||
          (key === "overshoot" && (value < 0 || value > 1)) ||
          (key === "staggerMs" && (value < 0 || value > baseline.stagger.cap))
        )
          throw new RangeError(`Out-of-range tuning option: ${key}`);
      }
      for (const name of SPRING_PRESET_NAMES) {
        write(
          `--motion-spring-${name}-stiffness`,
          baseline.springs[name].stiffness * next.stiffnessFactor,
        );
        write(
          `--motion-spring-${name}-damping`,
          baseline.springs[name].damping * next.dampingFactor,
        );
      }
      write("--motion-stagger-step", `${next.staggerMs}ms`);
      write("--motion-overshoot-limit", next.overshoot);
      settings = next;
      stamp();
      return { ...settings };
    },
    inspect() {
      return {
        settings: { ...settings },
        tokens: readMotionTokens(root),
        engine: motionEngine.stats(),
      };
    },
    reset() {
      if (disposed) return;
      restore();
      settings = {
        stiffnessFactor: 1,
        dampingFactor: 1,
        staggerMs: baseline.stagger.step,
        overshoot: baseline.solver.overshootLimit,
      };
      stamp();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      restore();
      if (previousRevision === null) root.removeAttribute("data-motion-tuning");
      else root.setAttribute("data-motion-tuning", previousRevision);
      if (previous === undefined) delete win.examniaMotion;
      else win.examniaMotion = previous;
    },
  };
  win.examniaMotion = api;
  return api;
}
