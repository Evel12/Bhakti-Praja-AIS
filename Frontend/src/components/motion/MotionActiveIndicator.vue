<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { motionEngine } from "../../motion/engine.js";
import { safeTokens, observeMotionPolicy } from "../../motion/policy.js";
const marker = ref();
let handle, stop;
onMounted(() => {
  const el = marker.value;
  stop = observeMotionPolicy(el, () => handle?.cancel());
  const tokens = safeTokens(el);
  if (!el.ownerDocument.hidden && tokens)
    handle = motionEngine.animate(
      el,
      { opacity: 1, scaleY: 1 },
      {
        from: { opacity: 0, scaleY: tokens.scales.enter },
        tokens,
        preset: "gentle",
      },
    );
});
onBeforeUnmount(() => {
  handle?.cancel();
  stop?.();
});
</script>
<template>
  <span ref="marker" aria-hidden="true" class="liquid-nav-indicator" />
</template>
