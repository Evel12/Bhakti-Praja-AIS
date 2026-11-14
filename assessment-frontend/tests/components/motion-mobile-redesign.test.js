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
import MotionActiveIndicator from "../../src/components/motion/MotionActiveIndicator.vue";
import AppSidebar from "../../src/components/navigation/AppSidebar.vue";
import AppToast from "../../src/components/ui/AppToast.vue";
import { useUiStore } from "../../src/stores/uiStore.js";
import { useProgressBarMotion } from "../../src/composables/useLmsMotion.js";
import { ref } from "vue";
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

  it("keeps AppToast non-sheet on mobile viewports so toasts never animate or clone as bottom sheets", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query) => ({
        matches: query === "(max-width: 768px)",
        media: query,
        addEventListener() {},
        removeEventListener() {},
      })),
    );
    const w = mount(AppToast, {
      attachTo: document.body,
      props: { message: "", sequence: 0 },
    });
    cleanup.push(() => w.unmount());

    const animateSpy = vi.spyOn(motionEngine, "animate");
    await w.setProps({ message: "Draft tersimpan", sequence: 1 });
    await flushPromises();

    const toastEl = w.get(".toast").element;
    toastEl.getBoundingClientRect = () => ({ left: 80, top: 66, width: 220, height: 42 });
    const enterCall = animateSpy.mock.calls.find(([el]) => el === toastEl);
    expect(enterCall).toBeTruthy();
    expect(enterCall[2].from.y).not.toBe(tokens("full").distances.sheet);

    animateSpy.mockClear();
    await w.setProps({ message: "", sequence: 1 });
    await flushPromises();

    const ghost = document.querySelector(".liquid-overlay-ghost");
    expect(ghost).not.toBeNull();
    expect(ghost.classList.contains("is-sheet")).toBe(false);
    expect(ghost.classList.contains("is-toast")).toBe(true);
  });

  it("animates horizontal nav indicator along scaleX and continues mobile drawer close from swipe offset", async () => {
    const animateSpy = vi.spyOn(motionEngine, "animate");
    const indicator = mount(MotionActiveIndicator, {
      attachTo: document.body,
      props: { axis: "horizontal" },
    });
    cleanup.push(() => indicator.unmount());
    await flushPromises();

    const call = animateSpy.mock.calls.find(([el]) => el === indicator.element);
    expect(call).toBeTruthy();
    expect(call[1].scaleX).toBe(1);
    expect(call[2].from.scaleX).toBeDefined();
    expect(call[2].from.scaleY).toBeUndefined();

    const persistentIndicator = mount(MotionActiveIndicator, {
      attachTo: document.body,
      props: { axis: "horizontal", keepVisible: true },
    });
    cleanup.push(() => persistentIndicator.unmount());
    await flushPromises();

    const persistentCall = animateSpy.mock.calls.find(
      ([el]) => el === persistentIndicator.element,
    );
    expect(persistentCall).toBeTruthy();
    expect(persistentCall[1]).toEqual({ scaleX: 1 });
    expect(persistentCall[2].from.opacity).toBeUndefined();
    expect(persistentCall[2].from.scaleX).toBeDefined();

    const media = installMedia();
    const ui = useUiStore();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div/>" } }],
    });
    const sidebar = mount(AppSidebar, {
      attachTo: document.body,
      global: { plugins: [pinia, router] },
    });
    cleanup.push(() => sidebar.unmount());
    await flushPromises();

    const bp = media.filter((m) => m.media === "(max-width: 1023px)").at(-1);
    bp.matches = true;
    bp.fire();
    await flushPromises();

    ui.mobileOpen = true;
    await flushPromises();

    const aside = sidebar.get("aside");
    aside.element.getBoundingClientRect = () => ({ width: 288, left: 0, top: 0, height: 800 });
    animateSpy.mockClear();

    await aside.trigger("touchstart", { touches: [{ clientX: 200, clientY: 100 }] });
    await aside.trigger("touchmove", { touches: [{ clientX: 80, clientY: 100 }] });
    expect(aside.element.style.transform).toContain("-120px");
    await aside.trigger("touchend");
    await flushPromises();

    const exitCall = animateSpy.mock.calls.find(([el]) => el === aside.element);
    expect(exitCall).toBeTruthy();
    expect(exitCall[2].from.x).toBe(-120);
  });

  it("animates progress bar scaleX without duplicating static inline scaleX in base transform", async () => {
    const ratio = ref(0.5);
    const Comp = {
      template: '<div class="lms-progress-fill" ref="bar"></div>',
      setup() {
        const bar = ref(null);
        useProgressBarMotion(bar, ratio);
        return { bar };
      },
    };
    const w = mount(Comp, { attachTo: document.body });
    cleanup.push(() => w.unmount());
    await flushPromises();

    const barEl = w.get(".lms-progress-fill").element;
    expect(barEl.style.transform).toBe("scaleX(0.5)");

    ratio.value = 0.8;
    await flushPromises();

    // Base inline transform was cleared prior to retain:true motion, never "scaleX(0.8) translate3d(...) scale(0.8, 1)"
    expect(barEl.style.transform.startsWith("scaleX(")).toBe(false);
  });
});
