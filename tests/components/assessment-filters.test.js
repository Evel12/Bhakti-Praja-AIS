import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import App from "../../src/App.vue";
import appRouter from "../../src/router/index.js";
import { motionEngine } from "../../src/motion/engine.js";
import { installMedia, installTokenStyles } from "./motion-fixture.js";

let wrapper;
beforeEach(() => {
  localStorage.clear();
  installMedia();
  installTokenStyles();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});
afterEach(() => {
  wrapper?.unmount();
  motionEngine.dispose();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("preserves the assessment page, search and focus while fading only results on status changes", async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: appRouter.options.routes,
  });
  await router.push("/assessments/all");
  const host = document.createElement("div");
  host.id = "app";
  document.body.append(host);
  wrapper = mount(App, {
    attachTo: host,
    global: { plugins: [createPinia(), router], stubs: { AppDialog: true } },
  });
  await flushPromises();
  expect(wrapper.findAll('#sidebar [aria-label="Assessment"]')).toHaveLength(1);
  expect(wrapper.find("#assessment-submenu").exists()).toBe(false);
  expect(wrapper.findAll(".tab")).toHaveLength(5);
  const panel = wrapper.get(".panel").element;
  const title = wrapper.get(".page-title").element;
  const results = wrapper.get(".assessment-results").element;
  await wrapper.get('[aria-label="Cari assessment"]').setValue("no matching assessment");
  const draftTab = wrapper.findAll(".tab").find((tab) => tab.text() === "Draft");
  draftTab.element.focus();
  const animate = vi.spyOn(motionEngine, "animate");
  await draftTab.trigger("click");
  await flushPromises();
  expect(router.currentRoute.value.path).toBe("/assessments/Draft");
  expect(wrapper.get(".panel").element).toBe(panel);
  expect(wrapper.get(".page-title").element).toBe(title);
  expect(wrapper.get(".assessment-results").element).toBe(results);
  expect(wrapper.get('[aria-label="Cari assessment"]').element.value).toBe("no matching assessment");
  expect(document.activeElement).toBe(draftTab.element);
  expect(wrapper.get(".assessment-results .empty").exists()).toBe(true);
  expect(animate.mock.calls.some(([target, to, options]) =>
    target === results && to.opacity === 1 && options.from.opacity === 0,
  )).toBe(true);
  expect(animate.mock.calls.some(([target]) =>
    [panel, title, wrapper.get("#route-scene").element].includes(target),
  )).toBe(false);
  await router.push("/assessments/Aktif");
  await flushPromises();
  expect(wrapper.get(".assessment-results").element).toBe(results);
  expect(document.querySelector(".liquid-exit-ghost")).toBeNull();
});
