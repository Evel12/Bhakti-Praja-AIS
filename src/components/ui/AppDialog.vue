<script setup>
import { ref, watch, nextTick, onBeforeUnmount, useId } from "vue";
import { createOverlayMotion } from "../../motion/overlays.js";
const props = defineProps({ open: Boolean, title: String });
const emit = defineEmits(["close"]);
const dialog = ref();
const headingId = useId();
let previous,
  motion,
  revision = 0,
  disposed = false;
watch(
  () => props.open,
  async (open) => {
    const ticket = ++revision;
    if (!open) {
      if (!dialog.value?.open) return;
      // Capture before Vue patches cleared slot data; release the native modal now.
      motion?.exit(dialog.value);
      dialog.value.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
      return;
    }
    await nextTick();
    if (disposed || ticket !== revision || !dialog.value) return;
    motion ||= createOverlayMotion(dialog.value);
    if (dialog.value.open) return;
    previous = document.activeElement;
    dialog.value.showModal();
    motion.enter(dialog.value);
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  disposed = true;
  revision++;
  motion?.dispose();
  const wasOpen = dialog.value?.open;
  dialog.value?.close();
  if (wasOpen && previous?.isConnected) previous.focus({ preventScroll: true });
});
</script>
<template>
  <dialog
    ref="dialog"
    class="dialog-surface"
    :aria-labelledby="headingId"
    @cancel.prevent="emit('close')"
    @click="
      (e) => {
        if (e.target === dialog) emit('close');
      }
    "
  >
    <div class="dialog-header">
      <h2 :id="headingId">{{ title }}</h2>
      <button class="icon-btn" aria-label="Tutup dialog" @click="emit('close')">
        ✕
      </button>
    </div>
    <slot />
    <div class="dialog-footer">
      <slot name="footer"
        ><button class="btn" @click="emit('close')">Tutup</button></slot
      >
    </div>
  </dialog>
</template>
