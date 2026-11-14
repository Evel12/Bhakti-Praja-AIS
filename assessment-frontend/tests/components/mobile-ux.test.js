import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import LoginView from "../../src/views/auth/LoginView.vue";
import ResetPasswordView from "../../src/views/auth/ResetPasswordView.vue";
import ExamLayout from "../../src/layouts/ExamLayout.vue";
import AppShell from "../../src/layouts/AppShell.vue";
import AttemptView from "../../src/views/student/AttemptView.vue";
import MyResultsView from "../../src/views/student/MyResultsView.vue";
import ResultsView from "../../src/views/teacher/ResultsView.vue";
import AssignmentGradeView from "../../src/views/teacher/AssignmentGradeView.vue";
import QuestionEditor from "../../src/components/assessment/QuestionEditor.vue";
import SoftSelect from "../../src/components/ui/SoftSelect.vue";
import StatusFilterDropdown from "../../src/components/ui/StatusFilterDropdown.vue";
import ClassCascadeSelect from "../../src/components/ui/ClassCascadeSelect.vue";
import { motionEngine } from "../../src/motion/engine.js";
import { useAssessmentStore } from "../../src/stores/assessmentStore.js";
import { useAuthStore } from "../../src/stores/authStore.js";
import { installMedia, installTokenStyles } from "./motion-fixture.js";

let pinia, wrapper;

