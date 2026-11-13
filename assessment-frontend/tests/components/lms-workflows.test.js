import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import TeacherClassesView from "../../src/views/lms/TeacherClassesView.vue";
import StudentClassesView from "../../src/views/lms/StudentClassesView.vue";
import NotificationsView from "../../src/views/lms/NotificationsView.vue";
import AppShell from "../../src/layouts/AppShell.vue";
import { apiClient, setStoredSession, setStoredToken } from "../../src/services/apiClient.js";
import { useLmsStore } from "../../src/stores/lmsStore.js";
import { useAuthStore } from "../../src/stores/authStore.js";
import { useAssessmentStore } from "../../src/stores/assessmentStore.js";
import { chooseSoftSelect } from "./soft-select-fixture.js";

function makeRouter(initialPath = "/classes") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/dashboard", component: { template: "<p>Home</p>" } },
      { path: "/classes/:id?", component: TeacherClassesView },
      { path: "/assessments/:status", component: { template: "<p>Assessment</p>" } },
      { path: "/builder/:id", component: { template: "<p>Builder</p>" } },
      { path: "/results/:id", component: { template: "<p>Results Detail</p>" } },
      { path: "/bank", component: { template: "<p>Bank</p>" } },
      { path: "/results", component: { template: "<p>Hasil</p>" } },
      { path: "/student/classes", component: StudentClassesView },
      { path: "/notifications", component: NotificationsView },
      { path: "/student/notifications", component: NotificationsView },
      { path: "/login", component: { template: "<p>Login</p>" } },
    ],
  });
  router.push(initialPath);
  return router;
}

