<script setup>
defineOptions({ inheritAttrs: false });
defineProps({
  variant: { type: String, default: "" },
  disabled: Boolean,
  type: { type: String, default: "button" },
});
</script>
<template>
  <button
    v-bind="$attrs"
    :type="type"
    data-liquid-interactive
    class="liquid-hit-target"
    :disabled="disabled"
  >
    <span data-liquid-surface class="btn liquid-surface" :class="variant"
      ><slot
    /></span>
  </button>
</template>
