import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia, disposePinia } from "pinia";
import { createOverlayMotion } from "../../src/motion/overlays.js";
import { createMotionEngine, motionEngine } from "../../src/motion/engine.js";
import AppDialog from "../../src/components/ui/AppDialog.vue";
import AppToast from "../../src/components/ui/AppToast.vue";
import { useUiStore } from "../../src/stores/uiStore.js";
import {
  tokens,
  clock,
  element,
  installMedia,
  installTokenStyles,
} from "./motion-fixture.js";
let cleanup, wrappers, media;
beforeEach(() => {
  cleanup = [];
  wrappers = [];
  media = installMedia();
  installTokenStyles();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
    this.querySelector("button")?.focus();
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => {
  wrappers.forEach((w) => w.unmount());
  cleanup.forEach((fn) => fn());
  motionEngine.dispose();
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup(mode = "full") {
  const root = element(),
    el = document.createElement("div"),
    c = clock();
  root.dataset.motion = mode;
  root.append(el);
  el.className = "dialog-surface";
  el.innerHTML =
    '<h2 id="title">Example</h2><input id="value" name="answer"><button autofocus aria-labelledby="title">Close</button>';
  el.getBoundingClientRect = () => ({
    left: 10,
    top: 20,
    width: 200,
    height: 100,
  });
  const engine = createMotionEngine({ ...c, getTokens: () => tokens(mode) });
  const motion = createOverlayMotion(root, { engine });
  cleanup.push(() => motion.dispose());
  return { root, el, c, engine, motion };
}
describe("phase 6 overlay lifecycle", () => {
  it("exits with an inert ID-free snapshot and preserves unsaved values without delaying removal", async () => {
    const { el, c, motion, engine } = setup();
    el.querySelector("input").value = "unsaved";
    motion.exit(el);
    el.remove();
    const ghost = document.querySelector(".liquid-overlay-ghost");
    expect(ghost.hasAttribute("inert")).toBe(true);
    expect(ghost.getAttribute("aria-hidden")).toBe("true");
    expect(
      ghost.querySelector("[id],[name],[autofocus],[aria-labelledby]"),
    ).toBeNull();
    expect(ghost.querySelector("input").value).toBe("unsaved");
    expect(ghost.querySelector("button").tabIndex).toBe(-1);
    c.flush();
    await flushPromises();
    expect(ghost.isConnected).toBe(false);
    expect(engine.stats().active).toBe(0);
  });
  it("uses only opacity for reduced enter and exit and skips off", async () => {
    const { el, c, motion } = setup("reduced");
    motion.enter(el);
    c.step();
    expect(el.style.transform).toBe("");
    expect(el.style.opacity).not.toBe("");
    motion.exit(el);
    c.step();
    expect(
      document.querySelector(".liquid-overlay-ghost").style.transform,
    ).toBe("");
    c.flush();
    await flushPromises();
    const off = setup("off");
    off.motion.enter(off.el);
    off.motion.exit(off.el);
    expect(off.c.pending()).toBe(0);
    expect(document.querySelector(".liquid-overlay-ghost")).toBeNull();
  });
  it("cancels on interaction, scroll, policy, re-open and disposal without leaked layers", async () => {
    const { el, c, motion, root } = setup();
    motion.enter(el);
    el.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }),
    );
    expect(c.pending()).toBe(0);
    motion.exit(el);
    motion.enter(el);
    expect(document.querySelector(".liquid-overlay-ghost")).toBeNull();
    motion.exit(el);
    window.dispatchEvent(new Event("scroll"));
    expect(document.querySelector(".liquid-overlay-ghost")).toBeNull();
    motion.exit(el);
    root.dataset.motion = "off";
    await flushPromises();
    expect(document.querySelector(".liquid-overlay-ghost")).toBeNull();
    root.dataset.motion = "full";
    await flushPromises();
    motion.exit(el);
    motion.dispose();
    expect(c.pending()).toBe(0);
    expect(document.querySelector(".liquid-overlay-ghost")).toBeNull();
    expect(media.every((m) => m.listeners.size === 0)).toBe(true);
  });
  it("does not start hidden or over-budget exit animations", () => {
    const { el, motion, engine, c } = setup();
    const release = engine.reserve(tokens().limits.maxConcurrent, tokens());
    motion.exit(el);
    expect(document.querySelector(".liquid-overlay-ghost")).toBeNull();
    release();
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    motion.enter(el);
    motion.exit(el);
    expect(c.pending()).toBe(0);
  });
  it("opens natively, labels each dialog uniquely, closes immediately and restores the opener", async () => {
    const opener = element("button");
    opener.focus();
    const w = mount(
      {
        components: { AppDialog },
        props: ["open"],
        template: `<AppDialog :open="open" title="First" @close="$emit('close')" /><AppDialog title="Second" />`,
      },
      { attachTo: document.body, props: { open: false } },
    );
    wrappers.push(w);
    await w.setProps({ open: true });
    await flushPromises();
    const dialog = w.get("dialog").element;
    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute("aria-labelledby")).not.toBe(
      w.findAll("dialog")[1].attributes("aria-labelledby"),
    );
    await w.get("dialog").trigger("cancel");
    expect(w.emitted("close")).toHaveLength(1);
    await w.setProps({ open: false });
    await flushPromises();
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(opener);
  });
  it("does not reopen after unmount or a superseding close", async () => {
    const w = mount(AppDialog, {
      attachTo: document.body,
      props: { open: true },
    });
    wrappers.push(w);
    await w.setProps({ open: false });
    await flushPromises();
    expect(w.get("dialog").element.open).toBe(false);
    const show = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    const x = mount(AppDialog, { props: { open: true } });
    x.unmount();
    await flushPromises();
    expect(show).not.toHaveBeenCalled();
  });
  it("keeps a stable live region, updates repeated messages and returns toast keyboard focus", async () => {
    const opener = element("button");
    opener.focus();
    const w = mount(AppToast, {
      attachTo: document.body,
      props: { message: "", sequence: 0 },
    });
    wrappers.push(w);
    const live = w.get("[role=status]").element;
    await w.setProps({ message: "Saved", sequence: 1 });
    await flushPromises();
    expect(live.textContent).toBe("Saved");
    const close = w.get("button");
    close.element.focus();
    expect(w.emitted("pause")).toBeTruthy();
    await close.trigger("click");
    expect(w.emitted("dismiss")).toHaveLength(1);
    expect(document.activeElement).toBe(opener);
    await w.setProps({ message: "", sequence: 1 });
    await flushPromises();
    expect(w.find(".toast").exists()).toBe(false);
    expect(w.get("[role=status]").element).toBe(live);
    await w.setProps({ message: "Saved", sequence: 2 });
    await flushPromises();
    expect(live.textContent).toBe("Saved");
  });
  it("pauses notification expiry and clears replaced timers and store timers on disposal", () => {
    vi.useFakeTimers();
    const pinia = createPinia();
    setActivePinia(pinia);
    const ui = useUiStore();
    ui.toast("One");
    vi.advanceTimersByTime(4000);
    ui.pauseToast();
    vi.advanceTimersByTime(9000);
    expect(ui.message).toBe("One");
    ui.resumeToast();
    vi.advanceTimersByTime(4000);
    ui.toast("Two", true);
    vi.advanceTimersByTime(2000);
    expect(ui.message).toBe("Two");
    expect(ui.toastSequence).toBe(2);
    ui.dismissToast();
    expect(vi.getTimerCount()).toBe(0);
    ui.toast("Three");
    disposePinia(pinia);
    expect(vi.getTimerCount()).toBe(0);
  });
});
