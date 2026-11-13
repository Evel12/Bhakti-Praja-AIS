<script setup>
import { onBeforeUnmount } from "vue";
import { animatePresence } from "../../motion/presence.js";
const props = defineProps({
  preset: { type: String, default: "smooth" },
  index: { type: Number, default: 0 },
  appear: Boolean,
});
const handles = new Map();
function run(el, done, direction) {
  handles.get(el)?.cancel();
  const h = animatePresence(el, {
    direction,
    preset: props.preset,
    index: props.index,
  });
  handles.set(el, h);
  h.finished.then(() => {
    if (handles.get(el) === h) handles.delete(el);
    done();
  });
}
function cancel(el) {
  handles.get(el)?.cancel();
  handles.delete(el);
}
onBeforeUnmount(() => {
  for (const h of handles.values()) h.cancel();
  handles.clear();
});
</script>
<template>
  <Transition
    :css="false"
    :appear="appear"
    @enter="(el, done) => run(el, done, 'enter')"
    @leave="(el, done) => run(el, done, 'exit')"
    @enter-cancelled="cancel"
    @leave-cancelled="cancel"
    ><slot
  /></Transition>
</template>
