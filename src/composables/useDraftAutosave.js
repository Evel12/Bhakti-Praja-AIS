import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

// The local repository acknowledges writes synchronously, including on page exit.
export function useDraftAutosave(draft, persist, delay = 600) {
  const snapshot = () => JSON.stringify(draft.value);
  const saved = ref(snapshot()), error = ref("");
  const dirty = computed(() => draft.value?.state === "draft" && snapshot() !== saved.value);
  const status = computed(() => error.value ? "error" : dirty.value ? "saving" : "saved");
  let timer;

  function cancel() {
    clearTimeout(timer);
    timer = undefined;
  }
  function markSaved() {
    cancel();
    saved.value = snapshot();
    error.value = "";
  }
  function save() {
    cancel();
    if (!dirty.value) return true;
    try {
      persist(draft.value);
      markSaved();
      return true;
    } catch (e) {
      error.value = e.message || "Penyimpanan draft gagal.";
      return false;
    }
  }
  function beforeUnload(event) {
    if (!save()) {
      event.preventDefault();
      event.returnValue = "";
    }
  }
  function hidden() {
    if (document.visibilityState === "hidden") save();
  }
  const stopDraft = watch(draft, () => {
    cancel();
    if (dirty.value) timer = setTimeout(save, delay);
    else error.value = "";
  }, { deep: true, flush: "sync" });
  // Only dirty editors need an unload guard; clean pages remain eligible for bfcache.
  const stopUnload = watch(dirty, (pending) => {
    if (pending) window.addEventListener("beforeunload", beforeUnload);
    else window.removeEventListener("beforeunload", beforeUnload);
  }, { flush: "sync" });
  onMounted(() => {
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", save);
  });
  onBeforeUnmount(() => {
    save();
    stopDraft();
    stopUnload();
    cancel();
    document.removeEventListener("visibilitychange", hidden);
    window.removeEventListener("pagehide", save);
    window.removeEventListener("beforeunload", beforeUnload);
  });
  return { dirty, status, error, save, markSaved };
}
