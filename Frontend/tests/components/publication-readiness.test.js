import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import AssessmentBuilderView from "../../src/views/teacher/AssessmentBuilderView.vue";
import { useAssessmentStore } from "../../src/stores/assessmentStore.js";
import { newQuestion, STORAGE_KEY } from "../../src/domain/assessment.js";
import { assessmentFieldId } from "../../src/domain/assessmentValidation.js";

let pinia, wrapper;
beforeEach(() => {
  localStorage.clear();
  pinia = createPinia();
  setActivePinia(pinia);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T05:00:00Z"));
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  pinia._s.forEach((store) => store.$dispose());
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.useRealTimers();
});
async function openDraft(change = () => {}) {
  const store = useAssessmentStore();
  const id = store.create();
  store.transaction((db) => {
    const assessment = db.assessments.find((item) => item.id === id);
    Object.assign(assessment, {
      title: "Evaluasi basis data",
      type: "Ujian",
      course: "Basis Data",
      className: "Kelas C",
      duration: 35,
      openAt: "2026-11-02T01:00:00Z",
      closeAt: "2026-11-02T03:00:00Z",
      releaseMode: "manual",
      instructions: "Pilih satu jawaban yang paling tepat.",
      questions: [2, 3].map((points, index) => ({
        ...newQuestion(), id: `readiness-${index}`, text: `Pertanyaan ${index + 1}?`,
        options: ["Pilihan pertama", "Pilihan kedua"], points,
      })),
    });
    change(assessment);
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/builder/:id", component: AssessmentBuilderView },
      { path: "/assessments/all", component: { template: "<p>Assessment</p>" } },
    ],
  });
  await router.push(`/builder/${id}`);
  wrapper = mount(RouterView, {
    attachTo: document.body,
    global: {
      plugins: [pinia, router],
      stubs: {
        AppDialog: { props: ["open"], template: '<div v-if="open"><slot /><slot name="footer" /></div>' },
        MotionField: { template: "<div><slot /></div>" },
      },
    },
  });
  await flushPromises();
  return { store, id, router };
}
async function preview() {
  await wrapper.findAll(".step")[3].trigger("click");
  await flushPromises();
}
const issueLink = (target) => wrapper.get(`.error-box a[href="#${target}"]`);
const summary = () => Object.fromEntries(wrapper.findAll(".publication-summary > div").map((row) => [row.get("dt").text(), row.get("dd").text()]));

