import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, ref } from "vue";
import { createAtomMotionScope } from "../../src/motion/atoms.js";
import { createMotionEngine } from "../../src/motion/engine.js";
import MotionField from "../../src/components/motion/MotionField.vue";
import {
  tokens,
  clock,
  element,
  installMedia,
  installTokenStyles,
} from "./motion-fixture.js";

let media, scopes, wrappers;
beforeEach(() => {
  media = installMedia();
  installTokenStyles();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  scopes = [];
  wrappers = [];
});
afterEach(() => {
  scopes.forEach((s) => s.dispose());
  wrappers.forEach((w) => w.unmount());
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup(html = "", mode = "full") {
  const c = clock(),
    root = element();
  root.innerHTML = html;
  if (mode !== "full") root.dataset.motion = mode;
  const engine = createMotionEngine({ ...c, getTokens: () => tokens(mode) });
  const scope = createAtomMotionScope(root, { engine });
  scopes.push(scope);
  return { root, c, engine, scope };
}
const pointer = (el, name, props = {}) =>
  el.dispatchEvent(
    new MouseEvent(name, { bubbles: true, button: 0, ...props }),
  );
describe("phase 4 shared interactive atoms", () => {
  it("cancels focus effects when hidden or opted out during an active interaction", async () => {
    const { root, c, engine } = setup(
      '<span class="liquid-field"><input><span class="liquid-focus-ring" style="opacity:0"></span></span>',
    );
    const input = root.querySelector("input"),
      ring = root.querySelector(".liquid-focus-ring");
    input.focus();
    c.step();
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    expect(engine.stats().active).toBe(0);
    expect(ring.style.willChange).toBe("");
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    root.dataset.motion = "off";
    await flushPromises();
    expect(ring.style.opacity).toBe("0");
    expect(c.pending()).toBe(0);
  });
  it("keeps buttons stationary through hover and cursor movement, with no layout reads/RAF", () => {
    const { root, c, engine } = setup('<button class="btn">Save</button>');
    const button = root.firstChild;
    const rect = vi.spyOn(button, "getBoundingClientRect");
    pointer(button, "pointerover");
    for (const clientX of [0, 10, 90, 100])
      pointer(button, "pointermove", { clientX, clientY: 20 });
    pointer(button, "pointerout");
    expect(button.style.transform).toBe("");
    expect(rect).not.toHaveBeenCalled();
    expect(engine.stats().active).toBe(0);
    expect(c.pending()).toBe(0);
  });
  it("presses dynamically added buttons and releases outside, without gating click", async () => {
    const { root, c, engine } = setup();
    const button = document.createElement("button");
    button.className = "btn";
    root.append(button);
    const click = vi.fn();
    button.addEventListener("click", click);
    pointer(button, "pointerdown");
    c.step();
    expect(button.style.transform).toContain("scale(");
    button.click();
    expect(click).toHaveBeenCalledTimes(1);
    pointer(window, "pointerup");
    c.flush();
    await flushPromises();
    expect(button.style.transform).toBe("");
    expect(button.style.willChange).toBe("");
    expect(root.querySelector(".liquid-ripple")).toBeNull();
    expect(engine.stats().active).toBe(0);
  });
  it("retains form submission, input editing, select values and checkbox semantics with field wrappers", async () => {
    const Form = defineComponent({
      components: { MotionField },
      setup() {
        return {
          text: ref(""),
          course: ref("A"),
          accepted: ref(false),
          submitted: ref(0),
        };
      },
      template: `<form @submit.prevent="submitted++">
        <label>Name<MotionField><input class="input" v-model="text" required name="name"></MotionField></label>
        <MotionField><select v-model="course" name="course"><option>A</option><option>B</option></select></MotionField>
        <label><input type="checkbox" v-model="accepted" name="accepted">Accept</label>
        <button class="btn">Submit</button><output>{{ submitted }}</output></form>`,
    });
    const w = mount(Form, { attachTo: document.body });
    wrappers.push(w);
    const c = clock(),
      engine = createMotionEngine({ ...c, getTokens: () => tokens() });
    scopes.push(createAtomMotionScope(w.element, { engine }));
    await w.get("input[name=name]").setValue("Draft untouched");
    await w.get("select").setValue("B");
    await w.get("input[type=checkbox]").setValue(true);
    pointer(w.get("button").element, "pointerdown");
    // The real default button click still dispatches submit immediately.
    w.get("button").element.click();
    await flushPromises();
    expect(w.vm.submitted).toBe(1);
    expect(w.vm.text).toBe("Draft untouched");
    expect(w.vm.course).toBe("B");
    expect(w.vm.accepted).toBe(true);
    expect(w.get("input").element.closest("label").textContent).toBe("Name");
    expect(
      w
        .findAll(".liquid-focus-ring")
        .every((r) => r.attributes("aria-hidden") === "true"),
    ).toBe(true);
  });
  it("fades only the decorative focus ring, leaving the input and caret stationary", () => {
    const { root, c, scope } = setup(
      '<label><span class="liquid-field"><input class="input"><span class="liquid-focus-ring" style="opacity:0" aria-hidden="true"></span></span></label>',
    );
    const input = root.querySelector("input"),
      ring = root.querySelector(".liquid-focus-ring");
    input.focus();
    c.flush();
    expect(ring.style.opacity).toBe("1");
    expect(input.style.cssText).toBe("");
    expect(ring.style.transform).toBe("");
    input.blur();
    c.flush();
    expect(ring.style.opacity).toBe("0");
    scope.dispose();
    expect(ring.style.opacity).toBe("0");
  });
  it("does not animate disabled atoms, navigation, or the locally scoped Lab twice", () => {
    const { root, engine } = setup(
      '<button disabled class="btn">Disabled</button><button aria-disabled="true" class="btn">Busy</button><nav><button class="btn">Nav</button></nav><div data-liquid-scope="local"><button class="btn">Lab</button></div>',
    );
    for (const button of root.querySelectorAll("button"))
      pointer(button, "pointerdown");
    expect(engine.stats().active).toBe(0);
    expect(root.querySelector(".liquid-ripple")).toBeNull();
  });
  it("uses opacity alone for text links and leaves Space and default navigation untouched", () => {
    const { root, c } = setup('<a href="#target">Read more</a>');
    const link = root.firstChild;
    const space = new KeyboardEvent("keydown", { bubbles: true, key: " " });
    link.dispatchEvent(space);
    expect(c.pending()).toBe(0);
    const enter = new KeyboardEvent("keydown", { bubbles: true, key: "Enter" });
    link.dispatchEvent(enter);
    c.step();
    expect(enter.defaultPrevented).toBe(false);
    expect(link.getAttribute("href")).toBe("#target");
    expect(link.style.transform).toBe("");
    expect(Number(link.style.opacity)).toBeLessThan(1);
    expect(link.querySelector(".liquid-ripple")).toBeNull();
  });
  it.each(["reduced", "off"])(
    "respects %s motion without blocking actions",
    async (mode) => {
      const { root, c, engine } = setup(
        '<button class="btn">Try</button>',
        mode,
      );
      const button = root.firstChild,
        click = vi.fn();
      button.addEventListener("click", click);
      pointer(button, "pointerdown");
      c.step();
      expect(button.style.transform).toBe("");
      expect(
        button.querySelector(".liquid-ripple")?.style.transform || "",
      ).toBe("");
      button.click();
      pointer(window, "pointerup");
      c.flush();
      await flushPromises();
      expect(click).toHaveBeenCalledTimes(1);
      expect(engine.stats().active).toBe(0);
      expect(root.querySelector(".liquid-ripple")).toBeNull();
    },
  );
  it("cancels removed or newly disabled controls and cleans up observers/listeners", async () => {
    const { root, c, engine, scope } = setup(
      '<button class="btn">Try</button>',
    );
    const button = root.firstChild;
    pointer(button, "pointerdown");
    c.step();
    button.disabled = true;
    await flushPromises();
    expect(button.style.transform).toBe("");
    button.remove();
    await flushPromises();
    c.flush();
    await flushPromises();
    expect(engine.stats().active).toBe(0);
    scope.dispose();
    expect(root.hasAttribute("data-liquid-atoms")).toBe(false);
    expect(media.every((m) => m.listeners.size === 0)).toBe(true);
    expect(c.pending()).toBe(0);
  });
});
