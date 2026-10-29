import { transitionRoute } from "./route.js";
import { motionEngine } from "./engine.js";

/** Visual enhancement after confirmed navigation; never await motion in a guard. */
export function installPageTransitions(
  router,
  {
    getTarget = () => document.getElementById("route-scene"),
    nextRender = () => Promise.resolve(),
    transition = transitionRoute,
    engine = motionEngine,
    document: doc = globalThis.document,
  } = {},
) {
  let active,
    disposed = false;
  function cancel() {
    const run = active;
    if (!run) return;
    run.controller.abort();
    run.target.removeAttribute("data-liquid-page-motion");
    active = undefined;
  }
  const removeHook = router.afterEach((to, from, failure) => {
    cancel();
    if (
      disposed ||
      failure ||
      !from.matched?.length ||
      to.path === from.path ||
      to.meta.exam ||
      from.meta.exam ||
      to.path === "/motion-lab" ||
      from.path === "/motion-lab"
    )
      return;
    const target = getTarget();
    if (!target?.isConnected || doc.hidden) return;
    const run = { target, controller: new AbortController() };
    active = run;
    target.setAttribute("data-liquid-page-motion", "");
    // The router already owns URL/data/focus. The transaction only waits for Vue's DOM patch.
    Promise.resolve()
      .then(() =>
        transition(nextRender, {
          target,
          signal: run.controller.signal,
          engine,
        }),
      )
      .catch(() => {}) // Animation failure cannot roll back a confirmed route.
      .finally(() => {
        if (active === run) {
          target.removeAttribute("data-liquid-page-motion");
          active = undefined;
        }
      });
  });
  const interaction = (e) => {
    // Shell route-focus lands on main, outside the scene; keep that native behavior.
    if (e.type === "focusin" && !active?.target.contains(e.target)) return;
    cancel();
  };
  doc.addEventListener("pointerdown", interaction, true);
  doc.addEventListener("keydown", interaction, true);
  doc.addEventListener("focusin", interaction, true);
  return {
    dispose() {
      disposed = true;
      cancel();
      removeHook();
      doc.removeEventListener("pointerdown", interaction, true);
      doc.removeEventListener("keydown", interaction, true);
      doc.removeEventListener("focusin", interaction, true);
    },
  };
}
