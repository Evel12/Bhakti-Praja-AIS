import { motionEngine, completed } from "./engine.js";
import { safeTokens } from "./policy.js";
import { getStaggerDelay } from "./tokens.js";

export function animatePresence(
  element,
  {
    direction = "enter",
    preset = "smooth",
    index = 0,
    tokens = safeTokens(element),
    engine = motionEngine,
  } = {},
) {
  if (!tokens) return completed();
  const enter = direction === "enter";
  const opacity = engine.prepare(element).base.opacity;
  return engine.animate(
    element,
    enter
      ? { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity }
      : {
          y: -tokens.distances.reveal,
          scaleX: tokens.scales.enter,
          scaleY: tokens.scales.enter,
          opacity: 0,
        },
    {
      from: enter
        ? {
            y: tokens.distances.reveal,
            scaleX: tokens.scales.enter,
            scaleY: tokens.scales.enter,
            opacity: 0,
          }
        : undefined,
      preset,
      tokens,
      delay: getStaggerDelay(index, tokens),
    },
  );
}
