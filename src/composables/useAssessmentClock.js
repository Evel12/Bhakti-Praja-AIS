import { onBeforeUnmount, onMounted, ref, watch } from "vue";

// Refresh at schedule boundaries and WIB date changes without sorting every second.
export function useAssessmentClock(assessments) {
  const now = ref(Date.now());
  let timer;
  function refresh() {
    clearTimeout(timer);
    now.value = Date.now();
    if (document.hidden) return;
    let next = Math.floor(now.value / 60000) * 60000 + 60000;
    for (const a of assessments()) {
      if (a.state !== "published") continue;
      for (const value of [a.openAt, a.closeAt]) {
        const boundary = Date.parse(value);
        if (boundary > now.value) next = Math.min(next, boundary);
      }
    }
    timer = setTimeout(refresh, Math.max(1, next - Date.now()));
  }
  const stop = watch(() => assessments().map((a) => [a.state, a.openAt, a.closeAt]), refresh);
  onMounted(() => {
    refresh();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("focus", refresh);
  });
  onBeforeUnmount(() => {
    stop();
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("pageshow", refresh);
    window.removeEventListener("focus", refresh);
  });
  return now;
}
