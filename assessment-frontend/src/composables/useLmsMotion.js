import { onBeforeUnmount, onMounted, watch } from "vue";
import { motionEngine } from "../motion/engine.js";
import { observeMotionPolicy, safeTokens } from "../motion/policy.js";

/**
 * Matches AssessmentListView tab/filter fade using Examnia's shared spring engine.
 * Runs only on reactive changes after mount so the route remains initial entrance owner.
 */
export function useTabContentMotion(targetRef, source) {
  let handle = null;
  let stopPolicy = null;

  function stop() {
    handle?.cancel();
    handle = null;
    if (targetRef.value) {
      motionEngine.reset(targetRef.value);
    }
  }

  onMounted(() => {
    if (targetRef.value) {
      stopPolicy = observeMotionPolicy(targetRef.value, stop);
    }
  });

  onBeforeUnmount(() => {
    stopPolicy?.();
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

  return { stop };
}

/**
 * Animates progress fill scaleX when progress changes after mount without composing duplicate inline transforms.
 */
export function useProgressBarMotion(barRef, ratioSource) {
  let handle = null;
  let stopPolicy = null;
  let latestRatio = 0;

  const clampRatio = (value) => Math.max(0, Math.min(1, Number(value) || 0));
  const readSource = () =>
    typeof ratioSource === "function" ? ratioSource() : ratioSource?.value;

  function applyStatic(el, ratio = latestRatio) {
    if (el) el.style.transform = `scaleX(${clampRatio(ratio)})`;
  }

  function stop(sync = false) {
    handle?.cancel();
    handle = null;
    if (barRef.value) {
      motionEngine.reset(barRef.value);
      if (sync) applyStatic(barRef.value);
    }
  }

  onMounted(() => {
    latestRatio = clampRatio(readSource());
    if (barRef.value) {
      applyStatic(barRef.value, latestRatio);
      stopPolicy = observeMotionPolicy(barRef.value, () => stop(true));
    }
  });

  onBeforeUnmount(() => {
    stopPolicy?.();
    stop(false);
  });

  watch(
    ratioSource,
    (nextRatio, prevRatio) => {
      const el = barRef.value;
      const toScale = clampRatio(nextRatio);
      const fromScale = clampRatio(prevRatio);
      latestRatio = toScale;
      if (!el) return;
      const tokens = safeTokens(el);
      if (!tokens || tokens.mode === "off" || el.ownerDocument?.hidden) {
        stop(false);
        applyStatic(el, toScale);
        return;
      }
      stop(false);
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
    { flush: "post" },
  );

  return { stop };
}
