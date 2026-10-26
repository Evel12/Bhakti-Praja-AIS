import { ref, computed, onMounted, onBeforeUnmount } from "vue";
export function useCountdown(expiresAt, onExpired) {
  const now = ref(Date.now());
  let timer,
    handled = false;
  const remaining = computed(() =>
    Math.max(0, Date.parse(expiresAt.value) - now.value),
  );
  const display = computed(() => {
    const s = Math.ceil(remaining.value / 1000);
    return `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  });
  function tick() {
    now.value = Date.now();
    if (remaining.value === 0 && !handled) {
      handled = true;
      onExpired();
    }
  }
  onMounted(() => {
    timer = setInterval(tick, 1000);
    tick();
  });
  onBeforeUnmount(() => clearInterval(timer));
  return { remaining, display };
}
