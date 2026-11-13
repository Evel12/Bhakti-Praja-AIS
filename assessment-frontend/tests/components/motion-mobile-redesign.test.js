import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { readMotionTokens } from "../../src/motion/tokens.js";
import { animateSlide } from "../../src/motion/presence.js";
import { createOverlayMotion } from "../../src/motion/overlays.js";
import { createMotionEngine, motionEngine } from "../../src/motion/engine.js";
import AttemptView from "../../src/views/student/AttemptView.vue";
import AssessmentBuilderView from "../../src/views/teacher/AssessmentBuilderView.vue";
import { useAssessmentStore } from "../../src/stores/assessmentStore.js";
import {
  tokens,
  clock,
  element,
  installMedia,
  installTokenStyles,
} from "./motion-fixture.js";

const css = readFileSync(resolve(process.cwd(), "src/motion/tokens.css"), "utf8");
const mobileBlock = css.match(/@media \(max-width: 1023px\)[^{]+\{\s*:root\s*\{([^}]+)\}/)?.[1] || "";

let cleanup = [];
let pinia;

beforeEach(() => {
  localStorage.clear();
  cleanup = [];
  pinia = createPinia();
  setActivePinia(pinia);
  installMedia();
  installTokenStyles();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});

afterEach(() => {
  cleanup.forEach((fn) => fn());
  pinia?._s.forEach((store) => store.$dispose());
  motionEngine.dispose();
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("mobile motion tokens, slide, and bottom-sheet overlays", () => {
  it("exposes sheet and slide distances in tokens and preserves >=5 concurrent animations on mobile", () => {
    const t = tokens("full");
    expect(t.distances.sheet).toBeGreaterThan(0);
    expect(t.distances.slide).toBeGreaterThan(0);

    const reduced = tokens("reduced");
    expect(reduced.distances.sheet).toBe(0);
    expect(reduced.distances.slide).toBe(0);

    const maxMatch = mobileBlock.match(/--motion-max-concurrent:\s*(\d+)/);
    expect(Number(maxMatch?.[1])).toBeGreaterThanOrEqual(5);
    expect(Number(maxMatch?.[1])).toBeLessThan(8);
  });

  it("animates directional horizontal slides and falls back to opacity-only in reduced mode", async () => {
    const c = clock();
    const engine = createMotionEngine({ ...c, getTokens: () => tokens("full") });
    const el = element("section");

    const forward = animateSlide(el, { direction: 1, tokens: tokens("full"), engine });
    c.step();
    expect(el.style.transform).toContain("translate3d(");
    c.flush();
    await forward.finished;
    expect(el.style.transform).toBe("");

    const reducedEl = element("section");
    const reducedEngine = createMotionEngine({ ...c, getTokens: () => tokens("reduced") });
    const reducedSlide = animateSlide(reducedEl, {
      direction: -1,
      tokens: tokens("reduced"),
      engine: reducedEngine,
    });
    c.step();
    expect(reducedEl.style.transform).toBe("");
    expect(reducedEl.style.opacity).not.toBe("");
    c.flush();
    await reducedSlide.finished;
  });

  it("uses vertical sheet motion without scale shrinking on mobile viewports", async () => {
    const media = installMedia();
    media.forEach((m) => {
      if (m.media === "(max-width: 768px)") m.matches = true;
    });
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query) => ({
        matches: query === "(max-width: 768px)",
        media: query,
        addEventListener() {},
        removeEventListener() {},
      })),
    );
    const root = element();
    const el = element("div");
    el.className = "dialog-surface";
    el.getBoundingClientRect = () => ({ left: 0, top: 400, width: 390, height: 320 });
    root.append(el);

    const c = clock();
    const engine = createMotionEngine({ ...c, getTokens: () => tokens("full") });
    const animateSpy = vi.spyOn(engine, "animate");
    const overlay = createOverlayMotion(root, { engine, variant: "sheet" });
    cleanup.push(() => overlay.dispose());

    overlay.enter(el);
    expect(animateSpy).toHaveBeenCalled();
    const enterCall = animateSpy.mock.calls.at(-1);
    expect(enterCall[2].from.y).toBe(tokens("full").distances.sheet);
    expect(enterCall[2].from.scaleX).toBeUndefined();
    c.flush();

    overlay.exit(el);
    await flushPromises();
    const exitCall = animateSpy.mock.calls.at(-1);
    expect(exitCall[1].y).toBe(tokens("full").distances.sheet);
    expect(exitCall[1].scaleX).toBeUndefined();
    const ghost = document.querySelector(".liquid-overlay-ghost");
    expect(ghost?.classList.contains("is-sheet")).toBe(true);
    c.flush();
  });

  it("animates .exam-question-stage directionally on question change while keeping .exam-question-panel stationary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T05:00:00Z"));
    const store = useAssessmentStore();
    const assessment = store.db.assessments.find((a) => a.id === "as-network");
    const attemptId = store.start(assessment);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/attempt/:id", component: AttemptView },
        { path: "/review/:id", component: { template: "<p>Done</p>" } },
      ],
    });
    await router.push("/attempt/" + attemptId);

    const animateSpy = vi.spyOn(motionEngine, "animate");
    const wrapper = mount(RouterView, {
      attachTo: document.body,
      global: {
        plugins: [pinia, router],
        stubs: {
          AppDialog: {
            props: ["open", "title"],
            template: '<div v-if="open" role="dialog"><slot /><slot name="footer" /></div>',
          },
        },
      },
    });
    cleanup.push(() => wrapper.unmount());
    await flushPromises();

    const panel = wrapper.get(".panel.exam-question-panel").element;
    const stage = wrapper.get(".exam-question-stage").element;
    animateSpy.mockClear();

    const nextBtn = wrapper.findAll(".exam-bottom .action-row button").at(-1);
    await nextBtn.trigger("click");
    await flushPromises();

    const forwardCall = animateSpy.mock.calls.find(([el]) => el === stage);
    expect(forwardCall).toBeTruthy();
    expect(forwardCall[2].from.x).toBeGreaterThan(0);
    expect(animateSpy.mock.calls.some(([el]) => el === panel)).toBe(false);

    animateSpy.mockClear();
    const prevBtn = wrapper.findAll(".exam-bottom .action-row button").at(0);
    await prevBtn.trigger("click");
    await flushPromises();

    const backCall = animateSpy.mock.calls.find(([el]) => el === stage);
    expect(backCall).toBeTruthy();
    expect(backCall[2].from.x).toBeLessThan(0);
    expect(animateSpy.mock.calls.some(([el]) => el === panel)).toBe(false);
  });

  it("animates .builder-step-stage directionally on step change while keeping .builder-form stationary", async () => {
    const store = useAssessmentStore();
    const draft = store.db.assessments.find((a) => a.state === "draft") || store.createDraft?.();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/builder/:id", component: AssessmentBuilderView }],
    });
    await router.push("/builder/" + draft.id);

    const animateSpy = vi.spyOn(motionEngine, "animate");
    const wrapper = mount(RouterView, {
      attachTo: document.body,
      global: {
        plugins: [pinia, router],
        stubs: {
          AppDialog: {
            props: ["open", "title"],
            template: '<div v-if="open" role="dialog"><slot /><slot name="footer" /></div>',
          },
        },
      },
    });
    cleanup.push(() => wrapper.unmount());
    await flushPromises();

    const formPanel = wrapper.get(".panel.builder-form").element;
    const stage = wrapper.get(".builder-step-stage").element;
    animateSpy.mockClear();

    await wrapper.get(".builder-footer .btn.primary").trigger("click");
    await flushPromises();

    const forwardCall = animateSpy.mock.calls.find(([el]) => el === stage);
    expect(forwardCall).toBeTruthy();
    expect(forwardCall[2].from.x).toBeGreaterThan(0);
    expect(animateSpy.mock.calls.some(([el]) => el === formPanel)).toBe(false);

    animateSpy.mockClear();
    await wrapper.findAll(".builder-footer .action-row button").at(0).trigger("click");
    await flushPromises();

    const backCall = animateSpy.mock.calls.find(([el]) => el === stage);
    expect(backCall).toBeTruthy();
    expect(backCall[2].from.x).toBeLessThan(0);
    expect(animateSpy.mock.calls.some(([el]) => el === formPanel)).toBe(false);
  });
});
