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
  // Reset writes and final geometry reads are batched, never interleaved per item.
  items.forEach((el) => engine.reset(el));
  const after = captureLayout(items),
    deltas = [...after].map(([el, r]) => [
      el,
      {
        x: (before.get(el)?.left ?? r.left) - r.left,
        y: (before.get(el)?.top ?? r.top) - r.top,
      },
    ]);
  const handles = deltas.map(([el, delta]) =>
    engine.animate(
      el,
      { x: 0, y: 0, opacity: 1 },
      { from: tokens.mode === "full" ? delta : { opacity: 0 }, tokens, preset },
    ),
  );
  const cancel = () => handles.forEach((h) => h.cancel());
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    await Promise.all(handles.map((h) => h.finished));
    return { status: "finished" };
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
}
