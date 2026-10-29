import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { installPageTransitions } from "../../src/motion/pages.js";
import { transitionRoute } from "../../src/motion/route.js";
import { createMotionEngine, motionEngine } from "../../src/motion/engine.js";
import PageAtmosphere from "../../src/components/motion/PageAtmosphere.vue";
import {
  tokens,
  clock,
  element,
  installMedia,
  installTokenStyles,
} from "./motion-fixture.js";
let cleanups;
beforeEach(() => {
  cleanups = [];
  installMedia();
  installTokenStyles();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});
afterEach(() => {
  cleanups.forEach((fn) => fn());
  motionEngine.dispose();
  document.body.innerHTML = "";
  delete document.documentElement.dataset.liquidRoute;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function setup(transition = vi.fn(() => new Promise(() => {}))) {
  const scene = element(),
    shell = element("main");
  shell.tabIndex = -1;
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/one", component: {} },
      { path: "/two", component: {} },
      { path: "/attempt/:id", component: {}, meta: { exam: true } },
      { path: "/motion-lab", component: {} },
    ],
  });
  const api = installPageTransitions(router, {
    getTarget: () => scene,
    nextRender: () => Promise.resolve(),
    transition,
  });
  cleanups.push(() => api.dispose());
  return { scene, shell, router, api, transition };
}
describe("phase 9 post-confirmation page enhancement", () => {
  it("never waits for animation to resolve navigation and skips initial/query-only updates", async () => {
    const { router, scene, transition } = await setup();
    await router.push("/one");
    expect(transition).not.toHaveBeenCalled();
    await router.push("/two");
    expect(router.currentRoute.value.path).toBe("/two");
    expect(transition).toHaveBeenCalledTimes(1);
    expect(scene.hasAttribute("data-liquid-page-motion")).toBe(true);
    await router.push("/two?q=test");
    expect(transition).toHaveBeenCalledTimes(1);
    expect(scene.hasAttribute("data-liquid-page-motion")).toBe(false);
  });
  it("aborts rapid navigation and user input while shell focus does not cancel", async () => {
    const { router, scene, shell, transition } = await setup();
    await router.push("/one");
    await router.push("/two");
    const first = transition.mock.calls[0][1].signal;
    shell.focus();
    expect(first.aborted).toBe(false);
    const input = document.createElement("input");
    scene.append(input);
    input.focus();
    expect(first.aborted).toBe(true);
    await router.push("/one");
    const second = transition.mock.calls.at(-1)[1].signal;
    await router.push("/two");
    expect(second.aborted).toBe(true);
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
    );
    expect(scene.hasAttribute("data-liquid-page-motion")).toBe(false);
  });
  it("skips exam boundaries, local lab, failed navigation and detached targets", async () => {
    const { router, scene, transition } = await setup();
    await router.push("/one");
    await router.push("/attempt/a");
    await router.push("/two");
    await router.push("/motion-lab");
    await router.push("/one");
    expect(transition).not.toHaveBeenCalled();
    router.beforeEach((to) => (to.path === "/two" ? false : undefined));
    await router.push("/two");
    expect(transition).not.toHaveBeenCalled();
    scene.remove();
    await router.push("/one?q=1");
    expect(transition).not.toHaveBeenCalled();
  });
  it("animation errors do not roll back confirmed paths, and disposal removes hooks", async () => {
    const transition = vi.fn(() => Promise.reject(new Error("No snapshot")));
    const { router, scene, api } = await setup(transition);
    await router.push("/one");
    await router.push("/two");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/two");
    expect(scene.hasAttribute("data-liquid-page-motion")).toBe(false);
    api.dispose();
    await router.push("/one");
    expect(transition).toHaveBeenCalledTimes(1);
  });
  it.each(["reduced", "off"])(
    "uses %s fallback policy without changing route focus or waiting for motion",
    async (mode) => {
      const c = clock(),
        engine = createMotionEngine({ ...c, getTokens: () => tokens(mode) });
      const { router, scene } = await setup((update, options) =>
        transitionRoute(update, { ...options, native: false, engine }),
      );
      scene.dataset.motion = mode;
      await router.push("/one");
      await router.push("/two");
      await flushPromises();
      c.step();
      expect(scene.style.transform).toBe("");
      c.flush();
      await flushPromises();
      expect(scene.style.willChange).toBe("");
      expect(scene.hasAttribute("data-liquid-page-motion")).toBe(false);
    },
  );
  it("does not restart a stale fallback after cancellation while DOM patch is pending", async () => {
    const target = element(),
      c = clock(),
      engine = createMotionEngine({ ...c, getTokens: () => tokens() }),
      controller = new AbortController();
    let finish;
    const update = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    const result = transitionRoute(update, {
      target,
      native: false,
      signal: controller.signal,
      engine,
    });
    await Promise.resolve();
    controller.abort();
    finish();
    await expect(result).resolves.toEqual({ mode: "cancelled" });
    expect(update).toHaveBeenCalledTimes(1);
    expect(c.pending()).toBe(0);
    expect(document.documentElement.hasAttribute("data-liquid-route")).toBe(
      false,
    );
  });
  it("keeps atmosphere decorative, drops the filter on reduced policy and cleans its children", async () => {
    const root = element();
    root.dataset.motion = "reduced";
    const w = mount(PageAtmosphere, { attachTo: root });
    await flushPromises();
    expect(w.get(".page-atmosphere").attributes("aria-hidden")).toBe("true");
    expect(w.get(".page-atmosphere").attributes("inert")).toBeDefined();
    expect(w.get("[data-gooey]").attributes("data-gooey")).toBe("off");
    expect(w.get(".liquid-goo-layer").attributes("style")).toContain(
      "filter: none",
    );
    w.unmount();
    expect(motionEngine.stats().active).toBe(0);
  });
});
