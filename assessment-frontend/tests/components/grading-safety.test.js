import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import AssignmentGradeView from "../../src/views/teacher/AssignmentGradeView.vue";
import { useAssessmentStore } from "../../src/stores/assessmentStore.js";
import { STORAGE_KEY } from "../../src/domain/assessment.js";

let wrapper, pinia;
const scope = { queue: "pending", class: "Kelas A", course: "Basis Data" };
beforeEach(() => {
  localStorage.clear();
  pinia = createPinia(); setActivePinia(pinia);
  vi.useFakeTimers();
});
afterEach(() => {
  wrapper?.unmount(); wrapper = undefined;
  pinia._s.forEach((store) => store.$dispose());
  vi.restoreAllMocks(); vi.useRealTimers();
});
async function open(id = "task-seed-0", query = scope) {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: "/grade/:id", component: AssignmentGradeView },
    { path: "/results/:id?", component: { template: "<p>Hasil</p>" } },
  ] });
  await router.push({ path: `/grade/${id}`, query });
  wrapper = mount(RouterView, { global: { plugins: [pinia, router], stubs: {
    MotionField: { template: "<div><slot /></div>" },
  } } });
  await flushPromises();
  return { router, store: useAssessmentStore() };
}
const attempt = (store, id = "task-seed-0") => store.db.attempts.find((item) => item.id === id);
const readPersisted = () => JSON.parse(localStorage.getItem(STORAGE_KEY));
const edit = async (score = "83", feedback = "Relasinya jelas; jelaskan kardinalitasnya.") => {
  await wrapper.get(".grade-score").setValue(score);
  await wrapper.get("textarea").setValue(feedback);
};

