<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount, useId } from "vue";
import { createOverlayMotion } from "../../motion/overlays.js";
const props = defineProps({
  message: String,
  error: Boolean,
  sequence: Number,
});
const emit = defineEmits(["dismiss", "pause", "resume"]);
const toastId = `toast-${useId()}`;
const root = ref(),
  toast = ref(),
  announcement = ref("");
let motion,
  revision = 0,
  disposed = false,
  previous,
  hovering = false,
  focused = false;
function resume() {
  if (!hovering && !focused) emit("resume");
}
function focusIn(e) {
  if (!root.value.contains(e.relatedTarget)) previous = e.relatedTarget;
  focused = true;
  emit("pause");
}
function focusOut(e) {
  if (root.value.contains(e.relatedTarget)) return;
  focused = false;
  resume();
}
function dismiss() {
  if (toast.value?.contains(document.activeElement) && previous?.isConnected)
    previous.focus({ preventScroll: true });
  emit("dismiss");
}
onMounted(() => {
  motion = createOverlayMotion(root.value);
  if (toast.value) motion.enter(toast.value);
  announcement.value = props.message || "";
});
watch(
  () => [props.message, props.sequence],
  async () => {
    const ticket = ++revision;
    if (!props.message && toast.value) motion?.exit(toast.value);
    else motion?.stop();
    announcement.value = "";
    await nextTick();
    if (disposed || ticket !== revision) return;
    announcement.value = props.message || "";
    if (toast.value) {
      motion?.enter(toast.value);
      if (hovering || focused) emit("pause");
    } else hovering = focused = false;
  },
);
onBeforeUnmount(() => {
  disposed = true;
  revision++;
  motion?.dispose();
});
</script>
<template>
  <div ref="root" class="toast-region">
    <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {{ announcement }}
    </div>
    <div
      v-if="message"
      :id="toastId"
      ref="toast"
      class="toast"
      :class="{ error }"
      @pointerenter="
        hovering = true;
        emit('pause');
      "
      @pointerleave="
        hovering = false;
        resume();
      "
      @focusin="focusIn"
      @focusout="focusOut"
    >
      <span>{{ message }}</span>
      <button
        type="button"
        class="icon-btn toast-dismiss"
        aria-label="Tutup notifikasi"
        @click="dismiss"
      >
        ✕
      </button>
    </div>
  </div>
</template>
