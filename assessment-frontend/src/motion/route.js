import { sampleSpring } from "./spring.js";
import { resolveMotionProfile } from "./tokens.js";
import { safeTokens, observeMotionPolicy } from "./policy.js";
import { animatePresence } from "./presence.js";
import { motionEngine } from "./engine.js";

const runs = new WeakMap();
export function routeKeyframes(tokens, preset = "smooth") {
  const profile = resolveMotionProfile(preset, tokens);
  if (profile.kind === "tween") {
    return {
      frames: [
        { opacity: 0, transform: `translateY(${tokens.distances.pageLift}px)` },
        { opacity: 1, transform: "translateY(0px)" },
      ],
      duration: profile.duration,
      exitDuration: tokens.durations.pageExit,
      easing: profile.easing,
    };
  }
  if (profile.kind !== "spring")
    return {
      frames: [{ opacity: 0 }, { opacity: 1 }],
      duration: profile.duration,
      easing: tokens.easings.fade,
    };
  const samples = [];
  let time = 0;
  do {
    const state = sampleSpring(time / 1000, profile),
      p = Math.max(
        -profile.overshootLimit,
        Math.min(1 + profile.overshootLimit, state.position),
      );
    samples.push({
      time,
      opacity: Math.max(0, Math.min(1, p)),
      transform: `translateY(${tokens.distances.reveal * (1 - p)}px) scale(${tokens.scales.enter + (1 - tokens.scales.enter) * p})`,
    });
    if (
      time > 0 &&
      Math.abs(1 - state.position) <= profile.restDelta &&
      Math.abs(state.velocity) <= profile.restSpeed
    )
      break;
    time = Math.min(profile.maxDuration, time + tokens.effects.frameStep);
  } while (time < profile.maxDuration);
  const duration = Math.max(time, tokens.effects.frameStep);
  const frames = samples.map(({ time, ...frame }) => ({
    ...frame,
    offset: time / duration,
  }));
  frames.push({ opacity: 1, transform: "translateY(0px) scale(1)", offset: 1 });
  // Samples already describe spring physics. Native interpolation only joins
  // the samples; no CSS ease is applied to the spring trajectory.
  return { frames, duration };
}

/** A reusable transaction: update executes once even if the API is absent or
 * fails. Page integration runs afterEach; it never blocks router guards.
 */
export async function transitionRoute(
  update,
  {
    target,
    preset = "smooth",
    native = true,
    signal,
    engine = motionEngine,
  } = {},
) {
  if (!target)
    throw new TypeError("transitionRoute requires a route-content target.");
  const doc = target.ownerDocument,
    root = doc.documentElement,
    tokens = safeTokens(target);
  let commitPromise;
  const commit = () => (commitPromise ??= Promise.resolve().then(update));
  runs.get(root)?.cancel();
  if (signal?.aborted || !tokens || tokens.mode === "off" || doc.hidden) {
    await commit();
    return { mode: "off" };
  }
  const oldName = target.style.viewTransitionName,
    oldAttribute = root.getAttribute("data-liquid-route");
  let transition,
    cancelled = false,
    animations = [],
    fallbackHandle,
    releaseBudget;
  const restoreNames = () => {
    target.style.viewTransitionName = oldName;
    if (oldAttribute === null) root.removeAttribute("data-liquid-route");
    else root.setAttribute("data-liquid-route", oldAttribute);
  };
  const run = {
    cancel() {
      cancelled = true;
      transition?.skipTransition();
      animations.forEach((a) => a.cancel());
      fallbackHandle?.cancel();
      if (runs.get(root) === run) restoreNames();
    },
  };
  runs.set(root, run);
  const stopPolicy = observeMotionPolicy(target, run.cancel, engine);
  signal?.addEventListener("abort", run.cancel, { once: true });
  const fallback = async () => {
    await commit();
    if (cancelled || signal?.aborted || runs.get(root) !== run)
      return { mode: "cancelled" };
    if (!signal?.aborted) {
      const currentTokens = safeTokens(target);
      if (!currentTokens || currentTokens.mode === "off") return { mode: "off" };
      // Match the page preview in browsers without snapshots: one bounded lift,
      // no scale or spring. The engine applies the opacity-only reduced policy.
      fallbackHandle = preset === "gentle-lift"
        ? engine.animate(
            target,
            { y: 0, opacity: engine.prepare(target).base.opacity },
            {
              from: { y: currentTokens.distances.pageLift, opacity: 0 },
              preset,
              tokens: currentTokens,
            },
          )
        : animatePresence(target, { preset, tokens: currentTokens, engine });
      await fallbackHandle.finished;
    }
    return { mode: "fallback" };
  };
  try {
    if (!native || !doc.startViewTransition) return await fallback();
    root.setAttribute("data-liquid-route", "");
    target.style.viewTransitionName = "liquid-scene";
    try {
      transition = doc.startViewTransition(commit);
    } catch {
      return await fallback();
    }
    // The update's own failure must propagate, while snapshot failures can fade.
    try {
      await transition.ready;
    } catch {
      await transition.updateCallbackDone;
      return await fallback();
    }
    await commit();
    if (cancelled || signal?.aborted || runs.get(root) !== run) {
      run.cancel();
      return { mode: "cancelled" };
    }
    releaseBudget = engine.reserve?.(2, tokens);
    if (releaseBudget) {
      const entry = routeKeyframes(tokens, preset);
      const own = (animation) => {
        animation.finished.catch(() => {});
        animations.push(animation);
      };
      own(
        root.animate(
          entry.frames.map(({ opacity, offset }) => ({
            opacity: 1 - opacity,
            ...(offset !== undefined ? { offset } : {}),
          })),
          {
            duration: entry.exitDuration ?? entry.duration,
            fill: "both",
            ...(entry.easing ? { easing: entry.easing } : {}),
            pseudoElement: "::view-transition-old(liquid-scene)",
          },
        ),
      );
      own(
        root.animate(entry.frames, {
          duration: entry.duration,
          fill: "both",
          ...(entry.easing ? { easing: entry.easing } : {}),
          pseudoElement: "::view-transition-new(liquid-scene)",
        }),
      );
      await Promise.all(animations.map((a) => a.finished.catch(() => {})));
    }
    transition.skipTransition();
    await transition.finished.catch(() => {});
    return { mode: "native" };
  } catch {
    await commit();
    transition?.skipTransition();
    return await fallback();
  } finally {
    releaseBudget?.();
    animations.forEach((a) => a.cancel());
    stopPolicy();
    signal?.removeEventListener("abort", run.cancel);
    if (runs.get(root) === run) {
      target.style.viewTransitionName = oldName;
      if (oldAttribute === null) root.removeAttribute("data-liquid-route");
      else root.setAttribute("data-liquid-route", oldAttribute);
      runs.delete(root);
    }
  }
}
