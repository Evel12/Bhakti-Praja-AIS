import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import AssessmentBuilderView from "../../src/views/teacher/AssessmentBuilderView.vue";
import DashboardView from "../../src/views/teacher/DashboardView.vue";
import ResultsView from "../../src/views/teacher/ResultsView.vue";
import AssignmentGradeView from "../../src/views/teacher/AssignmentGradeView.vue";
import { useAssessmentStore } from "../../src/stores/assessmentStore.js";
import { assessmentFieldId } from "../../src/domain/assessmentValidation.js";
import { clone, STORAGE_KEY } from "../../src/domain/assessment.js";

let pinia, wrapper;
beforeEach(() => {
  localStorage.clear();
  pinia = createPinia();
  setActivePinia(pinia);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-29T05:00:00Z"));
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  pinia._s.forEach((store) => store.$dispose());
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.useRealTimers();
});
async function open(path) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/dashboard", component: DashboardView },
      { path: "/builder/:id", component: AssessmentBuilderView },
      { path: "/results/:id?", component: ResultsView },
      { path: "/grade/:id", component: AssignmentGradeView },
      { path: "/assessments/:status", component: { template: "<p>Assessment</p>" } },
    ],
  });
  await router.push(path);
  wrapper = mount(RouterView, {
    attachTo: document.body,
    global: {
      plugins: [pinia, router],
      stubs: {
        AppDialog: { props: ["open"], template: '<div v-if="open"><slot /><slot name="footer" /></div>' },
        MotionField: { template: "<div><slot /></div>" },
        MotionList: { props: { as: { default: "div" } }, template: '<component :is="as"><slot /></component>' },
      },
    },
  });
  await flushPromises();
  return router;
}
function draft(change = () => {}) {
  const store = useAssessmentStore();
  const id = store.duplicate(store.db.assessments.find((a) => a.id === "as-network"));
  store.transaction((db) => change(db.assessments.find((a) => a.id === id)));
  return { id, store, assessment: store.db.assessments.find((a) => a.id === id) };
}
const summaryLink = (target) => wrapper.get(`.error-box a[href="#${target}"]`);
async function attemptPublish() {
  await wrapper.findAll(".step")[3].trigger("click");
  await wrapper.get(".builder-footer .primary").trigger("click");
  await flushPromises();
}

