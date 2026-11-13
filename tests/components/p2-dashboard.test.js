import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { defineComponent, ref } from "vue";
import DashboardView from "../../src/views/teacher/DashboardView.vue";
import { useAssessmentStore } from "../../src/stores/assessmentStore.js";
import { useAssessmentClock } from "../../src/composables/useAssessmentClock.js";
import { clone } from "../../src/domain/assessment.js";

let pinia, wrapper, hidden;
beforeEach(() => {
  localStorage.clear();
  pinia = createPinia();
  setActivePinia(pinia);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-29T16:59:58Z"));
  hidden = false;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  pinia._s.forEach((store) => store.$dispose());
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function schedule(openOffset, closeOffset) {
  const store = useAssessmentStore();
  const assessment = clone(store.db.assessments.find((a) => a.id === "as-network"));
  assessment.openAt = new Date(Date.now() + openOffset).toISOString();
  assessment.closeAt = new Date(Date.now() + closeOffset).toISOString();
  store.transaction((db) => { db.assessments = [assessment]; db.attempts = []; });
  return store;
}
async function open() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: {} }],
  });
  await router.push("/dashboard");
  wrapper = mount(DashboardView, { global: { plugins: [pinia, router] } });
  await flushPromises();
}
const activeCount = () => wrapper.findAll(".metric-value")[0].text();

describe("clear dashboard data and deadlines", () => {
  it("uses a missing-value state instead of a zero score, while preserving real zero grades", async () => {
    const store = schedule(-1000, 100000);
    await open();
    expect(wrapper.get(".class-comparison").text()).toContain("Belum ada hasil dinilai");
    expect(wrapper.get(".class-grade-average").text()).toBe("—");
    store.transaction((db) => {
      db.attempts.push({
        id: "zero-grade", assessmentId: "as-network", status: "submitted", graded: true, score: 0,
        answers: {}, flags: [], expiresAt: new Date(Date.now()).toISOString(),
      });
    });
    await flushPromises();
    expect(wrapper.get(".class-grade-average").text()).toBe("0/100");
  });

  it("updates opening, WIB midnight labels, and closing boundaries without navigation", async () => {
    schedule(1000, 5000);
    await open();
    expect(activeCount()).toBe("00");
    expect(wrapper.find(".week-strip").exists()).toBe(false);
    expect(wrapper.get(".deadline-relative").text()).toBe("Besok");
    expect(wrapper.get(".deadline-entry").text()).toContain("Pantau pengumpulan");
    expect(wrapper.get(".deadline-entry time").attributes("datetime")).toBe("2026-10-29T17:00:03.000Z");
    await vi.advanceTimersByTimeAsync(1000);
    expect(activeCount()).toBe("01");
    await vi.advanceTimersByTimeAsync(1000);
    expect(wrapper.get(".deadline-relative").text()).toBe("Hari ini");
    await vi.advanceTimersByTimeAsync(3000);
    expect(activeCount()).toBe("00");
    expect(wrapper.find(".deadline-entry").exists()).toBe(false);
    expect(wrapper.text()).toContain("Belum ada tenggat mendatang");
  });

  it("refreshes immediately after an interrupted tab returns and reschedules edited deadlines", async () => {
    const store = schedule(-1000, 5000);
    await open();
    expect(activeCount()).toBe("01");
    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(10000);
    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    expect(activeCount()).toBe("00");
    store.transaction((db) => { db.assessments[0].closeAt = new Date(Date.now() + 1000).toISOString(); });
    await flushPromises();
    expect(activeCount()).toBe("01");
    await vi.advanceTimersByTimeAsync(1000);
    expect(activeCount()).toBe("00");
  });

  it("releases the clock timer and visibility handlers when its view unmounts", async () => {
    const assessments = ref([]);
    const baseline = vi.getTimerCount();
    wrapper = mount(defineComponent({
      setup() { return { now: useAssessmentClock(() => assessments.value) }; },
      template: "<p>{{ now }}</p>",
    }));
    expect(vi.getTimerCount()).toBe(baseline + 1);
    wrapper.unmount();
    wrapper = undefined;
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("pageshow"));
    window.dispatchEvent(new Event("focus"));
    expect(vi.getTimerCount()).toBe(baseline);
  });
});
