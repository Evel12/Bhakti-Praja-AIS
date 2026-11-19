<script setup>
defineProps({ label: { type: String, default: "Memproses…" } });
</script>
<template>
  <span
    class="liquid-loading"
    data-liquid-loader
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <span class="liquid-loading-dots" aria-hidden="true"
      ><span v-for="dot in 3" :key="dot" data-liquid-dot
    /></span>
    <span>{{ label }}</span>
  </span>
</template>
