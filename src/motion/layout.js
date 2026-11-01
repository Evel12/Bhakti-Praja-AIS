import { motionEngine } from "./engine.js";
import { safeTokens } from "./policy.js";

export function captureLayout(elements) {
  return new Map(
    [...elements]
      .filter((el) => el.isConnected)
      .map((el) => [el, el.getBoundingClientRect()]),
  );
}
export async function flipLayout(
  elements,
  update,
  { preset = "smooth", engine = motionEngine, tokens, signal } = {},
) {
  const items = [...elements],
    before = captureLayout(items);
  tokens ??= safeTokens(items[0]);
  await update(); // The caller may await Vue nextTick here. Never repeat update.
  if (signal?.aborted || !tokens) return { status: "skipped" };
  const handles = animateLayout(before, items, { preset, engine, tokens });
  const cancel = () => handles.forEach((h) => h.cancel());
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    await Promise.all(handles.map((h) => h.finished));
    return { status: "finished" };
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
}

/** Reuse a pre-patch snapshot from Vue; all writes/reads stay in batches. */
export function animateLayout(
  before,
  elements,
  { preset = "smooth", engine = motionEngine, tokens } = {},
) {
  const items = [...elements].filter(
    (el) =>
      before.has(el) && el.isConnected && !el.closest('[data-motion="off"]'),
  );
  tokens ??= safeTokens(items[0]);
  if (!tokens || tokens.mode === "off") return [];
  items.forEach((el) => engine.reset(el));
  const after = captureLayout(items),
    deltas = [...after].map(([el, r]) => [
      el,
      {
        x: (before.get(el)?.left ?? r.left) - r.left,
        y: (before.get(el)?.top ?? r.top) - r.top,
      },
    ]);
  const moved = deltas.filter(([, delta]) => delta.x || delta.y);
  const profiles = new Map(
    moved.map(([el]) => {
      const local = safeTokens(el);
      return [el, local && local.mode !== "full" ? local : tokens];
    }),
  );
  const opacity = new Map(
    moved.map(([el]) => [el, engine.prepare?.(el)?.base.opacity ?? 1]),
  );
  return moved.map(([el, delta]) =>
    engine.animate(
      el,
      { x: 0, y: 0, opacity: opacity.get(el) },
      {
        from: profiles.get(el).mode === "full" ? delta : { opacity: 0 },
        tokens: profiles.get(el),
        preset,
      },
    ),
  );
}
