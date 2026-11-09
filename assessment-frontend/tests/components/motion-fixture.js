import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { vi } from "vitest";
import { readMotionTokens } from "../../src/motion/tokens.js";
const css = readFileSync(
  resolve(process.cwd(), "src/motion/tokens.css"),
  "utf8",
);
const parse = (s) =>
  Object.fromEntries(
    [...s.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, k, v]) => [
      k,
      v.trim(),
    ]),
  );
const base = parse(css.match(/:root\s*\{([^}]+)\}/)[1]);
const reduced = parse(
  css.match(
    /@media \(prefers-reduced-motion: reduce\)\s*\{\s*:root\s*\{([^}]+)\}/,
  )[1],
);
export function tokens(mode = "full", overrides = {}) {
  const values = {
    ...base,
    ...(mode === "reduced" ? reduced : {}),
    ...(mode === "off" ? { "--motion-disabled": "1" } : {}),
    ...overrides,
  };
  return readMotionTokens(document.documentElement, {
    readStyle: () => ({
      getPropertyValue: (key) => {
        const v = values[key] || "",
          alias = v.match(/^var\((--[\w-]+)\)$/)?.[1];
        return alias ? values[alias] : v;
      },
    }),
  });
}
export function installMedia() {
  const all = [];
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query) => {
      const listeners = new Set();
      const m = {
        matches: false,
        media: query,
        addEventListener: vi.fn((_, fn) => listeners.add(fn)),
        removeEventListener: vi.fn((_, fn) => listeners.delete(fn)),
        fire: () => [...listeners].forEach((fn) => fn()),
        listeners,
      };
      all.push(m);
      return m;
    }),
  );
  return all;
}
export function installTokenStyles() {
  vi.spyOn(window, "getComputedStyle").mockImplementation((el) => {
    const mode = el.closest?.("[data-motion]")?.dataset.motion;
    const values = {
      ...base,
      ...(mode === "reduced" ? reduced : {}),
      ...(mode === "off" ? { "--motion-disabled": "1" } : {}),
    };
    return {
      transform: el.style.transform || "none",
      filter: el.style.filter || "none",
      opacity: el.style.opacity || "1",
      getPropertyValue: (key) => {
        const value = values[key] || "",
          alias = value.match(/^var\((--[\w-]+)\)$/)?.[1];
        return alias ? values[alias] : value;
      },
    };
  });
}
export function clock() {
  let time = 0,
    nextId = 0;
  const pending = new Map();
  return {
    now: () => time,
    requestFrame: (fn) => {
      pending.set(++nextId, fn);
      return nextId;
    },
    cancelFrame: (id) => pending.delete(id),
    step(ms = 17) {
      time += ms;
      const f = [...pending.values()];
      pending.clear();
      f.forEach((fn) => fn(time));
    },
    flush() {
      let count = 0;
      while (pending.size && count++ < 500) this.step();
      if (pending.size) throw new Error("RAF did not settle");
    },
    pending: () => pending.size,
  };
}
export function element(tag = "div") {
  const el = document.createElement(tag);
  document.body.append(el);
  return el;
}
