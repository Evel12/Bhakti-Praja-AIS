import { onBeforeUnmount } from "vue";
import { motionEngine } from "../motion/engine.js";
import { createOverlayMotion } from "../motion/overlays.js";
import { safeTokens } from "../motion/policy.js";

/**
 * Shared mobile bottom-sheet motion controller (enter/exit sheet + backdrop fade)
 * used by custom filter dropdowns and SoftSelect.
 */
export function useBottomSheetMotion(containerRef) {
  let overlay = null;
  let backdropAnim = null;

  function ensureOverlay() {
    if (!overlay && containerRef.value && typeof window?.matchMedia === "function") {
      overlay = createOverlayMotion(containerRef.value, { variant: "sheet" });
    }
    return overlay;
  }

  function cancelBackdrop() {
    backdropAnim?.cancel();
    backdropAnim = null;
  }

  function enterSheet(popoverEl, backdropEl) {
    if (!popoverEl) return;
    ensureOverlay()?.enter(popoverEl);
    if (backdropEl) {
      cancelBackdrop();
      const tokens = safeTokens(backdropEl);
      if (tokens && tokens.mode !== "off" && !backdropEl.ownerDocument?.hidden) {
        backdropAnim = motionEngine.animate(
          backdropEl,
          { opacity: 1 },
          { from: { opacity: 0 }, tokens, preset: "gentle" },
        );
      }
    }
  }

  function exitSheet(popoverEl) {
    cancelBackdrop();
    if (popoverEl) {
      ensureOverlay()?.exit(popoverEl);
    }
  }

  onBeforeUnmount(() => {
    cancelBackdrop();
    overlay?.dispose();
    overlay = null;
  });

  return { enterSheet, exitSheet, cancelBackdrop };
}
