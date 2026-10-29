<script setup>
import { ref, useId, watch, onMounted, onBeforeUnmount, computed } from "vue";
import { motionEngine } from "../../motion/engine.js";
import { safeTokens, observeMotionPolicy } from "../../motion/policy.js";
const props = defineProps({ active: Boolean });
const id = `liquid-goo-${useId().replaceAll(":", "")}`,
  root = ref(),
  a = ref(),
  b = ref(),
  tokens = ref();
let stop;
const enabled = computed(() => tokens.value?.limits.gooey),
  matrix = computed(
    () =>
      `1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${tokens.value?.effects.gooMultiplier ?? 1} -${tokens.value?.effects.gooOffset ?? 0}`,
  );
function draw() {
  tokens.value = safeTokens(root.value);
  if (!tokens.value) return;
  if (root.value.ownerDocument.hidden) {
    motionEngine.reset(a.value);
    motionEngine.reset(b.value);
    return;
  }
  const t = tokens.value,
    travel = t.effects.gooTravel;
  for (const [el, sign] of [
    [a.value, -1],
    [b.value, 1],
  ])
    motionEngine.animate(
      el,
      enabled.value
        ? {
            x: props.active ? sign * travel : 0,
            y: props.active ? -sign * travel : 0,
            opacity: 1,
          }
        : { x: 0, y: 0, opacity: 1 },
      {
        from: !enabled.value ? { opacity: 0 } : undefined,
        tokens: t,
        preset: "gentle",
        retain: true,
      },
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
  <div
    ref="root"
    class="liquid-goo"
    :data-gooey="enabled ? 'on' : 'off'"
    aria-hidden="true"
  >
    <svg width="0" height="0" focusable="false">
      <defs>
        <filter
          :id="id"
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
          color-interpolation-filters="sRGB"
        >
          <feGaussianBlur
            in="SourceGraphic"
            :stdDeviation="tokens?.distances.gooBlur || 0"
            result="blur"
          />
          <feColorMatrix in="blur" type="matrix" :values="matrix" />
        </filter>
      </defs>
    </svg>
    <div
      class="liquid-goo-layer"
      :style="{ filter: enabled ? `url(#${id})` : 'none' }"
    >
      <span ref="a" class="liquid-blob blob-a"></span
      ><span ref="b" class="liquid-blob blob-b"></span>
    </div>
  </div>
</template>
