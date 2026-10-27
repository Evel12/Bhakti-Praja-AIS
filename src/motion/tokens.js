// This module intentionally contains no numeric animation defaults. It is safe
// to import without a DOM; read tokens only after styles have loaded/mounted.
function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export const SPRING_PRESET_NAMES = freeze([
  "snappy",
  "smooth",
  "bouncy",
  "gentle",
]);

// Public JS preset descriptors resolve to the active CSS values, including
// future per-scope/dev tuning overrides. Never cache them at module evaluation.
export const SPRING_PRESETS = freeze(
  Object.fromEntries(
    SPRING_PRESET_NAMES.map((name) => [
      name,
      Object.fromEntries(
        ["stiffness", "damping", "mass"].map((key) => [
          key,
          `--motion-spring-${name}-${key}`,
        ]),
      ),
    ]),
  ),
);

export class MotionTokenError extends Error {
  constructor(message) {
    super(message);
    this.name = "MotionTokenError";
  }
}

function numeric(raw, token, unit = "number", positive = false) {
  const patterns = {
    number: /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/,
    time: /^([+]?(?:\d+(?:\.\d*)?|\.\d+))(ms|s)$/,
    length: /^([+]?(?:\d+(?:\.\d*)?|\.\d+))px$/,
  };
  const match = raw.match(patterns[unit]);
  const value = match ? Number(match[1]) * (match[2] === "s" ? 1000 : 1) : NaN;
  if (!Number.isFinite(value) || (positive ? value <= 0 : value < 0)) {
    throw new MotionTokenError(
      `Invalid ${token}: expected ${positive ? "positive" : "non-negative"} ${unit}.`,
    );
  }
  return value;
}

/** One computed-style read per snapshot; never call from an animation frame.
 * Times are returned in milliseconds, distances in pixels, scales unitless.
 * readStyle is injectable for tests or an alternative document context.
 */