describe("field-linked publication recovery", () => {
  it.each([
    ["correct", (a) => { a.questions[0].correct = -1; }],
    ["points", (a) => { a.questions[0].points = 0; }],
    ["options", (a) => { a.questions[0].options = []; }],
    ["course", (a) => { a.course = ""; }],
    ["className", (a) => { a.className = ""; }],
    ["openAt", (a) => { a.openAt = ""; }],
    ["duration", (a) => { a.duration = 0; }],
  ])("gives the %s error a focusable target and associated inline explanation", async (name, change) => {
    const { id } = draft(change);
    await open(`/builder/${id}`);
    await attemptPublish();
    expect(document.activeElement.id.endsWith("-" + name)).toBe(true);
    expect(document.activeElement.getAttribute("aria-invalid")).toBe("true");
    const description = document.activeElement.getAttribute("aria-describedby");
    expect(document.getElementById(description)?.textContent).toBeTruthy();
    expect(summaryLink(document.activeElement.id).exists()).toBe(true);
  });

  it("keeps errors across steps, opens the right question and focuses the invalid field", async () => {
    const { id, assessment } = draft((a) => {
      a.title = "";
      a.questions[2].options[1] = "";
      a.closeAt = a.openAt;
    });
    await open(`/builder/${id}`);
    await attemptPublish();
    expect(document.activeElement.id).toBe("assessment-title");
    expect(wrapper.findAll(".step-error-label")).toHaveLength(3);
    await wrapper.findAll(".step")[2].trigger("click");
    expect(wrapper.findAll(".error-box a")).toHaveLength(3);
    const optionId = assessmentFieldId("option-1", assessment.questions[2].id);
    await summaryLink(optionId).trigger("click");
    await flushPromises();
    expect(wrapper.get(".question-editor").text()).toContain("Pertanyaan 3");
    expect(document.activeElement.id).toBe(optionId);
    const input = wrapper.get('[aria-label="Pilihan B"]');
    expect(input.attributes("aria-invalid")).toBe("true");
    expect(input.attributes("aria-describedby")).toBe(optionId + "-error");
    expect(document.getElementById(optionId + "-error").textContent).toContain("pilihan B");
    await input.setValue("Pilihan diperbaiki");
    expect(wrapper.find(`.error-box a[href="#${optionId}"]`).exists()).toBe(false);
    expect(input.attributes("aria-invalid")).toBeUndefined();
    await summaryLink("assessment-closeAt").trigger("click");
    await flushPromises();
    expect(document.activeElement.id).toBe("assessment-closeAt");
    expect(wrapper.get("#assessment-closeAt").attributes("aria-invalid")).toBe("true");
    await summaryLink("assessment-title").trigger("click");
    await wrapper.get("#assessment-title").setValue("Judul diperbaiki");
    expect(wrapper.findAll(".error-box a")).toHaveLength(1);
  });

  it("retains question identity and updates numbering after an earlier question is removed", async () => {
    const { id, assessment } = draft((a) => { a.questions[2].text = ""; });
    const target = assessmentFieldId("text", assessment.questions[2].id);
    await open(`/builder/${id}`);
    await attemptPublish();
    await wrapper.findAll(".question-nav button")[0].trigger("click");
    await wrapper.findAll("button").find((button) => button.text() === "Hapus soal").trigger("click");
    // The confirmation has the same caption as the trigger; choose its last occurrence.
    const removeButtons = wrapper.findAll("button").filter((button) => button.text() === "Hapus soal");
    await removeButtons.at(-1).trigger("click");
    await summaryLink(target).trigger("click");
    await flushPromises();
    expect(document.activeElement.id).toBe(target);
    expect(wrapper.get(".question-editor").text()).toContain("Pertanyaan 2");
    expect(summaryLink(target).text()).toContain("soal 2");
  });

  it("offers an actionable add-question target when the draft has no questions", async () => {
    const { id } = draft((a) => { a.questions = []; });
    await open(`/builder/${id}`);
    await attemptPublish();
    expect(document.activeElement.id).toBe("assessment-questions");
    await wrapper.get("#assessment-questions").trigger("click");
    expect(wrapper.find('.error-box a[href="#assessment-questions"]').exists()).toBe(false);
    expect(wrapper.get(".question-editor textarea").attributes("aria-invalid")).toBe("true");
  });

  it("focuses missing task instructions and keeps incomplete work autosaveable", async () => {
    const { id } = draft((a) => { a.type = "Tugas"; a.instructions = ""; });
    await open(`/builder/${id}`);
    await attemptPublish();
    expect(document.activeElement.id).toBe("assessment-instructions");
    await wrapper.get("#assessment-instructions").setValue("Instruksi tugas baru");
    expect(wrapper.find(".error-box").exists()).toBe(false);
    await vi.advanceTimersByTimeAsync(600);
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)).assessments.find((a) => a.id === id);
    expect(persisted.instructions).toBe("Instruksi tugas baru");
    expect(persisted.state).toBe("draft");
  });

  it("routes unreviewed AI errors to the confirmation checkbox and clears them after review", async () => {
    const { id } = draft((a) => { a.questions[1].source = "ai"; a.questions[1].reviewed = false; });
    await open(`/builder/${id}`);
    await attemptPublish();
    expect(document.activeElement.type).toBe("checkbox");
    expect(document.activeElement.getAttribute("aria-invalid")).toBe("true");
    await wrapper.get('.question-editor input[type="checkbox"]').setValue(true);
    expect(wrapper.find(".error-box").exists()).toBe(false);
  });

  it("rechecks the closing deadline if it passes while the publication dialog is open", async () => {
    const { id, store } = draft((a) => { a.closeAt = new Date(Date.now() + 1000).toISOString(); });
    await open(`/builder/${id}`);
    await attemptPublish();
    await vi.advanceTimersByTimeAsync(2000);
    await wrapper.findAll("button").find((button) => button.text() === "Ya, terbitkan").trigger("click");
    await flushPromises();
    expect(document.activeElement.id).toBe("assessment-closeAt");
    expect(wrapper.get(".error-box").text()).toContain("Waktu tutup sudah lewat");
    expect(store.db.assessments.find((a) => a.id === id).state).toBe("draft");
  });
});

