import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import { computed, defineComponent } from "vue";
import AppSidebar from "../../src/components/navigation/AppSidebar.vue";
import QuestionEditor from "../../src/components/assessment/QuestionEditor.vue";
import { useUiStore, SIDEBAR_KEY } from "../../src/stores/uiStore.js";
import { useAssessmentStore } from "../../src/stores/assessmentStore.js";
import { useCountdown } from "../../src/composables/useCountdown.js";
import { makeSeed } from "../../src/fixtures/seed.js";
import {
  STORAGE_KEY,
  newQuestion,
  clone,
} from "../../src/domain/assessment.js";
beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("navigation and reactive workflow safeguards", () => {
  it("persists the first seed once so refresh preserves its original schedule", () => {
    const first = useAssessmentStore();
    const before = clone(first.db);
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();
    setActivePinia(createPinia());
    expect(useAssessmentStore().db).toEqual(before);
  });
  it("collapses the sidebar, exposes accessible submenu and restores preference", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/:pathMatch(.*)*", component: { template: "<div />" } },
      ],
    });
    await router.push("/dashboard");
    const wrapper = mount(AppSidebar, { global: { plugins: [pinia, router] } });
    await flushPromises();
    await wrapper.get('[aria-label="Ciutkan navigasi"]').trigger("click");
    expect(localStorage.getItem(SIDEBAR_KEY)).toBe("true");
    expect(
      wrapper
        .get('[aria-label="Lebarkan navigasi"]')
        .attributes("aria-expanded"),
    ).toBe("false");
    await wrapper.get('[aria-label="Assessment"]').trigger("click");
    expect(wrapper.get(".nav-popover").text()).toContain("Terjadwal");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(wrapper.find(".nav-popover").exists()).toBe(false);
    wrapper.unmount();
    setActivePinia(createPinia());
    expect(useUiStore().collapsed).toBe(true);
  });
  it("invalidates reviewed AI questions when their content or answer key changes", async () => {
    const q = { ...newQuestion(), source: "ai", reviewed: true };
    const wrapper = mount(QuestionEditor, { props: { question: q } });
    await wrapper.find("textarea").setValue("Edited");
    expect(q.reviewed).toBe(false);
    q.reviewed = true;
    await wrapper.findAll("input[type=radio]")[1].setValue();
    expect(q.reviewed).toBe(false);
    wrapper.unmount();
  });
  it("leaves saved data and memory unchanged when an answer cannot be persisted", () => {
    const seed = makeSeed();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    const store = useAssessmentStore(),
      id = store.start(store.db.assessments[0]);
    const before = clone(store.db);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    expect(() =>
      store.changeAttempt(id, (at) => {
        at.answers["q-router"] = 1;
      }),
    ).toThrow(/Penyimpanan gagal/);
    expect(store.db).toEqual(before);
    expect(store.storageError).toBe(true);
  });
  it("countdown uses the existing deadline, expires once and clears interval on unmount", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100000);
    const expired = vi.fn();
    const component = defineComponent({
      setup() {
        return useCountdown(
          computed(() => new Date(103000).toISOString()),
          expired,
        );
      },
      template: "<p>{{display}}</p>",
    });
    const wrapper = mount(component);
    expect(wrapper.text()).toBe("00:03");
    await vi.advanceTimersByTimeAsync(5000);
    expect(expired).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not reseed corrupt legacy storage", () => {
    localStorage.setItem(STORAGE_KEY, "broken");
    const store = useAssessmentStore();
    expect(store.recoveryError).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("broken");
    expect(() => store.create()).toThrow(/Pulihkan/);
  });
});
