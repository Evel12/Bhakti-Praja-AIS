import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import AssessmentBuilderView from "../../src/views/teacher/AssessmentBuilderView.vue";
import { apiClient, setStoredSession, setStoredToken } from "../../src/services/apiClient.js";
import { useAssessmentStore } from "../../src/stores/assessmentStore.js";
import { useLmsStore } from "../../src/stores/lmsStore.js";
import { installMedia, installTokenStyles } from "./motion-fixture.js";

describe("Approach C: real AI PDF generation & review sync in Assessment Builder", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    installMedia();
    installTokenStyles();
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("preserves ai source & reviewed state from backend and persists reviewed=true updates on syncDraftToBackend", async () => {
    setStoredToken("live-teacher-token");
    setStoredSession({
      user: { id: 10, name: "Guru Biologi", email: "guru@test.id", role: "teacher" },
      apiConnected: true,
    });

    vi.spyOn(apiClient, "listClasses").mockResolvedValue({
      items: [{ id: 7, name: "Biologi X · Kelas A", class_code: "BIO10" }],
    });
    vi.spyOn(apiClient, "listClassQuizzes").mockResolvedValue({
      items: [{ id: 88, class_id: 7, title: "Kuis Sel AI", status: "draft" }],
    });
    vi.spyOn(apiClient, "getQuiz").mockResolvedValue({
      id: 88,
      class_id: 7,
      title: "Kuis Sel AI",
      status: "draft",
      questions: [
        {
          id: 901,
          question_text: "Organel respirasi sel?",
          source: "ai",
          reviewed: false,
          options: [
            { id: 1, option_label: "A", option_text: "Mitokondria", is_correct: true },
            { id: 2, option_label: "B", option_text: "Ribosom", is_correct: false },
            { id: 3, option_label: "C", option_text: "Lisosom", is_correct: false },
            { id: 4, option_label: "D", option_text: "Golgi", is_correct: false },
          ],
        },
      ],
    });
    const updateQ = vi.spyOn(apiClient, "updateQuestion").mockResolvedValue({});
    const replaceOpts = vi.spyOn(apiClient, "replaceOptions").mockResolvedValue([]);
    vi.spyOn(apiClient, "updateQuiz").mockResolvedValue({});

    const store = useAssessmentStore();
    store.setRole("teacher");
    await store.syncFromApi();

    const synced = store.db.assessments.find((a) => a.backendQuizId === 88);
    expect(synced).toBeTruthy();
    expect(synced.questions[0].source).toBe("ai");
    expect(synced.questions[0].reviewed).toBe(false);

    // Approve AI question and sync back to backend
    synced.questions[0].reviewed = true;
    await store.syncDraftToBackend(synced);
    expect(updateQ).toHaveBeenCalledWith(88, 901, {
      question_text: "Organel respirasi sel?",
      reviewed: true,
    });
    expect(replaceOpts).toHaveBeenCalled();
  });

  it("generates real AI questions from a selected class PDF module inside AssessmentBuilderView and blocks publish until reviewed", async () => {
    setStoredToken("live-teacher-token");
    setStoredSession({
      user: { id: 10, name: "Guru Biologi", email: "guru@test.id", role: "teacher" },
      apiConnected: true,
    });

    const assessmentStore = useAssessmentStore();
    const lmsStore = useLmsStore();
    lmsStore.classes = [{ id: 7, name: "Biologi X · Kelas A", class_code: "BIO10" }];
    lmsStore.modules = [{ id: 33, class_id: 7, file_name: "sel-modul.pdf", visibility: "public" }];

    const id = assessmentStore.create(undefined, {
      course: "Biologi X",
      className: "Kelas A",
      backendClassId: 7,
    });
    assessmentStore.transaction((data) => {
      const target = data.assessments.find((a) => a.id === id);
      target.title = "Kuis Bab Sel";
    });

    vi.spyOn(apiClient, "listClasses").mockResolvedValue({ items: lmsStore.classes });
    vi.spyOn(apiClient, "listModules").mockResolvedValue({ items: lmsStore.modules });
    const reqGenSpy = vi.spyOn(apiClient, "requestQuizGeneration").mockResolvedValue({
      id: 400,
      status: "processing",
    });
    const getGenSpy = vi.spyOn(apiClient, "getQuizGeneration").mockResolvedValue({
      id: 400,
      status: "completed",
      quiz_id: 505,
    });
    vi.spyOn(apiClient, "getQuiz").mockResolvedValue({
      id: 505,
      class_id: 7,
      title: "Kuis Bab Sel",
      status: "draft",
      questions: [
        {
          id: 701,
          question_text: "Bagian sel yang mengatur aktivitas sel adalah?",
          source: "ai",
          reviewed: false,
          options: [
            { id: 11, option_label: "A", option_text: "Nukleus", is_correct: true },
            { id: 12, option_label: "B", option_text: "Vakuola", is_correct: false },
            { id: 13, option_label: "C", option_text: "Membran", is_correct: false },
            { id: 14, option_label: "D", option_text: "Sitoplasma", is_correct: false },
          ],
        },
      ],
    });
    vi.spyOn(apiClient, "updateQuiz").mockResolvedValue({});
    vi.spyOn(apiClient, "updateQuestion").mockResolvedValue({});
    vi.spyOn(apiClient, "replaceOptions").mockResolvedValue([]);

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/builder/:id", component: AssessmentBuilderView },
        { path: "/assessments/:status", component: { template: "<p>Assessments</p>" } },
      ],
    });
    await router.push(`/builder/${id}`);
    await router.isReady();

    const wrapper = mount(AssessmentBuilderView, {
      attachTo: document.body,
      global: { plugins: [router] },
    });
    await flushPromises();

    // Advance from step 0 (Identitas) to step 1 (Konten)
    await wrapper.findAll("button").find((b) => b.text().includes("Lanjutkan")).trigger("click");
    await flushPromises();

    await wrapper.findAll("button").find((b) => b.text().includes("Bantu dengan AI")).trigger("click");
    await flushPromises();

    expect(wrapper.text()).not.toContain("layanan pembuat soal belum dihubungkan");

    // Pick class PDF module and generate AI questions
    const moduleSelect = wrapper.get('dialog[open] select[aria-label="Pilih PDF kelas"]');
    await moduleSelect.setValue("33");
    await wrapper.findAll("dialog[open] button").find((b) => b.text().includes("Generate soal AI")).trigger("click");
    await flushPromises();

    expect(reqGenSpy).toHaveBeenCalledWith(33, 5, "Kuis Bab Sel");
    expect(getGenSpy).toHaveBeenCalledWith(400);
    const questionTextarea = wrapper.get('[id^="question-"][id$="-text"]');
    expect(questionTextarea.element.value).toBe("Bagian sel yang mengatur aktivitas sel adalah?");
    expect(wrapper.text()).toContain("Saya sudah mengecek isi dan kunci jawaban soal AI ini.");

    // AI question starts unreviewed and blocks Next/Publish validation
    const reviewCheckbox = wrapper.get('input[type="checkbox"]');
    expect(reviewCheckbox.element.checked).toBe(false);
    wrapper.unmount();
  });
});
