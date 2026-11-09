import { defineStore } from "pinia";
import { ref, onScopeDispose } from "vue";
export const SIDEBAR_KEY = "examnia.ui.sidebarCollapsed";
export const useUiStore = defineStore("ui", () => {
  let initial = false;
  try {
    initial = localStorage.getItem(SIDEBAR_KEY) === "true";
  } catch {}
  const collapsed = ref(initial),
    mobileOpen = ref(false),
    message = ref(""),
    error = ref(false),
    toastSequence = ref(0);
  let timer;
  function toggle() {
    collapsed.value = !collapsed.value;
    try {
      localStorage.setItem(SIDEBAR_KEY, String(collapsed.value));
    } catch {}
  }
  function toast(text, isError = false) {
    message.value = text;
    error.value = isError;
    toastSequence.value++;
    resumeToast();
  }
  // Reading time is product behavior, not a motion duration.
  function pauseToast() {
    clearTimeout(timer);
  }
  function resumeToast() {
    pauseToast();
    if (message.value) timer = setTimeout(dismissToast, 5000);
  }
  function dismissToast() {
    pauseToast();
    message.value = "";
  }
  onScopeDispose(pauseToast);
  return {
    collapsed,
    mobileOpen,
    message,
    error,
    toggle,
    toast,
    toastSequence,
    pauseToast,
    resumeToast,
    dismissToast,
  };
});
