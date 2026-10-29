export function isLimitedDevice(nav = {}) {
  const limited = (value) => Number.isFinite(value) && value > 0 && value <= 4;
  return (
    nav.connection?.saveData === true ||
    limited(nav.hardwareConcurrency) ||
    limited(nav.deviceMemory)
  );
}

/** Conservative hints only. Missing browser hints never mean zero capacity. */
export function installMotionCapabilities(
  root,
  nav = root.ownerDocument.defaultView.navigator,
) {
  const original = root.getAttribute("data-motion-tier");
  const update = () => {
    if (original === "lite" || isLimitedDevice(nav))
      root.setAttribute("data-motion-tier", "lite");
    else if (original === null) root.removeAttribute("data-motion-tier");
    else root.setAttribute("data-motion-tier", original);
  };
  update();
  nav.connection?.addEventListener?.("change", update);
  return {
    dispose() {
      nav.connection?.removeEventListener?.("change", update);
      if (original === null) root.removeAttribute("data-motion-tier");
      else root.setAttribute("data-motion-tier", original);
    },
  };
}
