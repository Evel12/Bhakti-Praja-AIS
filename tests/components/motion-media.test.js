import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createMediaScope } from "../../src/motion/media.js";
import { createMotionEngine } from "../../src/motion/engine.js";
import AppLoading from "../../src/components/ui/AppLoading.vue";
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
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup(mode = "full", html = "") {
  const root = element();
  root.dataset.motion = mode;
  root.innerHTML = html;
  const c = clock(),
    engine = createMotionEngine({ ...c, getTokens: () => tokens(mode) }),
    scope = createMediaScope(root, { engine });
  cleanups.push(() => scope.dispose());
  return { root, c, engine, scope };
}
function image(root, { src = "/example.png", loaded = true } = {}) {
  const img = document.createElement("img");
  img.src = src;
  img.alt = "Contoh";
  img.width = 100;
  img.height = 80;
  Object.defineProperty(img, "complete", { get: () => loaded });
  Object.defineProperty(img, "naturalWidth", { get: () => (loaded ? 100 : 0) });
  root.append(img);
  return img;
}
describe("phase 8 finite media feedback", () => {
  it("introduces a cached image once without waiting for decode, changing size or hiding alt text", async () => {
    const { root, c, engine } = setup();
    const img = image(root);
    await flushPromises();
    expect(c.pending()).toBe(1);
    expect(img.alt).toBe("Contoh");
    expect(img.width).toBe(100);
    expect(img.height).toBe(80);
    expect(img.style.transform).toBe("");
    img.dispatchEvent(new Event("load"));
    c.flush();
    await flushPromises();
    expect(engine.stats().active).toBe(0);
    expect(img.style.opacity).toBe("");
    expect(img.style.willChange).toBe("");
    img.dispatchEvent(new Event("load"));
    expect(c.pending()).toBe(0);
  });
  it("leaves failed images visible and cancels a removed image animation", async () => {
    const { root, c } = setup();
    const failed = image(root, { loaded: false });
    await flushPromises();
    failed.dispatchEvent(new Event("error"));
    expect(c.pending()).toBe(0);
    expect(failed.style.opacity).toBe("");
    expect(failed.alt).toBe("Contoh");
    const img = image(root);
    await flushPromises();
    img.remove();
    await flushPromises();
    expect(c.pending()).toBe(0);
    expect(img.style.willChange).toBe("");
  });
  it("excludes the institutional logo, active exam images and nested container entrances", async () => {
    const { root, c } = setup(
      "full",
      '<div class="brand"></div><div class="exam-shell"></div><section class="panel"></section>',
    );
    for (const parent of root.children) image(parent);
    await flushPromises();
    expect(c.pending()).toBe(0);
  });
  it("animates changed icon/media keys only, keeping geometry and meaningful SVG labels intact", async () => {
    const { root, c } = setup(
      "full",
      '<svg data-liquid-icon="file" aria-hidden="true"></svg><svg data-media-key="old" role="img" aria-label="Tren nilai"></svg>',
    );
    expect(c.pending()).toBe(0);
    root.children[0].dataset.liquidIcon = "check";
    root.children[1].dataset.mediaKey = "new";
    await flushPromises();
    c.step();
    expect(root.children[0].style.transform).toBe("");
    expect(root.children[1].getAttribute("aria-label")).toBe("Tren nilai");
    c.flush();
    await flushPromises();
    expect(c.pending()).toBe(0);
  });
  it.each(["reduced", "off"])(
    "keeps %s feedback opacity-only and returns to zero idle work",
    async (mode) => {
      const { root, c } = setup(mode);
      const img = image(root);
      await flushPromises();
      c.step();
      expect(img.style.transform).toBe("");
      if (mode === "off") expect(c.pending()).toBe(0);
      c.flush();
      await flushPromises();
      expect(c.pending()).toBe(0);
    },
  );
  it("announces a real pending state with finite dots, then removes it immediately", async () => {
    const { root, c, engine } = setup();
    const w = mount(AppLoading, {
      attachTo: root,
      props: { label: "Menyimpan berkas…" },
    });
    await flushPromises();
    expect(w.get("[role=status]").text()).toBe("Menyimpan berkas…");
    expect(
      w.get("[aria-hidden=true]").findAll("[data-liquid-dot]"),
    ).toHaveLength(3);
    c.flush();
    await flushPromises();
    expect(c.pending()).toBe(0);
    expect(w.text()).toContain("Menyimpan berkas");
    w.unmount();
    await flushPromises();
    expect(root.querySelector("[role=status]")).toBeNull();
    expect(engine.stats().active).toBe(0);
  });
  it("respects the shared animation budget, visibility/policy changes and disposal", async () => {
    const { root, c, engine, scope } = setup();
    const release = engine.reserve(tokens().limits.maxConcurrent, tokens());
    image(root);
    await flushPromises();
    expect(c.pending()).toBe(0);
    release();
    const img = image(root, { src: "/second.png" });
    await flushPromises();
    root.dataset.motion = "off";
    await flushPromises();
    expect(c.pending()).toBe(0);
    expect(img.style.opacity).toBe("");
    scope.dispose();
    image(root, { src: "/third.png" });
    await flushPromises();
    expect(c.pending()).toBe(0);
  });
});