describe("teacher grading priorities", () => {
  it("shows direct grading work ahead of deadlines and drafts and opens the pending-only queue", async () => {
    useAssessmentStore();
    const router = await open("/dashboard");
    const tasks = wrapper.findAll(".teacher-work-item");
    expect(tasks[0].attributes("data-task-kind")).toBe("grading");
    expect(tasks[0].text()).toContain("3 pengumpulan perlu dinilai");
    expect(tasks[0].get("a.btn").attributes("href")).toBe("/grade/task-seed-0?queue=pending");
    expect(tasks[1].attributes("data-task-kind")).toBe("deadline");
    await wrapper.findAll("a").find((link) => link.text() === "Cek sekarang").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.query.filter).toBe("pending");
    expect(wrapper.findAll(".result-register-row")).toHaveLength(1);
    expect(wrapper.get(".result-register-row").text()).toContain("Perancangan Basis Data");
    expect(wrapper.get(".result-register-row .register-grade").attributes("href")).toBe("/grade/task-seed-0?queue=pending");
  });

  it("returns from grading to remaining submissions without losing summary totals", async () => {
    const store = useAssessmentStore();
    const router = await open("/grade/task-seed-0?queue=pending");
    await wrapper.get(".grade-score").setValue("88");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe("/results/as-database?filter=pending");
    expect(wrapper.findAll("tbody tr")).toHaveLength(2);
    expect(wrapper.get(".stat-grid").text()).toContain("Pengumpulan3");
    expect(wrapper.get(".stat-grid").text()).toContain("Perlu dinilai2");
    expect(wrapper.findAll("tbody tr").some((row) => row.text().includes("Nadia Putri"))).toBe(false);
    store.transaction((db) => db.attempts.filter((at) => at.assessmentId === "as-database").forEach((at) => { at.graded = true; at.score = 88; }));
    await flushPromises();
    expect(wrapper.findAll("tbody tr")).toHaveLength(0);
    expect(wrapper.get('[role="status"]').text()).toContain("Semua pengumpulan sudah dinilai");
    await router.push("/results?filter=pending");
    await flushPromises();
    expect(wrapper.findAll(".result-register-row")).toHaveLength(0);
    expect(wrapper.get('[role="status"]').text()).toContain("Semua pengumpulan sudah dinilai");
    await router.push("/results");
    await flushPromises();
    expect(wrapper.findAll(".result-register-row").length).toBeGreaterThan(0);
  });

  it("keeps only-draft workspaces actionable and gives the results page a return path", async () => {
    const store = useAssessmentStore();
    const draftAssessment = clone(store.db.assessments.find((a) => a.state === "draft"));
    store.transaction((db) => { db.assessments = [draftAssessment]; db.attempts = []; });
    const router = await open("/dashboard");
    expect(wrapper.get(".teacher-work-item").attributes("data-task-kind")).toBe("draft");
    expect(wrapper.get(".teacher-work-item a.btn").attributes("href")).toBe(`/builder/${draftAssessment.id}`);
    await router.push("/results");
    await flushPromises();
    expect(wrapper.get('[role="status"]').text()).toContain("Belum ada assessment terbit");
    expect(wrapper.get('[role="status"] a').attributes("href")).toBe("/assessments/Draft");
  });
});
