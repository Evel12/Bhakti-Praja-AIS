import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import AttemptView from "../../src/views/student/AttemptView.vue";
import { useAssessmentStore } from "../../src/stores/assessmentStore.js";

let pinia, wrapper;
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T05:00:00Z"));
  pinia = createPinia();
  setActivePinia(pinia);
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  pinia._s.forEach((store) => store.$dispose());
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.useRealTimers();
});
async function openAttempt() {
  const store = useAssessmentStore();
  const assessment = store.db.assessments.find((a) => a.id === "as-network");
  const id = store.start(assessment);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/attempt/:id", component: AttemptView },
      { path: "/review/:id", component: { template: "<p>Pengumpulan diterima</p>" } },
    ],
  });
  await router.push("/attempt/" + id);
  wrapper = mount(RouterView, {
    attachTo: document.body,
    global: {
      plugins: [pinia, router],
      stubs: {
        AppDialog: { props: ["open"], template: '<div v-if="open" role="dialog"><slot /><slot name="footer" /></div>' },
      },
    },
  });
  await flushPromises();
  return { store, assessment, id, router };
}
const button = (text) => wrapper.findAll("button").find((item) => item.text() === text);

describe("exam review and time awareness", () => {
  it("identifies unanswered and flagged questions and returns focus to a selected question", async () => {
    const { store, assessment, id } = await openAttempt();
    store.changeAttempt(id, (attempt) => {
      attempt.answers[assessment.questions[0].id] = 1;
      attempt.flags = [assessment.questions[1].id];
    });
    await button("Cek & kirim").trigger("click");
    expect(wrapper.get(".review-summary").text()).toContain("2 soal belum dijawab");
    expect(wrapper.get(".review-summary").text()).toContain("1 soal ditandai ragu");
    const second = wrapper.get('.review-numbers button[aria-label="Soal 2, belum dijawab, ditandai ragu"]');
    expect(second.text()).toContain("Belum dijawab");
    await second.trigger("click");
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.get(".question-count").text()).toBe("Soal 2 dari 3");
    expect(document.activeElement.textContent).toBe(assessment.questions[1].text);
    expect(store.db.attempts.find((attempt) => attempt.id === id).status).toBe("in_progress");
  });

  it("announces time milestones without changing the announcement every second", async () => {
    const { store, id } = await openAttempt();
    const expires = Date.parse(store.db.attempts.find((attempt) => attempt.id === id).expiresAt);
    expect(wrapper.get(".exam-time-warning").text()).toBe("");
    vi.setSystemTime(expires - 301000);
    await vi.advanceTimersByTimeAsync(1000);
    const fiveMinutes = wrapper.get(".exam-time-warning").text();
    expect(fiveMinutes).toContain("lima menit");
    await vi.advanceTimersByTimeAsync(2000);
    expect(wrapper.get(".exam-time-warning").text()).toBe(fiveMinutes);
    vi.setSystemTime(expires - 61000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(wrapper.get(".exam-time-warning").text()).toContain("satu menit");
  });

  it("keeps answers and review available if submission cannot be persisted", async () => {
    const { store, assessment, id, router } = await openAttempt();
    store.changeAttempt(id, (attempt) => { attempt.answers[assessment.questions[0].id] = 1; });
    await button("Cek & kirim").trigger("click");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("QuotaExceeded"); });
    await button("Kirim jawaban").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/attempt/" + id);
    expect(wrapper.get('[role="alert"]').text()).toContain("Pengiriman belum tersimpan");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    const attempt = store.db.attempts.find((entry) => entry.id === id);
    expect(attempt.status).toBe("in_progress");
    expect(attempt.answers[assessment.questions[0].id]).toBe(1);
  });
});
