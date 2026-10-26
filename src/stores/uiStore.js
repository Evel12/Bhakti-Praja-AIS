import { defineStore } from "pinia";
import { ref } from "vue";
export const SIDEBAR_KEY = "examnia.ui.sidebarCollapsed";
export const useUiStore = defineStore("ui", () => {
  let initial = false;
  try {
    initial = localStorage.getItem(SIDEBAR_KEY) === "true";
  } catch {}
  const collapsed = ref(initial),
    mobileOpen = ref(false),
    message = ref(""),
    error = ref(false);
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
    clearTimeout(timer);
    timer = setTimeout(() => (message.value = ""), 5000);
  }
  return { collapsed, mobileOpen, message, error, toggle, toast };
});