beforeEach(() => {
  localStorage.clear();
  installMedia();
  pinia = createPinia();
  setActivePinia(pinia);
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
  pinia._s.forEach((store) => store.$dispose());
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("mobile UI/UX seamless improvements", () => {
  it("applies .input styling classes to all Login and Reset Password fields", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/login", component: LoginView },
        { path: "/reset-password", component: ResetPasswordView },
      ],
    });
    await router.push("/login");
    wrapper = mount(RouterView, { global: { plugins: [pinia, router] } });
    await flushPromises();
    const loginInputs = wrapper.findAll("input");
    expect(loginInputs.length).toBeGreaterThanOrEqual(2);
    loginInputs.forEach((input) => {
      expect(input.classes()).toContain("input");
    });

    await router.push("/reset-password");
    await flushPromises();
    expect(wrapper.get("input[type='email']").classes()).toContain("input");
  });

  it("renders AppBrand inertly inside ExamLayout so logo taps cannot exit active exams", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/student", component: { template: "<div />" } }],
    });
    wrapper = mount(ExamLayout, {
      global: { plugins: [pinia, router] },
      slots: { default: "<p>Soal aktif</p>" },
    });
    expect(wrapper.find("a.brand").exists()).toBe(false);
    expect(wrapper.find("div.brand").exists()).toBe(true);
  });

  it("opens the quick question map sheet and shows 'Cek & kirim' on the final question", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T05:00:00Z"));
    const store = useAssessmentStore();
    const assessment = store.db.assessments.find((a) => a.id === "as-network");
    const attemptId = store.start(assessment);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/attempt/:id", component: AttemptView },
        { path: "/review/:id", component: { template: "<p>Done</p>" } },
      ],
    });
    await router.push("/attempt/" + attemptId);
    wrapper = mount(RouterView, {
      attachTo: document.body,
      global: {
        plugins: [pinia, router],
        stubs: {
          AppDialog: {
            props: ["open", "title"],
            template: '<div v-if="open" role="dialog" :data-title="title"><slot /><slot name="footer" /></div>',
          },
        },
      },
    });
    await flushPromises();

    await wrapper.get(".exam-map-trigger").trigger("click");
    const mapDialog = wrapper.get('[role="dialog"][data-title="Daftar soal"]');
    const lastQuestionBtn = mapDialog.findAll(".number-grid button").at(-1);
    await lastQuestionBtn.trigger("click");
    await flushPromises();

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.get(".question-count").text()).toBe(
      `Soal ${assessment.questions.length} dari ${assessment.questions.length}`,
    );
    const bottomButtons = wrapper.findAll(".exam-bottom .action-row button");
    expect(bottomButtons.at(-1).text()).toBe("Cek & kirim");
    vi.useRealTimers();
  });

  it("provides mobile bottom navigation with pending badge and confirms before logout", async () => {
    useAssessmentStore();
    const authStore = useAuthStore();
    authStore.user = { email: "teacher@example.test", name: "Pengajar", role: "teacher" };
    const logoutSpy = vi.spyOn(authStore, "logout").mockResolvedValue();
    vi.spyOn(authStore, "restoreSession").mockImplementation(() => {});

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/dashboard", component: { template: "<p>Home</p>" } },
        { path: "/assessments/:status", component: { template: "<p>Assessment</p>" } },
        { path: "/classes", component: { template: "<p>Kelas</p>" } },
        { path: "/bank", component: { template: "<p>Bank</p>" } },
        { path: "/results", component: { template: "<p>Hasil</p>" } },
        { path: "/login", component: { template: "<p>Login</p>" } },
      ],
    });
    await router.push("/dashboard");
    wrapper = mount(AppShell, {
      attachTo: document.body,
      global: {
        plugins: [pinia, router],
        stubs: {
          AppDialog: {
            props: ["open", "title"],
            template: '<div v-if="open" role="dialog" :data-title="title"><slot /><slot name="footer" /></div>',
          },
        },
      },
      slots: { default: "<p>Konten</p>" },
    });
    await flushPromises();

    const quickLinks = wrapper.findAll(".mobile-bottom-nav .mobile-bottom-link");
    expect(quickLinks).toHaveLength(5);
    expect(quickLinks.map((l) => l.text())).toEqual([
      "Home",
      "Assessment",
      "Kelas",
      "Bank",
      "Hasil3",
    ]);
    expect(quickLinks[0].find(".liquid-nav-indicator").exists()).toBe(true);
    expect(quickLinks[0].attributes("aria-current")).toBe("page");
    expect(quickLinks.slice(1).every((l) => l.attributes("aria-current") === undefined)).toBe(true);
    expect(quickLinks.every((l) => l.find(".mobile-nav-icon").exists() && l.find(".mobile-nav-label").exists())).toBe(true);
    expect(quickLinks.every((l) => !l.get("svg.icon").classes().includes("sm"))).toBe(true);
    expect(wrapper.get(".mobile-nav-badge").text()).toBe("3");

    await router.push("/classes");
    await flushPromises();
    const updatedLinks = wrapper.findAll(".mobile-bottom-nav .mobile-bottom-link");
    expect(updatedLinks[2].attributes("aria-current")).toBe("page");
    expect(updatedLinks[2].find(".liquid-nav-indicator").exists()).toBe(true);
    expect(updatedLinks[2].find(".liquid-nav-indicator").element.style.opacity).toBe("");
    await router.push("/dashboard");
    await flushPromises();

    await wrapper.get(".auth-header-pill").trigger("click");
    expect(logoutSpy).not.toHaveBeenCalled();
    const dialog = wrapper.get('[role="dialog"][data-title="Keluar dari akun?"]');
    await dialog.findAll("button").find((b) => b.text() === "Ya, keluar").trigger("click");
    await flushPromises();
    expect(logoutSpy).toHaveBeenCalledTimes(1);
  });

  it("isolates QuestionEditor radio answer-key pills from option text inputs", () => {
    wrapper = mount(QuestionEditor, {
      props: {
        question: {
          id: "q-1",
          text: "Apa fungsi DNS?",
          options: ["Menerjemahkan domain", "Mengatur kabel"],
          correct: 0,
          points: 10,
          explanation: "",
        },
        index: 0,
      },
    });
    const optionRow = wrapper.findAll(".option-editor")[1];
    expect(optionRow.element.tagName).toBe("DIV");
    const keyPill = optionRow.get("label.option-key-pill");
    expect(keyPill.find("input[type='radio']").exists()).toBe(true);
    expect(keyPill.find("input.input").exists()).toBe(false);
  });

  it("keeps SoftSelect open during coarse-pointer vertical address-bar resize", async () => {
    vi.stubGlobal("innerWidth", 390);
    vi.stubGlobal("innerHeight", 780);
    vi.stubGlobal("matchMedia", (query) => ({
      matches: query === "(pointer: coarse)",
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    wrapper = mount(SoftSelect, {
      attachTo: document.body,
      props: {
        label: "Kelas",
        modelValue: "",
        options: [
          { value: "", label: "Semua kelas" },
          { value: "A", label: "Kelas A" },
        ],
      },
    });
    await wrapper.get('[role="combobox"]').trigger("click");
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();

    vi.stubGlobal("innerHeight", 710);
    window.dispatchEvent(new Event("resize"));
    await flushPromises();
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();

    vi.stubGlobal("innerWidth", 780);
    window.dispatchEvent(new Event("resize"));
    await flushPromises();
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it("marks student results and submission detail tables with .mobile-cards labels and collapses mobile grading instructions", async () => {
    vi.stubGlobal("matchMedia", (query) => ({
      matches: query === "(max-width: 768px)",
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    const store = useAssessmentStore();
    store.transaction((db) => {
      db.attempts.find((a) => a.id === "attempt-seed-0").studentId = "student-demo";
    });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/my-results", component: MyResultsView },
        { path: "/results/:id?", component: ResultsView },
        { path: "/grade/:id", component: AssignmentGradeView },
      ],
    });

    await router.push("/my-results");
    wrapper = mount(RouterView, { global: { plugins: [pinia, router] } });
    await flushPromises();
    expect(wrapper.find("table.mobile-cards").exists()).toBe(true);
    expect(wrapper.find('td[data-label="Dikirim"]').exists()).toBe(true);
    expect(wrapper.find('td[data-label="Nilai"]').exists()).toBe(true);

    await router.push("/results/as-database");
    await flushPromises();
    expect(wrapper.find("table.mobile-cards").exists()).toBe(true);
    expect(wrapper.find('td[data-label="Status"]').exists()).toBe(true);

    await router.push("/grade/task-seed-0");
    await flushPromises();
    const details = wrapper.get("details.grading-instructions");
    expect(details.element.open).toBe(false);
  });

  it("renders SoftSelect as a mobile bottom sheet with backdrop and vertical sheet animation", async () => {
    installTokenStyles();
    vi.stubGlobal("matchMedia", (query) => ({
      matches: query === "(max-width: 768px)" || query === "(pointer: coarse)",
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    const spy = vi.spyOn(motionEngine, "animate");
    wrapper = mount(SoftSelect, {
      attachTo: document.body,
      props: {
        label: "Kelas",
        modelValue: "",
        options: [
          { value: "", label: "Semua kelas" },
          { value: "A", label: "Kelas A" },
        ],
      },
    });
    await wrapper.get('[role="combobox"]').trigger("click");
    await flushPromises();

    const popup = document.querySelector(".soft-field-popup");
    const backdrop = document.querySelector(".sheet-backdrop");
    expect(popup).not.toBeNull();
    expect(popup.classList.contains("is-sheet")).toBe(true);
    expect(backdrop).not.toBeNull();
    expect(spy.mock.calls.some(([el]) => el === popup)).toBe(true);

    backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
    expect(document.querySelector(".soft-field-popup")).toBeNull();
  });

  it("renders StatusFilterDropdown and ClassCascadeSelect as mobile bottom sheets on <= 768px", async () => {
    installTokenStyles();
    vi.stubGlobal("matchMedia", (query) => ({
      matches: query === "(max-width: 768px)" || query === "(pointer: coarse)",
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    const spy = vi.spyOn(motionEngine, "animate");

    wrapper = mount(StatusFilterDropdown, {
      attachTo: document.body,
      props: { modelValue: "all" },
    });
    await wrapper.get("button.status-dropdown-trigger").trigger("click");
    await flushPromises();

    const statusPopover = document.querySelector(".custom-dropdown-popover");
    expect(statusPopover).not.toBeNull();
    expect(wrapper.find(".custom-dropdown-popover").exists()).toBe(false);
    expect(statusPopover.classList.contains("is-sheet")).toBe(true);
    expect(document.querySelector(".sheet-backdrop")).not.toBeNull();
    expect(spy.mock.calls.some(([el]) => el === statusPopover)).toBe(true);

    document.querySelector(".sheet-backdrop").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
    expect(document.querySelector(".custom-dropdown-popover")).toBeNull();
    wrapper.unmount();

    wrapper = mount(ClassCascadeSelect, {
      attachTo: document.body,
      props: {
        modelValue: null,
        options: [
          {
            name: "Basis Data",
            code: "BD",
            classes: [{ name: "IF-1A", code: "IF-1A", course: "Basis Data", className: "IF-1A" }],
          },
        ],
      },
    });
    await wrapper.get("button.cascade-dropdown-trigger").trigger("click");
    await flushPromises();

    const cascadePopover = document.querySelector(".custom-dropdown-popover");
    expect(cascadePopover).not.toBeNull();
    expect(wrapper.find(".custom-dropdown-popover").exists()).toBe(false);
    expect(cascadePopover.classList.contains("is-sheet")).toBe(true);
    expect(document.querySelector(".sheet-backdrop")).not.toBeNull();
    expect(spy.mock.calls.some(([el]) => el === cascadePopover)).toBe(true);
  });

  it("enforces symmetric mobile bottom-nav columns, active-only label styling, and view-transition isolation", () => {
    const mainCss = readFileSync(resolve(process.cwd(), "src/styles/main.css"), "utf8");
    const primitivesCss = readFileSync(resolve(process.cwd(), "src/motion/primitives.css"), "utf8");

    expect(mainCss).toContain("grid-auto-flow: column");
    expect(mainCss).toContain("grid-auto-columns: minmax(0, 1fr)");
    expect(mainCss).toContain(".mobile-bottom-link:not(.active, [aria-current=\"page\"]) .mobile-nav-label");
    expect(mainCss).toContain("color: var(--green);");
    expect(mainCss).not.toContain("backdrop-filter: blur(14px);");

    expect(primitivesCss).toContain("view-transition-name: liquid-bottom-nav");
    expect(primitivesCss).toContain("view-transition-new(liquid-bottom-nav)");
  });
});
