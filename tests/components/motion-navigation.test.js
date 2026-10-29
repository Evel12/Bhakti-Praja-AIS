import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import {
  createNavigationScope,
  createNavigationLayout,
} from "../../src/motion/navigation.js";
import { createMotionEngine, motionEngine } from "../../src/motion/engine.js";
import AppSidebar from "../../src/components/navigation/AppSidebar.vue";
import { useUiStore } from "../../src/stores/uiStore.js";
import {
  tokens,
  clock,
  element,
  installMedia,
  installTokenStyles,
} from "./motion-fixture.js";
let cleanup, media;
beforeEach(() => {
  cleanup = [];
  media = installMedia();
  installTokenStyles();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  localStorage.clear();
});
afterEach(() => {
  cleanup.forEach((fn) => fn());
  motionEngine.dispose();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function scope(mode = "full") {
  const root = element();
  root.dataset.motion = mode;
  root.innerHTML =
    '<nav><a class="tip-parent" href="#bank">Bank<span class="rail-tooltip" role="tooltip">Bank soal</span></a></nav>';
  const c = clock(),
    engine = createMotionEngine({ ...c, getTokens: () => tokens(mode) }),
    nav = createNavigationScope(root, { engine });
  cleanup.push(() => nav.dispose());
  return {
    root,
    c,
    engine,
    nav,
    link: root.querySelector("a"),
    tip: root.querySelector(".rail-tooltip"),
  };
}
describe("phase 7 navigation", () => {
  it("releases the mobile drawer immediately on Escape and prevents stale open focus", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const ui = useUiStore();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/dashboard", component: { template: "<div/>" } }],
    });
    await router.push("/dashboard");
    const opener = element("button");
    opener.id = "menu-trigger";
    const w = mount(AppSidebar, {
      attachTo: document.body,
      global: { plugins: [pinia, router] },
    });
    cleanup.push(() => w.unmount());
    await flushPromises();
    const breakpoint = media
      .filter((m) => m.media === "(max-width: 1023px)")
      .at(-1);
    breakpoint.matches = true;
    breakpoint.fire();
    await flushPromises();
    ui.mobileOpen = true;
    await flushPromises();
    expect(w.get("aside").attributes("aria-modal")).toBe("true");
    expect(document.body.style.overflow).toBe("hidden");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(ui.mobileOpen).toBe(false);
    expect(w.get("aside").attributes("inert")).toBeDefined();
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(opener);
    ui.mobileOpen = true;
    ui.mobileOpen = false;
    await flushPromises();
    expect(ui.mobileOpen).toBe(false);
    expect(document.activeElement).toBe(opener);
  });
  it("reveals tooltip without moving the link, and Escape dismisses until a new entry", () => {
    const { link, tip, c } = scope();
    link.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    c.step();
    expect(tip.hasAttribute("data-liquid-visible")).toBe(true);
    expect(link.style.transform).toBe("");
    link.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(tip.hasAttribute("data-liquid-visible")).toBe(false);
    expect(c.pending()).toBe(0);
    link.dispatchEvent(new MouseEvent("pointerout", { bubbles: true }));
    link.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(tip.hasAttribute("data-liquid-visible")).toBe(true);
  });
  it("preserves native link navigation and keyboard behavior during press", () => {
    const { link, c } = scope();
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.addEventListener("click", (e) =>
      expect(e.defaultPrevented).toBe(false),
    );
    link.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true }),
    );
    expect(link.style.transform).toBe("");
    expect(c.pending()).toBe(0);
    link.dispatchEvent(event);
    expect(link.getAttribute("href")).toBe("#bank");
  });
  it.each(["reduced", "off"])(
    "respects %s policy and cleans tooltip listeners",
    (mode) => {
      const { link, tip, c, nav } = scope(mode);
      link.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
      c.step();
      expect(tip.style.transform).toBe("");
      nav.dispose();
      expect(tip.hasAttribute("data-liquid-visible")).toBe(false);
      expect(c.pending()).toBe(0);
      link.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      expect(tip.hasAttribute("data-liquid-visible")).toBe(false);
    },
  );
  it("FLIPs only retained unfocused surfaces and cancels immediately on keyboard input", () => {
    const root = element(),
      content = document.createElement("main"),
      focused = document.createElement("button");
    root.append(content, focused);
    focused.focus();
    let moved = false;
    content.getBoundingClientRect = () => ({ left: moved ? 80 : 248, top: 0 });
    focused.getBoundingClientRect = () => ({ left: 0, top: 0 });
    const c = clock(),
      engine = createMotionEngine({ ...c, getTokens: () => tokens() }),
      layout = createNavigationLayout(root, { engine });
    cleanup.push(() => layout.dispose());
    layout.capture([content, focused]);
    moved = true;
    layout.play([content, focused]);
    c.step();
    expect(content.style.transform).toContain("translate3d");
    expect(focused.style.transform).toBe("");
    focused.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
    );
    expect(c.pending()).toBe(0);
    expect(content.style.transform).toBe("");
  });
  it("opens compact submenu, exposes current page, restores trigger on Escape and disposes races", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const ui = useUiStore();
    ui.collapsed = true;
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/assessments/:status", component: { template: "<div/>" } },
      ],
    });
    await router.push("/assessments/Draft");
    const w = mount(AppSidebar, {
      attachTo: document.body,
      global: { plugins: [pinia, router] },
    });
    cleanup.push(() => w.unmount());
    await flushPromises();
    await w.get('[aria-label="Assessment"]').trigger("click");
    await flushPromises();
    expect(w.get('.nav-popover [aria-current="page"]').text()).toBe("Draft");
    w.get(".nav-popover a").element.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(w.find(".nav-popover").exists()).toBe(false);
    expect(document.activeElement).toBe(
      w.get('[aria-label="Assessment"]').element,
    );
  });
});
