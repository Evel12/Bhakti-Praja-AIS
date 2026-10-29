import { observeReveals } from "./reveal.js";
import { motionEngine } from "./engine.js";

const selector = ".panel,.bank-card,.help-card";
const excluded =
  "dialog,.sidebar,.exam-shell,[data-liquid-scope='local'],[data-liquid-list],[data-liquid-page-motion]";

/** New panels/cards share one observer. Avoid nested effects and active exams. */
export function createContainerMotionScope(
  root,
  { engine = motionEngine } = {},
) {
  return observeReveals(root, {
    selector,
    engine,
    dynamic: true,
    initialHide: false,
    stagger: true,
    filter: (el) =>
      !el.closest(excluded) &&
      !el.querySelector("[data-liquid-list]") &&
      !el.parentElement?.closest(selector),
  });
}
