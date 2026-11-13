import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import RoleSwitcher from "../../src/components/navigation/RoleSwitcher.vue";
import { motionEngine } from "../../src/motion/engine.js";
import { installMedia, installTokenStyles } from "./motion-fixture.js";

let wrapper;
beforeEach(() => {
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
async function setup(path = "/assessments/all") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/dashboard", component: {} },
      { path: "/assessments/:status", component: {} },
      { path: "/student", component: {}, meta: { student: true } },
    ],
  });
  await router.push(path);
  wrapper = mount(RoleSwitcher, { attachTo: document.body, global: { plugins: [router] } });
  return router;
}
const trigger = () => wrapper.get(".role-picker-trigger");
const options = () => wrapper.findAll('[role="menuitemradio"]');

describe("role dropdown navigation", () => {
  it("opens the current role, lets arrow keys explore without navigation, and restores focus with Escape", async () => {
    const router = await setup();
    await trigger().trigger("keydown", { key: "ArrowDown" });
    await flushPromises();
    expect(trigger().attributes("aria-expanded")).toBe("true");
    expect(options()[0].attributes("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(options()[0].element);
    await options()[0].trigger("keydown", { key: "ArrowDown" });
    await flushPromises();
    expect(document.activeElement).toBe(options()[1].element);
    expect(router.currentRoute.value.path).toBe("/assessments/all");
    expect(options()[1].attributes("aria-checked")).toBe("false");
    await options()[1].trigger("keydown", { key: "Home" });
    await flushPromises();
    expect(document.activeElement).toBe(options()[0].element);
    await options()[0].trigger("keydown", { key: "End" });
    await flushPromises();
    expect(document.activeElement).toBe(options()[1].element);
    await options()[1].trigger("keydown", { key: "Escape" });
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    expect(document.activeElement).toBe(trigger().element);
  });

  it("switches roles in both directions and selecting the current role preserves the current page", async () => {
    const router = await setup();
    await trigger().trigger("click");
    await options()[0].trigger("click");
    expect(router.currentRoute.value.path).toBe("/assessments/all");
    await trigger().trigger("click");
    await options()[1].trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/student");
    expect(trigger().text()).toBe("Peserta");
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    await trigger().trigger("click");
    await flushPromises();
    expect(options()[1].attributes("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(options()[1].element);
    await options()[0].trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/dashboard");
    expect(trigger().text()).toBe("Pengajar");
  });

  it("dismisses on outside click, Tab, focus leaving and route changes without changing the selected role", async () => {
    const router = await setup();
    await trigger().trigger("click");
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await flushPromises();
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    await trigger().trigger("click");
    await options()[0].trigger("keydown", { key: "Tab" });
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    await trigger().trigger("click");
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    await flushPromises();
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    expect(document.activeElement).toBe(outside);
    expect(router.currentRoute.value.path).toBe("/assessments/all");
    await trigger().trigger("click");
    await router.push("/dashboard");
    await flushPromises();
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });

  it("limits fade to the menu, respects motion off, and cleans up when removed", async () => {
    await setup();
    const animate = vi.spyOn(motionEngine, "animate");
    await trigger().trigger("click");
    await flushPromises();
    expect(animate).toHaveBeenCalledWith(wrapper.get('[role="menu"]').element, { opacity: 1 }, expect.objectContaining({ from: { opacity: 0 } }));
    await trigger().trigger("keydown", { key: "Escape" });
    wrapper.element.dataset.motion = "off";
    await flushPromises();
    animate.mockClear();
    await trigger().trigger("click");
    await flushPromises();
    expect(animate).not.toHaveBeenCalled();
    expect(options()[0].isVisible()).toBe(true);
    wrapper.unmount();
    wrapper = undefined;
    expect(motionEngine.stats().active).toBe(0);
  });
});
