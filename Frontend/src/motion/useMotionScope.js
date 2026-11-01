import { onMounted, onBeforeUnmount } from "vue";
import { createMotionScope } from "./interactions.js";
export function useMotionScope(root, options = {}) {
  let scope;
  onMounted(() => {
    if (root.value) scope = createMotionScope(root.value, options);
  });
  onBeforeUnmount(() => scope?.dispose());
  return { refresh: () => scope?.refresh(), stats: () => scope?.stats() };
}
