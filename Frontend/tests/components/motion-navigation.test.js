import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import {
  createNavigationScope,
  createNavigationLayout,
  createSidebarMotion,
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
  it("does not move the shell content while a page transition owns it", () => {
    const root = element(), c = clock();
    root.innerHTML = '<main><div data-liquid-page-motion></div></main>';
    const content = root.firstChild;
    let left = 0;
    content.getBoundingClientRect = () => ({ left, top: 0, width: 300, height: 200 });
    const engine = createMotionEngine({ ...c, getTokens: () => tokens() });
    const animate = vi.spyOn(engine, 'animate');
    const layout = createNavigationLayout(root, { engine });
    cleanup.push(() => layout.dispose());
    layout.capture([content]);
    left = 100;
    layout.play([content]);
    expect(animate).not.toHaveBeenCalled();
    root.querySelector('[data-liquid-page-motion]').removeAttribute('data-liquid-page-motion');
    layout.capture([content]);
    left = 200;
    content.firstChild.setAttribute('data-liquid-page-motion', '');
    layout.play([content]);
    expect(animate).not.toHaveBeenCalled();
  });
  it("releases the mobile drawer on Escape and direct navigation without stale open focus", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const ui = useUiStore();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/dashboard", component: { template: "<div/>" } },
        { path: "/assessments/:status", component: { template: "<div/>" } },
        { path: "/:pathMatch(.*)*", component: { template: "<div/>" } },
      ],
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
    ui.mobileOpen = true;
    await flushPromises();
    await w.get('[aria-label="Assessment"]').trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/assessments/all");
    expect(ui.mobileOpen).toBe(false);
    expect(w.get("aside").attributes("inert")).toBeDefined();
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
  it("keeps the compact Assessment destination current across filters and navigates directly", async () => {
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
    const link = w.get('[aria-label="Assessment"]');
    expect(link.attributes("aria-current")).toBe("page");
    expect(link.attributes("aria-expanded")).toBeUndefined();
    expect(link.get('[role="tooltip"]').text()).toBe("Assessment");
    await w.get('[aria-label="Assessment"]').trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/assessments/all");
    expect(w.find(".nav-popover").exists()).toBe(false);
    expect(w.get('[aria-label="Assessment"]').attributes("aria-current")).toBe("page");
  });
  it("anchors the desktop collapse button inside .brand-row and prevents stale tooltip overlap", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/dashboard", component: { template: "<div/>" } },
      ],
    });
    await router.push("/dashboard");
    const w = mount(AppSidebar, {
      attachTo: document.body,
      global: { plugins: [pinia, router] },
    });
    cleanup.push(() => w.unmount());
    await flushPromises();

    const headerToggle = w.get(".brand-row > .collapse-control");
    expect(w.find(".brand-row > .sidebar-close").exists()).toBe(false);
    expect(headerToggle.attributes("aria-label")).toBe("Tutup navigasi");
    expect(headerToggle.attributes("aria-expanded")).toBe("true");
    expect(headerToggle.find('[role="tooltip"]').exists()).toBe(false);

    await headerToggle.trigger("click");
    await flushPromises();
    expect(headerToggle.attributes("aria-label")).toBe("Lebarkan navigasi");
    expect(headerToggle.attributes("aria-expanded")).toBe("false");
    expect(headerToggle.get('[role="tooltip"]').text()).toBe("Lebarkan navigasi");

    const { link, tip, root } = scope();
    link.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(tip.hasAttribute("data-liquid-visible")).toBe(true);
    link.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(tip.hasAttribute("data-liquid-visible")).toBe(false);

    root.setAttribute("data-sidebar-animating", "");
    link.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(tip.hasAttribute("data-liquid-visible")).toBe(false);
  });
  it("synchronizes sidebar track width and toggle button smoothly, reverses mid-flight, and reads zero styles in RAF", () => {
    const root = element();
    root.innerHTML =
      '<aside id="sidebar"><div class="brand-row"><a class="brand"><img alt="logo" /></a><button class="collapse-control"></button></div></aside><main id="main-content"></main>';
    const sidebar = root.querySelector("#sidebar"),
      collapseBtn = root.querySelector(".collapse-control"),
      brandImg = root.querySelector(".brand img"),
      content = root.querySelector("#main-content");
    let collapsed = false;
    sidebar.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: collapsed ? 80 : 264,
      height: 720,
    });
    collapseBtn.getBoundingClientRect = () => ({
      left: collapsed ? 21 : 210,
      top: collapsed ? 70 : 29,
      width: 38,
      height: 38,
    });
    brandImg.getBoundingClientRect = () => ({
      left: 20,
      top: collapsed ? 20 : 28,
      width: 40,
      height: 40,
    });

    const c = clock(),
      engine = createMotionEngine({ ...c, getTokens: () => tokens() }),
      motion = createSidebarMotion(root, { engine, ...c });
    cleanup.push(() => motion.dispose());

    motion.capture();
    collapsed = true;
    motion.play(true);

    expect(sidebar.hasAttribute("data-sidebar-animating")).toBe(true);
    expect(root.style.getPropertyValue("--sidebar-width")).toBe("264px");
    expect(content.style.transform).toBe("");

    const styleSpy = vi.spyOn(window, "getComputedStyle");
    const rectSpy = vi.spyOn(sidebar, "getBoundingClientRect");
    styleSpy.mockClear();
    rectSpy.mockClear();

    c.step(68);
    expect(styleSpy).not.toHaveBeenCalled();
    expect(rectSpy).not.toHaveBeenCalled();

    const midWidth = Number.parseFloat(
      root.style.getPropertyValue("--sidebar-width"),
    );
    expect(midWidth).toBeLessThan(264);
    expect(midWidth).toBeGreaterThan(80);
    expect(collapseBtn.style.transform).toContain("translate3d");

    rectSpy.mockRestore();

    motion.capture();
    collapsed = false;
    motion.play(false);
    expect(
      Number.parseFloat(root.style.getPropertyValue("--sidebar-width")),
    ).toBeCloseTo(midWidth, 1);
    expect(root.style.getPropertyValue("--sidebar-copy-opacity")).toBe("0");

    c.flush();
    expect(c.pending()).toBe(0);
    expect(engine.stats().active).toBe(0);
    expect(sidebar.hasAttribute("data-sidebar-animating")).toBe(false);
    expect(root.style.getPropertyValue("--sidebar-width")).toBe("");
    expect(root.style.getPropertyValue("--sidebar-copy-opacity")).toBe("");
    expect(collapseBtn.style.transform).toBe("");
    expect(content.style.transform).toBe("");
  });
  it.each(["reduced", "off"])(
    "honors %s motion policy in createSidebarMotion without spatial width springs",
    (mode) => {
      const root = element();
      root.dataset.motion = mode;
      root.innerHTML =
        '<aside id="sidebar"><div class="brand-row"><a class="brand"><img alt="logo" /></a><button class="collapse-control"></button></div></aside><main id="main-content"></main>';
      const sidebar = root.querySelector("#sidebar"),
        collapseBtn = root.querySelector(".collapse-control");
      let collapsed = true;
      sidebar.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: collapsed ? 80 : 264,
        height: 720,
      });
      collapseBtn.getBoundingClientRect = () => ({
        left: collapsed ? 21 : 210,
        top: collapsed ? 70 : 29,
        width: 38,
        height: 38,
      });
      const c = clock(),
        engine = createMotionEngine({ ...c, getTokens: () => tokens(mode) }),
        motion = createSidebarMotion(root, { engine, ...c });
      cleanup.push(() => motion.dispose());

      motion.capture();
      collapsed = false;
      motion.play(false);

      expect(root.style.getPropertyValue("--sidebar-width")).toBe("");
      expect(collapseBtn.style.transform).toBe("");
      if (mode === "off") {
        expect(c.pending()).toBe(0);
      } else {
        expect(root.style.getPropertyValue("--sidebar-copy-opacity")).toBe("0");
        c.flush();
        expect(root.style.getPropertyValue("--sidebar-copy-opacity")).toBe("");
      }
    },
  );
});
