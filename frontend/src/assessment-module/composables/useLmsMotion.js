import { onBeforeUnmount, watch } from "vue";
import { motionEngine } from "../motion/engine.js";
import { observeMotionPolicy, safeTokens } from "../motion/policy.js";

/**
 * Matches AssessmentListView tab/filter fade using Examnia's shared spring engine.
 * Runs only on reactive changes after mount so the route remains initial entrance owner.
 */
export function useTabContentMotion(targetRef, source) {
  let handle = null;
  let stopPolicy = null;

  function stop(target = targetRef.value) {
    handle?.cancel();
    handle = null;
    if (target) {
      motionEngine.reset(target);
    }
  }

  watch(
    targetRef,
    (el, prevEl) => {
      if (el === prevEl) return;
      stopPolicy?.();
      stopPolicy = null;
      stop(prevEl);
      if (el) {
        stopPolicy = observeMotionPolicy(el, () => stop(el));
      }
    },
    { flush: "post", immediate: true },
  );

  onBeforeUnmount(() => {
    stopPolicy?.();
    stopPolicy = null;
    stop();
  });

  watch(
    source,
    () => {
      stop();
      const el = targetRef.value;
      const tokens = el ? safeTokens(el) : null;
      if (!el || !tokens || tokens.mode === "off" || el.ownerDocument?.hidden) {
        return;
      }
      handle = motionEngine.animate(
        el,
        { opacity: 1 },
        {
          from: { opacity: 0 },
          preset: "gentle",
          tokens,
        },
      );
    },
    { flush: "post" },
  );

  return { stop: () => stop() };
}

/**
 * Animates progress fill scaleX when progress changes after mount without composing duplicate inline transforms.
 */
export function useProgressBarMotion(barRef, ratioSource) {
  let handle = null;
  let stopPolicy = null;
  let latestRatio = 0;

  const clampRatio = (value) => Math.max(0, Math.min(1, Number(value) || 0));

  function applyStatic(el, ratio = latestRatio) {
    if (el) el.style.transform = `scaleX(${clampRatio(ratio)})`;
  }

  function stop(sync = false, target = barRef.value) {
    handle?.cancel();
    handle = null;
    if (target) {
      motionEngine.reset(target);
      if (sync) applyStatic(target);
    }
  }

  onBeforeUnmount(() => {
    stopPolicy?.();
    stopPolicy = null;
    stop(false);
  });

  watch(
    [barRef, ratioSource],
    ([el, nextRatio], prevTuple) => {
      const [prevEl, prevRatio] = prevTuple || [];
      const toScale = clampRatio(nextRatio);
      const fromScale = clampRatio(prevRatio);
      latestRatio = toScale;

      if (el !== prevEl) {
        stopPolicy?.();
        stopPolicy = null;
        stop(false, prevEl);
        if (el) {
          applyStatic(el, toScale);
          stopPolicy = observeMotionPolicy(el, () => stop(true, el));
        }
        return;
      }

      if (!el) return;

      const tokens = safeTokens(el);
      if (!tokens || tokens.mode !== "full" || el.ownerDocument?.hidden || toScale === fromScale) {
        stop(false, el);
        applyStatic(el, toScale);
        return;
      }

      stop(false, el);
      // Clear static inline scaleX so motionEngine captures an empty base transform before retain:true.
      el.style.transform = "";
      handle = motionEngine.animate(
        el,
        { scaleX: toScale },
        {
          from: { scaleX: fromScale },
          preset: "smooth",
          tokens,
          retain: true,
        },
      );
    },
    { flush: "post", immediate: true },
  );

  return { stop: (sync = false) => stop(typeof sync === "boolean" ? sync : false) };
}
