import { motionEngine } from "./engine.js";
import { captureLayout, animateLayout } from "./layout.js";
import { observeReveals } from "./reveal.js";
import { safeTokens, observeMotionPolicy } from "./policy.js";

const itemsIn = (root) =>
  [...root.children].filter((el) => el.hasAttribute("data-motion-key"));

/** Structural updates only. Vue removes real items immediately; inert ghosts
 * are visual only and never delay data, focus, counts or navigation. */
export function createListMotion(root, { engine = motionEngine } = {}) {
  const handles = new Set(),
    ghosts = new Set();
  const reveals = observeReveals(root, {
    selector: ":scope > [data-motion-key]",
    engine,
    initialHide: false,
    stagger: true,
    filter: () => !root.closest("[data-liquid-page-motion]"),
  });
  let disposed = false;
  function cancel() {
    for (const h of handles) h.cancel();
    handles.clear();
    for (const ghost of ghosts) ghost.remove();
    ghosts.clear();
  }
  function track(h, ghost) {
    handles.add(h);
    h.finished.then(() => {
      handles.delete(h);
      if (ghost) {
        ghost.remove();
        ghosts.delete(ghost);
      }
    });
  }
  function buildExit(el, rect, tokens) {
    const doc = root.ownerDocument,
      win = doc.defaultView;
    if (
      tokens.mode === "off" ||
      doc.hidden ||
      el.closest('[data-motion="off"]') ||
      rect.width <= 0 ||
      rect.height <= 0 ||
      rect.bottom <= 0 ||
      rect.top >= win.innerHeight ||
      rect.right <= 0 ||
      rect.left >= win.innerWidth ||
      el.querySelector("input,select,textarea,video,audio,iframe")
    )
      return;
    const ghost = doc.createElement("div"),
      clone = el.cloneNode(true);
    ghost.className = "liquid-exit-ghost";
    ghost.setAttribute("aria-hidden", "true");
    ghost.setAttribute("inert", "");
    Object.assign(ghost.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    clone.setAttribute("data-motion", "off");
    if (el.tagName === "TR") {
      const table = doc.createElement("table"),
        body = doc.createElement("tbody");
      table.className = rect.tableClass;
      table.style.width = "100%";
      for (const [i, cell] of [...clone.children].entries())
        if (rect.cells?.[i]) cell.style.width = `${rect.cells[i]}px`;
      body.append(clone);
      table.append(body);
      ghost.append(table);
    } else ghost.append(clone);
    // No duplicate IDs, tab stops, link destinations or focus relationships.
    for (const node of [clone, ...clone.querySelectorAll("*")]) {
      for (const attr of [
        "id",
        "for",
        "href",
        "autofocus",
        "aria-labelledby",
        "aria-describedby",
      ])
        node.removeAttribute(attr);
      if (
        node.matches(
          "button,a,input,select,textarea,[tabindex],[contenteditable]",
        )
      ) {
        node.setAttribute("tabindex", "-1");
        node.removeAttribute("contenteditable");
      }
      node.style.willChange = "";
    }
    doc.body.append(ghost);
    ghosts.add(ghost);
    return ghost;
  }
  const stopPolicy = observeMotionPolicy(root, cancel, engine);
  const stop = () => {
    cancel();
    reveals.refresh();
    for (const item of itemsIn(root)) engine.reset(item);
  };
  const onScroll = () => {
    if (ghosts.size) cancel();
  };
  const win = root.ownerDocument.defaultView;
  root.addEventListener("focusin", stop);
  win.addEventListener("scroll", onScroll, { passive: true, capture: true });
  win.addEventListener("resize", stop, { passive: true });
  return {
    capture() {
      if (disposed) return new Map();
      cancel();
      reveals.refresh();
      if (root.ownerDocument.hidden || safeTokens(root)?.mode === "off")
        return new Map();
      const items = itemsIn(root);
      items.forEach((el) => engine.reset(el));
      const before = captureLayout(items);
      // Table column widths are measured together before any exit-layer writes.
      return new Map(
        [...before].map(([el, r]) => [
          el,
          {
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
            tableClass: el.closest("table")?.className || "",
            tokens: safeTokens(el),
            cells:
              el.tagName === "TR" &&
              win.getComputedStyle(el).display === "table-row"
                ? [...el.children].map(
                    (cell) => cell.getBoundingClientRect().width,
                  )
                : null,
          },
        ]),
      );
    },
    update(before) {
      if (disposed) return;
      const items = itemsIn(root),
        current = new Set(items),
        tokens = safeTokens(root);
      if (!tokens || root.ownerDocument.hidden) {
        reveals.add?.();
        return;
      }
      const retained = items.filter((el) => before.has(el));
      const focused = root.ownerDocument.activeElement;
      for (const h of animateLayout(
        before,
        retained.filter((el) => !el.contains(focused)),
        { tokens, engine },
      ))
        track(h);
      const exits = [];
      let available = tokens.limits.maxConcurrent - engine.stats().active;
      for (const [el, rect] of before)
        if (!current.has(el) && available > 0) {
          const local = rect.tokens || tokens;
          const ghost = buildExit(el, rect, local);
          if (ghost) {
            exits.push({ ghost, tokens: local });
            available--;
          }
        }
      exits.forEach(({ ghost }) => engine.prepare(ghost));
      for (const { ghost, tokens: local } of exits)
        track(
          engine.animate(
            ghost,
            { y: -local.distances.reveal, opacity: 0 },
            {
              preset: "smooth",
              tokens: local,
            },
          ),
          ghost,
        );
      reveals.add?.();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopPolicy();
      cancel();
      reveals.dispose();
      for (const item of itemsIn(root)) engine.reset(item);
      root.removeEventListener("focusin", stop);
      win.removeEventListener("scroll", onScroll, { capture: true });
      win.removeEventListener("resize", stop);
    },
  };
}
