<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from "vue";
const props = defineProps({ open: Boolean, title: String });
const emit = defineEmits(["close"]);
const dialog = ref();
let previous;
watch(
  () => props.open,
  async (open) => {
    await nextTick();
    if (open) {
      previous = document.activeElement;
      dialog.value?.showModal();
    } else {
      dialog.value?.close();
      previous?.focus?.();
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => dialog.value?.close());
</script>
<template>
  <dialog
    ref="dialog"
    aria-labelledby="dialog-heading"
    @cancel.prevent="emit('close')"
    @click="
      (e) => {
        if (e.target === dialog) emit('close');
      }
    "
  >
    <div class="dialog-header">
      <h2 id="dialog-heading">{{ title }}</h2>
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
