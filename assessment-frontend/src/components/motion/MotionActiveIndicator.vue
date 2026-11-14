<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { motionEngine } from "../../motion/engine.js";
import { safeTokens, observeMotionPolicy } from "../../motion/policy.js";
const props = defineProps({
  axis: {
    type: String,
    default: "vertical",
  },
  keepVisible: {
    type: Boolean,
    default: false,
  },
});
const marker = ref();
let handle, stop;
onMounted(() => {
  const el = marker.value;
  stop = observeMotionPolicy(el, () => handle?.cancel());
  const tokens = safeTokens(el);
  if (!el.ownerDocument.hidden && tokens) {
    const scaleKey = props.axis === "horizontal" ? "scaleX" : "scaleY";
    const from = props.keepVisible
      ? { [scaleKey]: tokens.scales.enter }
      : { opacity: 0, [scaleKey]: tokens.scales.enter };
    const to = props.keepVisible
      ? { [scaleKey]: 1 }
      : { opacity: 1, [scaleKey]: 1 };
    handle = motionEngine.animate(
      el,
      to,
      {
        from,
        tokens,
        preset: "gentle",
      },
    );
  }
});
onBeforeUnmount(() => {
  handle?.cancel();
  stop?.();
});
</script>
<template>
  <span ref="marker" aria-hidden="true" class="liquid-nav-indicator" />
</template>
