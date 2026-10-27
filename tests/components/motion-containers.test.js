import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, ref } from "vue";
import { createContainerMotionScope } from "../../src/motion/containers.js";
import { createListMotion } from "../../src/motion/lists.js";
import { animateLayout } from "../../src/motion/layout.js";
import { createMotionEngine } from "../../src/motion/engine.js";
import MotionList from "../../src/components/motion/MotionList.vue";
import {
  tokens,
  clock,
  element,
  installMedia,
  installTokenStyles,
} from "./motion-fixture.js";
let observers, media, disposables, wrappers;
beforeEach(() => {
  observers = [];
  disposables = [];
  wrappers = [];
  media = installMedia();
  installTokenStyles();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb) {
        this.cb = cb;
        this.nodes = new Set();
        observers.push(this);
      }
      observe(el) {
        this.nodes.add(el);
      }
      unobserve(el) {
        this.nodes.delete(el);
      }
      disconnect() {
        this.nodes.clear();
      }
      fire(nodes = [...this.nodes]) {
        this.cb(nodes.map((target) => ({ target, isIntersecting: true })));
      }
    },
  );
});
afterEach(() => {
  wrappers.forEach((w) => w.unmount());
  disposables.forEach((d) => d.dispose());
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup(html, mode = "full") {
  const root = element(),
    c = clock();
  root.innerHTML = html;
  if (mode !== "full") root.dataset.motion = mode;
  const engine = createMotionEngine({ ...c, getTokens: () => tokens(mode) });
  return { root, c, engine };
}
const rect = (left, top, width = 100, height = 80) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});
function cardList(mode) {
  const s = setup(
    '<article class="bank-card" data-motion-key="a" id="old-card"><h3 id="old-title">Old card</h3><a href="#old" aria-labelledby="old-title">Read</a><button id="old-button">Use</button></article><article class="bank-card" data-motion-key="b">B</article><article class="bank-card" data-motion-key="c">C</article>',
    mode,
  );
  let changed = false;
  [...s.root.children].forEach((el, i) => {
    el.getBoundingClientRect = () =>
      rect(changed ? Math.max(0, i - 1) * 120 : i * 120, 20);
  });
  const list = createListMotion(s.root, { engine: s.engine });
  disposables.push(list);
  return {
    ...s,
    list,
    shift: () => {
      changed = true;
    },
  };
}
describe("phase 5 containers and structural lists", () => {
  it("keeps per-item reduced motion for both retained cards and exit snapshots", async () => {
    const { root, c, list, shift } = cardList();
    root.children[0].dataset.motion = "reduced";
    root.children[1].dataset.motion = "reduced";
    const before = list.capture();
    root.firstChild.remove();
    shift();
    list.update(before);
    c.step();
    expect(root.firstChild.style.transform).toBe("");
    expect(document.querySelector(".liquid-exit-ghost").style.transform).toBe(
      "",
    );
    c.flush();
    await flushPromises();
  });
  it("observes new outer panels once, excludes exams/dialogs/Lab/list wrappers, and never pre-hides content", async () => {
    const { root, c, engine } = setup(
      '<section class="panel"><div class="panel">Nested</div></section><dialog><section class="panel">Dialog</section></dialog><div class="exam-shell"><section class="panel">Exam</section></div><div data-liquid-list><article class="bank-card">List</article></div><section class="panel"><div data-liquid-list></div></section><div data-liquid-scope="local"><section class="panel">Lab</section></div>',
    );
    const scope = createContainerMotionScope(root, { engine });
    disposables.push(scope);
    expect(observers[0].nodes.size).toBe(1);
    expect(root.firstChild.style.opacity).toBe("");
    observers[0].fire();
    c.flush();
    const dynamic = document.createElement("section");
    dynamic.className = "panel";
    root.append(dynamic);
    await flushPromises();
    expect(observers[0].nodes.has(dynamic)).toBe(true);
    observers[0].fire([dynamic]);
    c.flush();
    observers[0].fire([dynamic]);
    expect(c.pending()).toBe(0);
    expect(dynamic.style.opacity).toBe("");
  });
  it("shares the global budget and leaves excess containers visible", async () => {
    const { root, c, engine } = setup(
      '<section class="panel">Card</section>'.repeat(12),
    );
    const release = engine.reserve(6, tokens());
    const scope = createContainerMotionScope(root, { engine });
    disposables.push(scope);
    observers[0].fire();
    expect(engine.stats().active).toBeLessThanOrEqual(8);
    c.flush();
    await flushPromises();
    expect([...root.children].every((el) => el.style.opacity === "")).toBe(
      true,
    );
    expect(engine.stats().peak).toBeLessThanOrEqual(8);
    release();
  });
  it("immediately restores a focused panel and ignores stale observer callbacks", () => {
    const { root, c, engine } = setup(
      '<section class="panel"><button>Focus</button></section>',
    );
    disposables.push(createContainerMotionScope(root, { engine }));
    const panel = root.firstChild;
    observers[0].fire();
    c.step();
    panel.firstChild.focus();
    expect(panel.style.transform).toBe("");
    expect(panel.style.opacity).toBe("");
    observers[0].fire([panel]);
    expect(c.pending()).toBe(0);
  });
  it("leaves containers visible when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { root, engine } = setup(
      '<section class="panel">Always visible</section>',
    );
    const scope = createContainerMotionScope(root, { engine });
    disposables.push(scope);
    expect(root.firstChild.style.cssText).toBe("");
    expect(engine.stats().active).toBe(0);
  });
  it("batches layout and base style reads before animation writes, and skips unchanged/off items", () => {
    const a = element(),
      b = element(),
      off = element();
    off.dataset.motion = "off";
    const before = new Map([
        [a, rect(0, 0)],
        [b, rect(10, 0)],
        [off, rect(0, 0)],
      ]),
      order = [];
    a.getBoundingClientRect = () => {
      order.push("read");
      return rect(100, 0);
    };
    b.getBoundingClientRect = () => {
      order.push("read");
      return rect(10, 0);
    };
    const engine = {
      reset: () => order.push("reset"),
      prepare: () => {
        order.push("style");
        return { base: { opacity: 0.6 } };
      },
      animate: vi.fn(() => {
        order.push("write");
        return {};
      }),
    };
    animateLayout(before, [a, b, off], { tokens: tokens(), engine });
    expect(engine.animate).toHaveBeenCalledTimes(1);
    expect(engine.animate.mock.calls[0][1].opacity).toBe(0.6);
    expect(order.lastIndexOf("style")).toBeLessThan(order.indexOf("write"));
    expect(order.lastIndexOf("read")).toBeLessThan(order.indexOf("write"));
  });
  it("removes real rows immediately, reflows retained items, and uses inert sanitized exit ghosts", async () => {
    const { root, c, engine, list, shift } = cardList();
    const before = list.capture(),
      old = root.firstChild;
    old.remove();
    shift();
    list.update(before);
    expect(root.children.length).toBe(2);
    const ghost = document.querySelector(".liquid-exit-ghost");
    expect(ghost).not.toBeNull();
    expect(ghost.hasAttribute("inert")).toBe(true);
    expect(ghost.getAttribute("aria-hidden")).toBe("true");
    expect(ghost.querySelector("[id],[href],[aria-labelledby]")).toBeNull();
    expect(ghost.querySelector("button").getAttribute("tabindex")).toBe("-1");
    expect(root.firstChild.style.transform).toContain("120px");
    expect(ghost.style.width).toBe("100px");
    c.flush();
    await flushPromises();
    expect(document.querySelector(".liquid-exit-ghost")).toBeNull();
    expect(engine.stats().active).toBe(0);
    expect([...root.children].every((el) => el.style.willChange === "")).toBe(
      true,
    );
  });
  it("cancels stale ghosts during rapid filtering, scroll, policy changes and unmount", async () => {
    const { root, c, engine, list, shift } = cardList();
    const before = list.capture();
    root.firstChild.remove();
    shift();
    list.update(before);
    expect(document.querySelector(".liquid-exit-ghost")).not.toBeNull();
    window.dispatchEvent(new Event("scroll"));
    expect(document.querySelector(".liquid-exit-ghost")).toBeNull();
    const next = list.capture();
    root.firstChild.remove();
    list.update(next);
    root.dataset.motion = "off";
    await flushPromises();
    expect(document.querySelector(".liquid-exit-ghost")).toBeNull();
    list.dispose();
    c.flush();
    expect(engine.stats().active).toBe(0);
    expect(media.every((m) => m.listeners.size === 0)).toBe(true);
  });
  it.each(["reduced", "off"])(
    "supports %s lists without spatial motion or delayed data",
    async (mode) => {
      const { root, c, engine, list, shift } = cardList(mode);
      const before = list.capture();
      root.firstChild.remove();
      shift();
      list.update(before);
      c.step();
      expect(root.children.length).toBe(2);
      for (const el of [
        ...root.children,
        ...document.querySelectorAll(".liquid-exit-ghost"),
      ])
        expect(el.style.transform).toBe("");
      if (mode === "off")
        expect(document.querySelector(".liquid-exit-ghost")).toBeNull();
      c.flush();
      await flushPromises();
      expect(engine.stats().active).toBe(0);
    },
  );
  it("keeps table rows in tbody and snapshots column widths without extra layout wrappers", () => {
    const table = element("table"),
      body = document.createElement("tbody");
    table.append(body);
    body.innerHTML =
      '<tr data-motion-key="a"><td>Old</td><td>Row</td></tr><tr data-motion-key="b"><td>New</td><td>Row</td></tr>';
    const c = clock(),
      engine = createMotionEngine({ ...c, getTokens: () => tokens() }),
      list = createListMotion(body, { engine });
    disposables.push(list);
    [...body.children].forEach((el, i) => {
      el.getBoundingClientRect = () => rect(10, 20 + i * 80, 200);
      [...el.children].forEach(
        (cell) => (cell.getBoundingClientRect = () => rect(0, 0, 100)),
      );
    });
    const before = list.capture();
    body.firstChild.remove();
    list.update(before);
    expect(body.children.length).toBe(1);
    expect(body.firstChild.tagName).toBe("TR");
    expect(
      document.querySelector(".liquid-exit-ghost table tbody tr"),
    ).not.toBeNull();
  });
  it("only captures structural key changes and preserves native input state and DOM identities", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const Demo = defineComponent({
      components: { MotionList },
      setup() {
        return { ids: ref(["a", "b"]), text: ref("draft") };
      },
      template:
        '<table><MotionList as="tbody" :item-keys="ids"><tr v-for="id in ids" :key="id" :data-motion-key="id"><td><input v-model="text" :aria-label="id"></td></tr></MotionList></table>',
    });
    const w = mount(Demo, { attachTo: document.body });
    wrappers.push(w);
    const original = w.get('input[aria-label="b"]').element;
    const measure = vi.spyOn(w.get("tr").element, "getBoundingClientRect");
    await w.get('input[aria-label="b"]').setValue("keep my draft");
    expect(measure).not.toHaveBeenCalled();
    w.vm.ids = ["b", "a"];
    await flushPromises();
    expect(measure).toHaveBeenCalled();
    expect(w.findAll("tbody > tr")).toHaveLength(2);
    expect(w.get('input[aria-label="b"]').element).toBe(original);
    expect(original.value).toBe("keep my draft");
  });
});
