<script setup>
import { paths } from "../../utils/icons.js";
defineProps({ name: { type: String, default: "file" } });
</script>
<template>
  <svg
    class="icon"
    :data-liquid-icon="name"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="paths[name] || paths.file"
  ></svg>
</template>