describe("LMS teacher, student, notifications, and AI quiz review workflows", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
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
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("teacher manages classes via Approach C workspace (without duplicated Tugas or inline quiz editor), PDF visibility, AI launcher, Assessment handoff, announcements, and progress", async () => {
    setStoredToken("live-teacher-token");
    setStoredSession({
      user: { id: 10, name: "Guru Biologi", email: "guru@test.id", role: "teacher" },
      apiConnected: true,
    });

    const classRecord = {
      id: 1,
      name: "Biologi X",
      description: "Sel dan metabolisme",
      class_code: "BIOX1234",
      teacher_id: 10,
      students_count: 1,
    };

    const secondClassRecord = {
      id: 2,
      name: "Kimia XI",
      description: "Ikatan kimia",
      class_code: "KIMX9988",
      teacher_id: 10,
      students_count: 2,
    };

    const moduleRecord = {
      id: 11,
      class_id: 1,
      file_name: "modul-sel.pdf",
      visibility: "public",
      reads_count: 1,
    };

    const draftQuiz = {
      id: 51,
      class_id: 1,
      title: "Kuis Sel AI",
      status: "draft",
      questions_count: 1,
    };

    const aiQuestion = {
      id: 501,
      question_text: "Organel penghasil ATP adalah?",
      question_type: "multiple_choice",
      source: "ai",
      reviewed: false,
      options: [
        { id: 1, option_label: "A", option_text: "Mitokondria", is_correct: true },
        { id: 2, option_label: "B", option_text: "Ribosom", is_correct: false },
        { id: 3, option_label: "C", option_text: "Lisosom", is_correct: false },
        { id: 4, option_label: "D", option_text: "Vakuola", is_correct: false },
      ],
    };

    vi.spyOn(apiClient, "listClasses").mockResolvedValue({ items: [classRecord, secondClassRecord] });
    const getClassSpy = vi.spyOn(apiClient, "getClass").mockImplementation(async (id) =>
      Number(id) === 2 ? secondClassRecord : classRecord,
    );
    vi.spyOn(apiClient, "listModules").mockResolvedValue({ items: [moduleRecord] });
    vi.spyOn(apiClient, "listClassAssignments").mockResolvedValue({ items: [] });
    vi.spyOn(apiClient, "listClassAnnouncements").mockResolvedValue({ items: [] });
    vi.spyOn(apiClient, "listClassQuizzes").mockResolvedValue({ data: [draftQuiz] });
    vi.spyOn(apiClient, "getClassProgress").mockResolvedValue({
      class_id: 1,
      total_public_modules: 1,
      modules: [moduleRecord],
      students: [
        {
          student_id: 20,
          name: "Siti Aminah",
          email: "siti@test.id",
          read_count: 1,
          total_modules: 1,
          progress_percentage: 100,
        },
      ],
    });
    const visSpy = vi.spyOn(apiClient, "setModuleVisibility").mockResolvedValue({
      ...moduleRecord,
      visibility: "private",
    });
    const annSpy = vi.spyOn(apiClient, "createAnnouncement").mockResolvedValue({
      id: 88,
      class_id: 1,
      title: "Info Kuis",
      content: "Pelajari modul sel.",
    });
    vi.spyOn(apiClient, "getQuiz").mockResolvedValue(draftQuiz);
    vi.spyOn(apiClient, "listQuestions").mockResolvedValue([aiQuestion]);
    const reviewSpy = vi.spyOn(apiClient, "reviewQuestion").mockResolvedValue({
      ...aiQuestion,
      reviewed: true,
    });
    const publishQuizSpy = vi.spyOn(apiClient, "publishQuiz").mockResolvedValue({
      ...draftQuiz,
      status: "published",
    });

    const router = makeRouter("/classes");
    await router.isReady();

    const wrapper = mount(TeacherClassesView, {
      attachTo: document.body,
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("Biologi X");
    expect(wrapper.text()).toContain("BIOX1234");
    expect(wrapper.text()).toContain("modul-sel.pdf");
    expect(wrapper.text()).not.toContain("Creation Only");
    expect(wrapper.text()).not.toContain("Tugas Pembelajaran");
    expect(wrapper.findAll(".tab").some((t) => t.text().includes("Tugas"))).toBe(false);

    // Switch class via SoftSelect workspace selector, then back to class 1
    await chooseSoftSelect(wrapper, "Pilih kelas", "2");
    expect(getClassSpy).toHaveBeenCalledWith(2);
    await chooseSoftSelect(wrapper, "Pilih kelas", "1");

    // Toggle PDF visibility
    const visBtn = wrapper.findAll("button").find((b) => b.text().includes("Set Private"));
    await visBtn.trigger("click");
    await flushPromises();
    expect(visSpy).toHaveBeenCalledWith(11, "private");

    // Launch AI quiz generation flow from PDF card -> switches to Kuis Kelas feed without duplicated inline quiz editor
    const buatKuisBtn = wrapper.findAll("button").find((b) => b.text().includes("Buat Kuis AI"));
    expect(buatKuisBtn).toBeTruthy();
    await buatKuisBtn.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Kuis Sel AI");
    expect(wrapper.text()).not.toContain("Tambah soal manual");
    expect(wrapper.text()).not.toContain("Kesiapan Review AI");
    expect(wrapper.text()).not.toContain("Publish Kuis");

    // Handoff to Assessment Builder syncs the backend quiz (preserving AI review state) and navigates to /builder/api-quiz-51
    const handoffBtn = wrapper.findAll("button").find((b) => b.text().includes("Review & Edit di Assessment"));
    expect(handoffBtn).toBeTruthy();
    await handoffBtn.trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/builder/api-quiz-51");
    const syncedQuiz = useAssessmentStore().db.assessments.find((a) => a.backendQuizId === 51);
    expect(syncedQuiz).toBeTruthy();
    expect(syncedQuiz.questions[0].source).toBe("ai");
    expect(syncedQuiz.questions[0].reviewed).toBe(false);

    // Navigate back to /classes to verify Pengumuman and Progres Materi tabs
    await router.push("/classes/1");
    await flushPromises();

    // Pengumuman modal workflow
    await wrapper.findAll(".tab").find((t) => t.text().includes("Pengumuman")).trigger("click");
    await wrapper.findAll("button").find((b) => b.text().includes("Kirim pengumuman")).trigger("click");
    await flushPromises();

    await wrapper.get('dialog[open] input[placeholder*="Jadwal Pembahasan"]').setValue("Info Kuis");
    await wrapper.get("dialog[open] textarea").setValue("Pelajari modul sel.");
    await wrapper.get("dialog[open] form").trigger("submit");
    await flushPromises();
    expect(annSpy).toHaveBeenCalledWith(1, { title: "Info Kuis", content: "Pelajari modul sel." });

    // Student material progress tab (no grades shown)
    await wrapper.findAll(".tab").find((t) => t.text().includes("Progres Materi")).trigger("click");
    expect(wrapper.text()).toContain("Siti Aminah");
    expect(wrapper.text()).toContain("100%");
    wrapper.unmount();
  });

  it("student joins via class_code, reads public PDF modules, views assignments, marks notifications read, and updates topbar bell badge", async () => {
    setStoredToken("live-student-token");
    setStoredSession({
      user: { id: 20, name: "Siti Aminah", email: "siti@test.id", role: "student" },
      apiConnected: true,
    });

    const enrolledClass = {
      id: 2,
      name: "Fisika X",
      description: "Kinematika gerak",
      teacher_name: "Pak Adi",
      progress_percentage: 0,
    };

    vi.spyOn(apiClient, "listClasses").mockResolvedValue({ items: [enrolledClass] });
    vi.spyOn(apiClient, "getClass").mockResolvedValue(enrolledClass);
    vi.spyOn(apiClient, "listModules").mockResolvedValue({
      items: [{ id: 31, file_name: "gerak-lurus.pdf", visibility: "public", is_read: false }],
      progress: { read_count: 0, total_modules: 1, progress_percentage: 0 },
    });
    vi.spyOn(apiClient, "listClassAssignments").mockResolvedValue({
      items: [{ id: 41, title: "Tugas Baca Hukum Newton", description: "Halaman 5-8", total_score: 100 }],
    });
    vi.spyOn(apiClient, "listClassAnnouncements").mockResolvedValue({
      items: [{ id: 61, title: "Jadwal Praktikum", content: "Bawa penggaris.", teacher_name: "Pak Adi" }],
    });
    vi.spyOn(apiClient, "listClassQuizzes").mockResolvedValue({ data: [] });
    vi.spyOn(apiClient, "getClassProgress").mockResolvedValue({
      class_id: 2,
      total_public_modules: 1,
      read_count: 0,
      progress_percentage: 0,
    });
    const joinSpy = vi.spyOn(apiClient, "joinClass").mockResolvedValue(enrolledClass);
    const readSpy = vi.spyOn(apiClient, "markModuleRead").mockResolvedValue({
      module_id: 31,
      read_at: "2026-11-13T05:00:00Z",
      progress: { read_count: 1, total_modules: 1, progress_percentage: 100 },
    });
    const leaveSpy = vi.spyOn(apiClient, "leaveClass").mockResolvedValue({});

    const router = makeRouter("/student/classes");
    await router.isReady();

    const wrapper = mount(StudentClassesView, {
      attachTo: document.body,
      global: { plugins: [router] },
    });
    await flushPromises();

    // Join class via class_code
    await wrapper.get('input[aria-label="Kode kelas"]').setValue("FISX5678");
    await wrapper.get("section[aria-label='Gabung kelas dengan kode'] form").trigger("submit");
    await flushPromises();
    expect(joinSpy).toHaveBeenCalledWith("FISX5678");

    // Mark PDF read updates progress and custom progress bar
    await wrapper.findAll("button").find((b) => b.text().includes("Tandai dibaca")).trigger("click");
    await flushPromises();
    expect(readSpy).toHaveBeenCalledWith(31);
    expect(wrapper.text()).toContain("100%");
    expect(wrapper.get(".lms-progress-fill").attributes("style")).toContain("scaleX(1)");

    // View read-only assignments (no submission input)
    await wrapper.findAll(".tab").find((t) => t.text().includes("Tugas")).trigger("click");
    expect(wrapper.text()).toContain("Tugas Baca Hukum Newton");
    expect(wrapper.find('input[type="file"]').exists()).toBe(false);

    // Leave class confirmation
    await wrapper.findAll("button").find((b) => b.text().includes("Keluar kelas")).trigger("click");
    await wrapper.findAll("button").find((b) => b.text().includes("Konfirmasi keluar")).trigger("click");
    await flushPromises();
    expect(leaveSpy).toHaveBeenCalledWith(2);
    wrapper.unmount();

    // Notifications read & markAllAsRead + AppShell topbar badge
    vi.spyOn(apiClient, "listNotifications").mockResolvedValue({
      items: [
        { id: 901, title: "Pengumuman Baru", message: "Baca materi.", class_name: "Fisika X", is_read: false },
      ],
      unread_count: 1,
    });
    const markNotifSpy = vi.spyOn(apiClient, "markNotificationRead").mockResolvedValue({ id: 901, is_read: true });
    const markAllSpy = vi.spyOn(apiClient, "markAllNotificationsRead").mockResolvedValue({ unread_count: 0 });

    const authStore = useAuthStore();
    authStore.user = { id: 20, name: "Siti Aminah", email: "siti@test.id", role: "student" };
    vi.spyOn(authStore, "restoreSession").mockImplementation(() => {});

    const notifRouter = makeRouter("/student/notifications");
    await notifRouter.isReady();
    const shellWrapper = mount(AppShell, {
      attachTo: document.body,
      global: { plugins: [notifRouter] },
      slots: { default: "<p>Slot</p>" },
    });
    const notifWrapper = mount(NotificationsView, {
      attachTo: document.body,
      global: { plugins: [notifRouter] },
    });
    await flushPromises();
    expect(useLmsStore().unreadCount).toBe(1);
    expect(shellWrapper.get(".lms-bell-badge").text()).toBe("1");

    await notifWrapper.findAll("button").find((b) => b.text().includes("Tandai dibaca")).trigger("click");
    await flushPromises();
    expect(markNotifSpy).toHaveBeenCalledWith(901);
    expect(useLmsStore().unreadCount).toBe(0);
    expect(shellWrapper.find(".lms-bell-badge").exists()).toBe(false);

    await notifWrapper.findAll("button").find((b) => b.text().includes("Tandai semua dibaca")).trigger("click");
    await flushPromises();
    expect(markAllSpy).toHaveBeenCalledTimes(0); // button disabled once unreadCount hits 0

    notifWrapper.unmount();
    shellWrapper.unmount();
  });
});
