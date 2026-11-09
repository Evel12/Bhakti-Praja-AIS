<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import { motionEngine } from "../../motion/engine.js";
import { safeTokens, observeMotionPolicy } from "../../motion/policy.js";
const props = defineProps({
  active: Boolean,
  preset: { type: String, default: "smooth" },
});
const root = ref(),
  a = ref(),
  b = ref();
let stop;
function draw() {
  const tokens = safeTokens(root.value);
  if (!tokens) return;
  const scale = tokens.scales.shape;
  motionEngine.animate(
    a.value,
    {
      opacity: props.active ? 0 : 1,
      scaleX: props.active ? scale : 1,
      scaleY: props.active ? scale : 1,
    },
    { tokens, preset: props.preset, retain: true },
  );
  motionEngine.animate(
    b.value,
    {
      opacity: props.active ? 1 : 0,
      scaleX: props.active ? 1 : scale,
      scaleY: props.active ? 1 : scale,
    },
    { tokens, preset: props.preset, retain: true },
  );
}
onMounted(() => {
  stop = observeMotionPolicy(root.value, draw);
  draw();
});
watch(() => props.active, draw);
onBeforeUnmount(() => {
  stop?.();
  motionEngine.reset(a.value);
  motionEngine.reset(b.value);
});
</script>
<template>
  <div ref="root" class="liquid-shape">
    <span ref="a" class="liquid-shape-a" aria-hidden="true"></span
    ><span ref="b" class="liquid-shape-b" aria-hidden="true"></span
    ><span class="liquid-shape-content"><slot /></span>
  </div>
</template>
