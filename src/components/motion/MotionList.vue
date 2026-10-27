<script setup>
import {
  ref,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
} from "vue";
import { createListMotion } from "../../motion/lists.js";
const props = defineProps({
  as: { type: String, default: "div" },
  itemKeys: { type: Array, required: true },
});
const root = ref();
let motion,
  snapshot,
  rendered = [];
const changed = () =>
  props.itemKeys.length !== rendered.length ||
  props.itemKeys.some((key, i) => key !== rendered[i]);
onMounted(() => {
  rendered = [...props.itemKeys];
  motion = createListMotion(root.value);
});
onBeforeUpdate(() => {
  if (changed()) snapshot = motion?.capture();
});
onUpdated(() => {
  if (snapshot) {
    motion?.update(snapshot);
    snapshot = null;
  }
  rendered = [...props.itemKeys];
});
onBeforeUnmount(() => motion?.dispose());
</script>
<template>
  <component :is="as" ref="root" data-liquid-list><slot /></component>
</template>
