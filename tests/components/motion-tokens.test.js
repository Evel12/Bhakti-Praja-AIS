import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  readMotionTokens,
  readSpringPresets,
  resolveMotionProfile,
  getStaggerDelay,
  SPRING_PRESETS,
  SPRING_PRESET_NAMES,
  MotionTokenError,
} from "../../src/motion/tokens.js";

const css = readFileSync(resolve(process.cwd(), "src/motion/tokens.css"), "utf8");

function declarations(block) {
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, key, value]) => [
      key,
      value.trim(),
    ]),
  );
}
const defaults = declarations(css.match(/:root\s*\{([^}]+)\}/)[1]);
const reduced = declarations(
  css.match(
    /@media \(prefers-reduced-motion: reduce\)\s*\{\s*:root\s*\{([^}]+)\}/,
  )[1],
);
const mobile = declarations(
  css.match(/@media \(max-width: 1023px\)[^{]+\{\s*:root\s*\{([^}]+)\}/)[1],
);
const off = declarations(css.match(/\[data-motion="off"\]\s*\{([^}]+)\}/)[1]);
function fixture(overrides = {}, element = document.documentElement) {
  const values = { ...defaults, ...overrides };
  const readStyle = vi.fn(() => ({
    getPropertyValue: (key) => {
      const value = values[key] || "";
      const alias = value.match(/^var\((--[\w-]+)\)$/)?.[1];
      return alias ? values[alias] : value;
    },
  }));
  return {
    values,
    readStyle,
    read: () => readMotionTokens(element, { readStyle }),
  };
}
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("shared motion foundation", () => {
  it("reads all preset values from CSS in one style snapshot and freezes the result", () => {
    const f = fixture(),
      tokens = f.read();
    expect(f.readStyle).toHaveBeenCalledTimes(1);
    expect(tokens.mode).toBe("full");
    for (const name of SPRING_PRESET_NAMES) {
      for (const [key, property] of Object.entries(SPRING_PRESETS[name])) {
        expect(tokens.springs[name][key]).toBe(Number(defaults[property]));
      }
    }
    expect(Object.isFrozen(tokens.springs.snappy)).toBe(true);
    expect(() => {
      tokens.springs.snappy.stiffness = 1;
    }).toThrow();
    expect(tokens.allowedProperties).toEqual([
      "transform",
      "opacity",
      "filter",
    ]);
  });
  it("normalizes seconds and picks up scoped tuning on the next read", () => {
    const f = fixture({
      "--motion-duration-base": "0.25s",
      "--motion-spring-snappy-stiffness": "510",
    });
    expect(f.read().durations.base).toBe(250);
    expect(f.read().springs.snappy.stiffness).toBe(510);
    f.values["--motion-spring-snappy-stiffness"] = "390";
    expect(
      readSpringPresets(document.documentElement, { readStyle: f.readStyle })
        .snappy.stiffness,
    ).toBe(390);
  });
  it("resolves reduced motion to fade only, with no spatial or gooey effects", () => {
    const tokens = fixture(reduced).read();
    const profile = resolveMotionProfile("bouncy", tokens);
    expect(profile).toEqual({
      kind: "fade",
      duration: tokens.durations.fade,
      easing: tokens.easings.fade,
      allowedProperties: ["opacity"],
    });
    expect(profile).not.toHaveProperty("stiffness");
    expect(tokens.durations.base).toBe(tokens.durations.fade);
    expect(tokens.easings.liquid).toBe(tokens.easings.fade);
    expect(tokens.scales).toEqual({
      pressX: 1,
      pressY: 1,
      hover: 1,
      enter: 1,
      shape: 1,
    });
    expect(Object.values(tokens.distances).every((n) => n === 0)).toBe(true);
    expect(tokens.limits.hover || tokens.limits.gooey).toBe(false);
    expect(getStaggerDelay(20, tokens)).toBe(0);
  });
  it("keeps a subtree opted out even if descendants override CSS flags", () => {
    const parent = document.createElement("section"),
      child = document.createElement("button");
    parent.dataset.motion = "off";
    parent.append(child);
    document.body.append(parent);
    const tokens = fixture(
      { ...reduced, "--motion-disabled": "0" },
      child,
    ).read();
    expect(tokens.mode).toBe("off");
    expect(resolveMotionProfile("snappy", tokens)).toEqual({
      kind: "off",
      duration: 0,
      allowedProperties: [],
    });
    const cssOff = fixture(off).read();
    expect(cssOff.mode).toBe("off");
    expect(Object.values(cssOff.durations).every((n) => n === 0)).toBe(true);
  });
  it("disables hover and gooey and lowers the concurrency budget on mobile/coarse pointers", () => {
    const tokens = fixture(mobile).read();
    expect(tokens.limits.maxConcurrent).toBeLessThan(
      fixture().read().limits.maxConcurrent,
    );
    expect(tokens.limits.hover || tokens.limits.gooey).toBe(false);
    expect(tokens.distances.magnetic).toBe(0);
  });
  it("caps list staggering and rejects invalid indices and unknown presets", () => {
    const tokens = fixture().read();
    expect(getStaggerDelay(0, tokens)).toBe(0);
    expect(getStaggerDelay(1, tokens)).toBe(tokens.stagger.step);
    expect(getStaggerDelay(100, tokens)).toBe(tokens.stagger.cap);
    expect(() => getStaggerDelay(-1, tokens)).toThrow(MotionTokenError);
    expect(() => resolveMotionProfile("invented", tokens)).toThrow(
      /Unknown motion preset/,
    );
    expect(resolveMotionProfile("snappy", tokens)).toMatchObject({
      kind: "spring",
      ...tokens.springs.snappy,
      maxDuration: tokens.durations.springCap,
    });
  });
  it("fails clearly on unloaded or invalid tokens rather than introducing hidden defaults", () => {
    for (const overrides of [
      { "--motion-duration-base": "" },
      { "--motion-duration-base": "-2ms" },
      { "--motion-spring-smooth-mass": "0" },
      { "--motion-reduced": "yes" },
      { "--motion-max-concurrent": "2.5" },
      { "--motion-hover-lift": "3rem" },
      { "--motion-overshoot-limit": "80" },
      { "--motion-duration-instant": "1ms" },
      { "--ease-liquid-fade": "cubic-bezier(2, 0, 0, 1)" },
    ])
      expect(() => fixture(overrides).read()).toThrow(MotionTokenError);
  });
  it("supports DOM-free imports and reports an explicit read-before-mount error", async () => {
    vi.stubGlobal("document", undefined);
    await expect(import("../../src/motion/tokens.js")).resolves.toBeDefined();
    expect(() => readMotionTokens()).toThrow(/Read after mount/);
  });
});