describe("publication readiness", () => {
  it("leaves unvisited steps quiet, then shows all publication issues on a direct preview visit", async () => {
    await openDraft((a) => {
      a.title = "";
      a.course = "";
      a.questions[0].text = "";
      a.questions[0].options[0] = "";
      a.duration = 0;
    });
    expect(wrapper.find(".error-box").exists()).toBe(false);
    expect(wrapper.get("#assessment-title").attributes("aria-invalid")).toBeUndefined();
    await wrapper.findAll(".step")[1].trigger("click");
    expect(wrapper.find(".error-box").exists()).toBe(false);
    await preview();
    expect(wrapper.get(".publication-readiness h2").text()).toBe("Belum siap diterbitkan");
    expect(wrapper.findAll(".readiness-issues a")).toHaveLength(5);
    expect(wrapper.findAll(".step-error-label")).toHaveLength(3);
    expect(wrapper.get(".builder-footer .primary").text()).toBe("Perbaiki sebelum terbit");
    expect(wrapper.find(".preview-list").exists()).toBe(false);
    expect(wrapper.get(".publication-content").text()).toContain("Konten belum lengkap");
    expect(wrapper.text()).not.toContain("✓ Kunci");
  });

  it("checks an expired closing schedule immediately and sends the repair action to that field", async () => {
    const { id, store } = await openDraft((a) => {
      a.openAt = "2026-10-30T01:00:00Z";
      a.closeAt = "2026-10-31T03:00:00Z";
    });
    await preview();
    expect(wrapper.get(".readiness-issues").text()).toContain("Waktu tutup sudah lewat");
    await wrapper.get(".builder-footer .primary").trigger("click");
    await flushPromises();
    expect(document.activeElement.id).toBe("assessment-closeAt");
    expect(document.activeElement.getAttribute("aria-invalid")).toBe("true");
    expect(store.db.assessments.find((a) => a.id === id).state).toBe("draft");
  });

  it("opens the correct question and field from preview, updates readiness, and preserves autosave", async () => {
    const { id } = await openDraft((a) => { a.title = ""; a.questions[1].options[1] = ""; });
    await preview();
    const target = assessmentFieldId("option-1", "readiness-1");
    await issueLink(target).trigger("click");
    await flushPromises();
    expect(wrapper.get(".question-editor").text()).toContain("Pertanyaan 2");
    expect(document.activeElement.id).toBe(target);
    expect(document.activeElement.getAttribute("aria-describedby")).toBe(target + "-error");
    await wrapper.get('[aria-label="Pilihan B"]').setValue("Jawaban diperbaiki");
    await preview();
    expect(wrapper.findAll(".readiness-issues a")).toHaveLength(1);
    expect(wrapper.find(".preview-list").exists()).toBe(true);
    await issueLink("assessment-title").trigger("click");
    await flushPromises();
    expect(document.activeElement.id).toBe("assessment-title");
    await wrapper.get("#assessment-title").setValue("Evaluasi lengkap");
    await vi.advanceTimersByTimeAsync(600);
    await preview();
    expect(wrapper.get(".publication-readiness h2").text()).toBe("Siap diterbitkan");
    expect(wrapper.find(".error-box").exists()).toBe(false);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)).assessments.find((a) => a.id === id);
    expect(saved.questions[1].options[1]).toBe("Jawaban diperbaiki");
    expect(saved.title).toBe("Evaluasi lengkap");
    expect(saved.state).toBe("draft");
  });

  it.each([
    ["manual", "Manual oleh pengajar"],
    ["immediate", "Langsung setelah peserta mengirim jawaban"],
  ])("shows the complete summary with the %s release policy and retains final confirmation", async (mode, policy) => {
    const { id, store } = await openDraft((a) => { a.releaseMode = mode; });
    await preview();
    expect(summary()).toEqual({
      Judul: "Evaluasi basis data", "Mata kuliah": "Basis Data", Kelas: "Kelas C", Jenis: "Ujian",
      Durasi: "35 menit", "Jumlah soal": "2 soal", "Total poin": "5 poin",
      "Waktu buka (WIB)": "2 Nov 2026 · 08.00 WIB", "Waktu tutup (WIB)": "2 Nov 2026 · 10.00 WIB",
      "Rilis nilai": policy,
    });
    expect(wrapper.get(".publication-readiness h2").text()).toBe("Siap diterbitkan");
    expect(wrapper.findAll(".preview-question")).toHaveLength(2);
    await wrapper.get(".builder-footer .primary").trigger("click");
    expect(wrapper.findAll("button").some((button) => button.text() === "Ya, terbitkan")).toBe(true);
    expect(store.db.assessments.find((a) => a.id === id).state).toBe("draft");
  });

  it("shows missing-task instructions as an actionable issue without previewing irrelevant answer keys", async () => {
    await openDraft((a) => { a.type = "Tugas"; a.instructions = ""; });
    await preview();
    expect(summary().Durasi).toBe("Sampai tenggat pengumpulan");
    expect(summary()["Jumlah soal"]).toBe("Tidak berlaku untuk tugas");
    expect(summary()["Total poin"]).toBe("Penilaian manual · nilai 0–100");
    expect(wrapper.find(".preview-list").exists()).toBe(false);
    await issueLink("assessment-instructions").trigger("click");
    await flushPromises();
    expect(document.activeElement.id).toBe("assessment-instructions");
    await wrapper.get("#assessment-instructions").setValue("Upload laporan hasil analisis.");
    await preview();
    expect(wrapper.get(".publication-readiness h2").text()).toBe("Siap diterbitkan");
    expect(wrapper.get(".publication-content").text()).toContain("Upload laporan hasil analisis.");
    expect(wrapper.find(".preview-list").exists()).toBe(false);
  });

  it("routes an empty-question draft to its add-question action", async () => {
    await openDraft((a) => { a.questions = []; });
    await preview();
    expect(wrapper.find(".preview-list").exists()).toBe(false);
    await issueLink("assessment-questions").trigger("click");
    await flushPromises();
    expect(document.activeElement.id).toBe("assessment-questions");
    await wrapper.get("#assessment-questions").trigger("click");
    await preview();
    expect(wrapper.get(".readiness-issues").text()).toContain("Tuliskan pertanyaan soal 1");
    expect(wrapper.find(".preview-list").exists()).toBe(false);
  });
});