export function readMotionTokens(
  element = globalThis.document?.documentElement,
  { readStyle } = {},
) {
  const reader =
    readStyle ??
    element?.ownerDocument?.defaultView?.getComputedStyle?.bind(
      element.ownerDocument.defaultView,
    );
  if (!element || !reader) {
    throw new MotionTokenError(
      "Motion tokens require an element and loaded CSS. Read after mount.",
    );
  }
  const style = reader(element);
  const raw = (token) => {
    const value = style.getPropertyValue(token).trim();
    if (!value)
      throw new MotionTokenError(
        `Missing ${token}. Import motion/tokens.css before reading motion tokens.`,
      );
    return value;
  };
  const number = (token, positive = false) =>
    numeric(raw(token), token, "number", positive);
  const time = (token) => numeric(raw(token), token, "time");
  const length = (token) => numeric(raw(token), token, "length");
  const easing = (token) => {
    const value = raw(token);
    const match = value.match(/^cubic-bezier\(([^)]+)\)$/);
    const parts = match?.[1].split(",").map((n) => n.trim());
    const values = parts?.map(Number);
    if (
      !values ||
      values.length !== 4 ||
      parts.some((n) => !n) ||
      values.some((n) => !Number.isFinite(n)) ||
      [values[0], values[2]].some((n) => n < 0 || n > 1)
    ) {
      throw new MotionTokenError(
        `Invalid ${token}: expected a valid cubic-bezier.`,
      );
    }
    return value;
  };
  const flag = (token) => {
    const value = raw(token);
    if (value !== "0" && value !== "1")
      throw new MotionTokenError(`Invalid ${token}: expected 0 or 1.`);
    return value === "1";
  };
  const disabled =
    !!element.closest?.('[data-motion="off"]') || flag("--motion-disabled");
  const reduced = flag("--motion-reduced");
  const mode = disabled ? "off" : reduced ? "reduced" : "full";
  const instant = time("--motion-duration-instant");
  const overshootLimit = number("--motion-overshoot-limit");
  if (instant !== 0)
    throw new MotionTokenError("--motion-duration-instant must be zero.");
  if (overshootLimit > 1)
    throw new MotionTokenError(
      "--motion-overshoot-limit must be a ratio from 0 to 1.",
    );
  const maxConcurrent = number("--motion-max-concurrent", true);
  if (!Number.isInteger(maxConcurrent))
    throw new MotionTokenError("--motion-max-concurrent must be an integer.");
  const frameStep = time("--motion-frame-step");
  if (frameStep <= 0)
    throw new MotionTokenError("--motion-frame-step must be positive.");
  for (const key of [
    "--motion-press-opacity",
    "--motion-ripple-opacity",
    "--motion-reveal-threshold",
  ])
    if (number(key) > 1)
      throw new MotionTokenError(`${key} must be a ratio from 0 to 1.`);
  const springs = Object.fromEntries(
    SPRING_PRESET_NAMES.map((name) => [
      name,
      Object.fromEntries(
        Object.entries(SPRING_PRESETS[name]).map(([key, token]) => [
          key,
          number(token, true),
        ]),
      ),
    ]),
  );
  return freeze({
    mode,
    allowedProperties: disabled
      ? []
      : reduced
        ? ["opacity"]
        : ["transform", "opacity", "filter"],
    durations: {
      instant,
      fast: time("--motion-duration-fast"),
      base: time("--motion-duration-base"),
      slow: time("--motion-duration-slow"),
      fade: time("--motion-duration-fade"),
      springCap: time("--motion-duration-spring-cap"),
    },
    easings: {
      liquid: easing("--ease-liquid"),
      liquidOut: easing("--ease-liquid-out"),
      fade: easing("--ease-liquid-fade"),
    },
    stagger: {
      step: time("--motion-stagger-step"),
      cap: time("--motion-stagger-cap"),
    },
    scales: {
      pressX: number("--motion-press-scale-x", true),
      pressY: number("--motion-press-scale-y", true),
      hover: number("--motion-hover-scale", true),
      enter: number("--motion-enter-scale", true),
      shape: number("--motion-shape-scale", true),
    },
    distances: {
      hoverLift: length("--motion-hover-lift"),
      magnetic: length("--motion-magnetic-distance"),
      reveal: length("--motion-reveal-distance"),
      gooBlur: length("--motion-goo-blur"),
    },
    springs,
    solver: {
      restDelta: number("--motion-rest-delta", true),
      restSpeed: number("--motion-rest-speed", true),
      overshootLimit,
    },
    effects: {
      pressOpacity: number("--motion-press-opacity"),
      rippleOpacity: number("--motion-ripple-opacity"),
      revealThreshold: number("--motion-reveal-threshold"),
      gooMultiplier: number("--motion-goo-alpha-multiplier", true),
      gooOffset: number("--motion-goo-alpha-offset"),
      gooTravel: length("--motion-goo-travel"),
      frameStep,
    },
    limits: {
      maxConcurrent,
      hover: mode === "full" && flag("--motion-hover-enabled"),
      gooey: mode === "full" && flag("--motion-goo-enabled"),
    },
  });
}

export function readSpringPresets(element, options) {
  return readMotionTokens(element, options).springs;
}

/** Later primitives use this policy rather than running springs unconditionally.
 * Passing an already-read snapshot avoids repeated DOM reads within a batch.
 */
export function resolveMotionProfile(
  preset = "smooth",
  tokens = readMotionTokens(),
) {
  if (!SPRING_PRESET_NAMES.includes(preset)) {
    throw new MotionTokenError(`Unknown spring preset: ${preset}.`);
  }
  if (tokens.mode === "off") {
    return freeze({
      kind: "off",
      duration: tokens.durations.instant,
      allowedProperties: [],
    });
  }
  if (tokens.mode === "reduced") {
    return freeze({
      kind: "fade",
      duration: tokens.durations.fade,
      easing: tokens.easings.fade,
      allowedProperties: tokens.allowedProperties,
    });
  }
  return freeze({
    kind: "spring",
    preset,
    ...tokens.springs[preset],
    ...tokens.solver,
    maxDuration: tokens.durations.springCap,
    allowedProperties: tokens.allowedProperties,
  });
}

export function getStaggerDelay(index, tokens = readMotionTokens()) {
  if (!Number.isInteger(index) || index < 0)
    throw new MotionTokenError("Stagger index must be a non-negative integer.");
  return tokens.mode === "full"
    ? Math.min(index * tokens.stagger.step, tokens.stagger.cap)
    : tokens.durations.instant;
}
