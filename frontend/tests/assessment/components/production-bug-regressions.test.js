import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { nextTick } from "vue";
import {
  apiClient,
  setStoredSession,
  setStoredToken,
} from "../../../src/assessment-module/services/apiClient.js";
import { useAuthStore } from "../../../src/assessment-module/stores/authStore.js";
import { useAssessmentStore } from "../../../src/assessment-module/stores/assessmentStore.js";
import { useLmsStore } from "../../../src/assessment-module/stores/lmsStore.js";
import ResetPasswordView from "../../../src/assessment-module/views/auth/ResetPasswordView.vue";
import TeacherClassesView from "../../../src/assessment-module/views/lms/TeacherClassesView.vue";
import AppSidebar from "../../../src/assessment-module/components/navigation/AppSidebar.vue";
import appRouter from "../../../src/assessment-module/router/index.js";
import { installMedia, installTokenStyles } from "./motion-fixture.js";

let pinia, wrapper;

beforeEach(() => {
  localStorage.clear();
  pinia = createPinia();
  setActivePinia(pinia);
  installMedia();
  installTokenStyles();
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Production Bug Hunt Regressions", () => {
  it("strips fixture/seed data on live backend sync even when backend has zero classes and resolves login without blocking", async () => {
    setStoredToken("live-teacher-token");
    setStoredSession({
      user: { id: 99, name: "Guru Baru", email: "guru.baru@test.id", role: "teacher" },
      apiConnected: true,
    });

    const assessmentStore = useAssessmentStore();
    expect(assessmentStore.db.assessments.length).toBeGreaterThan(0);

    let resolveClasses;
    vi.spyOn(apiClient, "login").mockResolvedValue({
      token: "live-teacher-token",
      user: { id: 99, name: "Guru Baru", email: "guru.baru@test.id", role: "teacher" },
    });
    vi.spyOn(apiClient, "listClasses").mockImplementation(
      () => new Promise((resolve) => { resolveClasses = resolve; }),
    );
    vi.spyOn(apiClient, "listQuestionBank").mockResolvedValue([]);
    vi.spyOn(apiClient, "listNotifications").mockResolvedValue({ items: [], unread_count: 0 });
    vi.spyOn(apiClient, "logout").mockResolvedValue({});

    const authStore = useAuthStore();
    const loginPromise = authStore.loginWithEmail({
      email: "guru.baru@test.id",
      password: "GuruPassword123!",
    });

    // Login must resolve without waiting on classes/quizzes waterfall
    const loginRes = await loginPromise;
    expect(loginRes.ok).toBe(true);
    expect(assessmentStore.db.assessments).toHaveLength(0);
    expect(assessmentStore.db.bank).toHaveLength(0);

    resolveClasses({ items: [] });
    await flushPromises();

    expect(assessmentStore.db.assessments).toHaveLength(0);
    expect(assessmentStore.db.attempts).toHaveLength(0);
    expect(assessmentStore.db.bank).toHaveLength(0);

    await authStore.logout();
    expect(assessmentStore.db.assessments).toHaveLength(0);
  });

  it("hides internal SRS tag and clears stale logout notice on ResetPasswordView", async () => {
    const authStore = useAuthStore();
    authStore.notice = "Anda telah keluar dari sesi.";

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/reset-password", component: ResetPasswordView },
        { path: "/login", component: { template: "<p>Login</p>" } },
      ],
    });
    await router.push("/reset-password");

    wrapper = mount(RouterView, { global: { plugins: [pinia, router] } });
    await flushPromises();

    expect(wrapper.text()).not.toContain("SRS-02");
    expect(wrapper.text()).not.toContain("Anda telah keluar dari sesi.");
    expect(authStore.notice).toBe("");
  });

  it("renders class options without '(null)' and hides broken copy code button when class_code is null", async () => {
    const authStore = useAuthStore();
    authStore.apiConnected = true;
    authStore.token = "live-teacher-token";
    authStore.user = { id: 1, name: "Guru", email: "guru@test.id", role: "teacher" };

    const lmsStore = useLmsStore();
    vi.spyOn(lmsStore, "loadClasses").mockImplementation(async () => {
      lmsStore.classes = [
        { id: 5, name: "XII TKJ 1 - Pemrograman Dasar", class_code: null, students_count: 2 },
      ];
      lmsStore.activeClassId = 5;
      lmsStore.activeClass = {
        id: 5,
        name: "XII TKJ 1 - Pemrograman Dasar",
        class_code: null,
        students_count: 2,
      };
      return lmsStore.classes;
    });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/classes/:id?", component: TeacherClassesView }],
    });
    await router.push("/classes");

    wrapper = mount(TeacherClassesView, { global: { plugins: [pinia, router] } });
    await flushPromises();

    expect(wrapper.text()).not.toContain("(null)");
    expect(wrapper.text()).not.toContain("Kode:");
  });

  it("highlights Notifikasi in AppSidebar on /student/notifications instead of leaving wrong item active", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/student", component: { template: "<div/>" }, meta: { student: true } },
        { path: "/student/classes", component: { template: "<div/>" }, meta: { student: true } },
        { path: "/student/notifications", component: { template: "<div/>" }, meta: { student: true } },
        { path: "/my-results", component: { template: "<div/>" }, meta: { student: true } },
      ],
    });
    await router.push("/student/notifications");

    wrapper = mount(AppSidebar, {
      attachTo: document.body,
      global: { plugins: [pinia, router] },
    });
    await flushPromises();

    const activeLinks = wrapper.findAll(".nav-item.active");
    expect(activeLinks).toHaveLength(1);
    expect(activeLinks[0].text()).toContain("Notifikasi");
  });

  it("renders 404 NotFoundView on unknown routes and redirects authenticated users away from /login", async () => {
    await appRouter.push("/nonexistent-route-check");
    await appRouter.isReady();
    await nextTick();
    expect(appRouter.currentRoute.value.name).toBe("not-found");

    setStoredToken("live-teacher-token");
    setStoredSession({
      user: { id: 1, name: "Guru", email: "guru@test.id", role: "teacher" },
      apiConnected: true,
    });
    await appRouter.push("/login");
    expect(appRouter.currentRoute.value.path).toBe("/dashboard");
  });
});