describe("safe grading interruptions and queue", () => {
  it("recovers a local draft after navigation and reload without committing a grade", async () => {
    const { router, store } = await open();
    await edit();
    expect(wrapper.get('[role="status"]').text()).toBe("Draft lokal tersimpan");
    await router.push("/results/as-database");
    await router.push({ path: "/grade/task-seed-0", query: scope });
    await flushPromises();
    expect(wrapper.get("textarea").element.value).toContain("kardinalitasnya");
    expect(wrapper.get('[role="status"]').text()).toBe("Draft lokal dipulihkan");
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
    expect(attempt(store).graded).toBe(false);
    expect(readPersisted().attempts.find((item) => item.id === "task-seed-0").feedback).toBeFalsy();
    wrapper.unmount(); wrapper = undefined;
    pinia._s.forEach((item) => item.$dispose());
    pinia = createPinia(); setActivePinia(pinia);
    await open();
    expect(wrapper.get(".grade-score").element.value).toBe("83");
    expect(wrapper.get("textarea").element.value).toContain("kardinalitasnya");
  });

  it("keeps failed draft edits open, prevents accidental exit and lets a retry recover", async () => {
    const { router, store } = await open();
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("QuotaExceeded"); });
    await edit("71", "Jangan hilangkan catatan ini.");
    expect(wrapper.get('[role="alert"]').text()).toContain("Coba simpan draft");
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    await router.push("/results/as-database");
    expect(router.currentRoute.value.path).toBe("/grade/task-seed-0");
    expect(wrapper.get("textarea").element.value).toContain("Jangan hilangkan");
    expect(attempt(store).graded).toBe(false);
    write.mockRestore();
    await wrapper.get('[role="alert"] button').trigger("click");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    await router.push("/results/as-database");
    await router.push({ path: "/grade/task-seed-0", query: scope });
    await flushPromises();
    expect(wrapper.get("textarea").element.value).toContain("Jangan hilangkan");
  });

  it("preserves draft fields when the explicit grade transaction fails", async () => {
    const { router, store } = await open();
    await edit("92", "Masih bisa dipulihkan.");
    const set = Storage.prototype.setItem;
    const failGrade = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(key, value) {
      if (key === STORAGE_KEY) throw new Error("Database unavailable");
      return set.call(this, key, value);
    });
    await wrapper.get("form").trigger("submit");
    expect(router.currentRoute.value.path).toBe("/grade/task-seed-0");
    expect(wrapper.get('[role="alert"]').text()).toContain("Coba simpan penilaian lagi");
    expect(wrapper.get("textarea").element.value).toBe("Masih bisa dipulihkan.");
    expect(attempt(store).graded).toBe(false);
    failGrade.mockRestore();
    await wrapper.get("form").trigger("submit"); await flushPromises();
    expect(attempt(store).score).toBe(92);
    expect(attempt(store).graded).toBe(true);
    expect(router.currentRoute.value.path).toBe("/results/as-database");
    expect(router.currentRoute.value.query).toEqual({ filter: "pending", class: "Kelas A", course: "Basis Data" });
  });

  it("saves explicitly, advances in the scoped pending queue and resets fields for the next student", async () => {
    const { router, store } = await open();
    // An older task outside the chosen register must not become the next student.
    store.transaction((db) => {
      const other = { ...db.assessments.find((item) => item.id === "as-database"), id: "other-course", course: "Sistem Operasi" };
      db.assessments.push(other);
      db.attempts.push({ ...db.attempts.find((item) => item.id === "task-seed-1"), id: "other-attempt", assessmentId: other.id, submittedAt: "2020-01-01T00:00:00Z" });
    });
    expect(wrapper.get(".grading-queue").text()).toContain("1 dari 3");
    await edit("88", "Hanya untuk Nadia");
    await wrapper.get("form").trigger("submit", { submitter: wrapper.get(".grading-save-next").element });
    await flushPromises();
    expect(attempt(store).score).toBe(88);
    expect(attempt(store).feedback).toBe("Hanya untuk Nadia");
    expect(router.currentRoute.value.path).toBe("/grade/task-seed-1");
    expect(router.currentRoute.value.query).toEqual(scope);
    expect(wrapper.get(".grade-score").element.value).toBe("");
    expect(wrapper.get("textarea").element.value).toBe("");
    expect(wrapper.get(".grading-queue").text()).toContain("1 dari 2");
    expect(attempt(store, "task-seed-1").graded).toBe(false);
    await router.push({ path: "/grade/task-seed-0", query: scope }); await flushPromises();
    expect(wrapper.get('[role="status"]').text()).toBe("Penilaian tersimpan");
    expect(wrapper.get("textarea").element.value).toBe("Hanya untuk Nadia");
  });

  it("does not restore an old draft over a newer saved grade or another attempt", async () => {
    const { router, store } = await open();
    await edit("43", "Draft lama");
    await router.push("/results/as-database");
    store.transaction((db) => { const item = db.attempts.find((x) => x.id === "task-seed-0"); item.score = 90; item.feedback = "Penilaian terbaru"; item.graded = true; });
    await router.push({ path: "/grade/task-seed-0", query: scope }); await flushPromises();
    expect(wrapper.get(".grade-score").element.value).toBe("90");
    expect(wrapper.get("textarea").element.value).toBe("Penilaian terbaru");
    await router.push({ path: "/grade/task-seed-1", query: scope }); await flushPromises();
    expect(wrapper.get("textarea").element.value).toBe("");
  });

  it("keeps edits to a released grade private until the teacher explicitly saves", async () => {
    const store = useAssessmentStore();
    store.transaction((db) => {
      db.assessments.find((item) => item.id === "as-database").released = true;
      const item = db.attempts.find((x) => x.id === "task-seed-0"); item.score = 80; item.graded = true;
    });
    await open();
    await edit("89", "Revisi belum diterbitkan");
    expect(wrapper.text()).toContain("Perubahan nilai akan terlihat oleh peserta");
    expect(attempt(store).score).toBe(80);
    expect(wrapper.find(".grading-save-next").exists()).toBe(false);
    window.dispatchEvent(new Event("pagehide"));
    expect(readPersisted().attempts.find((x) => x.id === "task-seed-0").score).toBe(80);
    await wrapper.get("form").trigger("submit"); await flushPromises();
    expect(attempt(store).score).toBe(89);
  });
});
