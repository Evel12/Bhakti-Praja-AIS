import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import StatusFilterDropdown from "../../src/components/ui/StatusFilterDropdown.vue";
import ClassCascadeSelect from "../../src/components/ui/ClassCascadeSelect.vue";
import DashboardView from "../../src/views/teacher/DashboardView.vue";
import AssessmentBuilderView from "../../src/views/teacher/AssessmentBuilderView.vue";
import TeacherClassesView from "../../src/views/lms/TeacherClassesView.vue";
import { useAssessmentStore } from "../../src/stores/assessmentStore.js";
import { apiClient, setStoredSession, setStoredToken } from "../../src/services/apiClient.js";

let pinia;
let wrapper;

beforeEach(() => {
  localStorage.clear();
  pinia = createPinia();
  setActivePinia(pinia);
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
  wrapper?.unmount();
  wrapper = undefined;
  pinia?._s?.forEach((store) => store.$dispose());
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Teacher UI audit improvements", () => {
  it("supports full keyboard navigation and focus restoration in StatusFilterDropdown", async () => {
    wrapper = mount(StatusFilterDropdown, {
      attachTo: document.body,
      props: {
        modelValue: "all",
        options: [
          { value: "all", label: "Semua Status", count: 5 },
          { value: "Aktif", label: "Aktif", count: 2 },
          { value: "Draft", label: "Draft", count: 3 },
        ],
      },
    });

    const trigger = wrapper.get("#status-filter");
    trigger.element.focus();
    await trigger.trigger("keydown", { key: "ArrowDown" });
    await flushPromises();

    const optionButtons = wrapper.findAll('button[role="option"]');
    expect(optionButtons).toHaveLength(3);
    expect(document.activeElement).toBe(optionButtons[0].element);

    await optionButtons[0].trigger("keydown", { key: "ArrowDown" });
    expect(document.activeElement).toBe(optionButtons[1].element);

    await optionButtons[1].trigger("keydown", { key: "End" });
    expect(document.activeElement).toBe(optionButtons[2].element);

    await optionButtons[2].trigger("keydown", { key: "Home" });
    expect(document.activeElement).toBe(optionButtons[0].element);

    await optionButtons[1].trigger("click");
    await flushPromises();
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["Aktif"]);
    expect(document.activeElement).toBe(trigger.element);
  });

  it("supports keyboard tree navigation in ClassCascadeSelect and mobile submenu toggling", async () => {
    wrapper = mount(ClassCascadeSelect, {
      attachTo: document.body,
      props: {
        modelValue: null,
        options: [
          {
            name: "Basis Data",
            code: "BD",
            classes: [
              { name: "Kelas A", code: "BD-A", course: "Basis Data", className: "Kelas A" },
              { name: "Kelas B", code: "BD-B", course: "Basis Data", className: "Kelas B" },
            ],
          },
        ],
      },
    });

    const trigger = wrapper.get("#class-cascade");
    trigger.element.focus();
    await trigger.trigger("keydown", { key: "ArrowDown" });
    await flushPromises();

    const topButtons = wrapper.findAll('[data-cascade-level="top"]');
    expect(topButtons).toHaveLength(2);
    expect(document.activeElement).toBe(topButtons[0].element);

    await topButtons[0].trigger("keydown", { key: "ArrowDown" });
    expect(document.activeElement).toBe(topButtons[1].element);

    await topButtons[1].trigger("keydown", { key: "ArrowRight" });
    await flushPromises();

    const subButtons = wrapper.findAll(".cascade-sub-flyout button[role='treeitem']");
    expect(subButtons).toHaveLength(2);
    expect(document.activeElement).toBe(subButtons[0].element);

    await subButtons[0].trigger("keydown", { key: "ArrowDown" });
    expect(document.activeElement).toBe(subButtons[1].element);

    await subButtons[1].trigger("keydown", { key: "ArrowLeft" });
    await flushPromises();
    expect(document.activeElement).toBe(topButtons[1].element);

    await topButtons[1].trigger("keydown", { key: "Escape" });
    await flushPromises();
    expect(wrapper.find(".custom-dropdown-popover").exists()).toBe(false);
    expect(document.activeElement).toBe(trigger.element);
    wrapper.unmount();

    // Verify mobile sheet can collapse an already-expanded parent course on second click
    vi.stubGlobal("matchMedia", (q) => ({
      matches: q === "(max-width: 768px)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    wrapper = mount(ClassCascadeSelect, {
      attachTo: document.body,
      props: {
        modelValue: null,
        options: [
          {
            name: "Basis Data",
            code: "BD",
            classes: [{ name: "Kelas A", code: "BD-A", course: "Basis Data", className: "Kelas A" }],
          },
        ],
      },
    });
    await wrapper.get("#class-cascade").trigger("click");
    await flushPromises();
    const courseBtn = wrapper.get(".cascade-parent-item > button");
    await courseBtn.trigger("click");
    expect(wrapper.find(".cascade-sub-flyout").exists()).toBe(true);
    await courseBtn.trigger("click");
    expect(wrapper.find(".cascade-sub-flyout").exists()).toBe(false);
  });

  it("marks DashboardView class grade actions with .register-actions", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/dashboard", component: DashboardView },
        { path: "/results/:id?", component: { template: "<div />" } },
        { path: "/assessments/:status?", component: { template: "<div />" } },
        { path: "/bank", component: { template: "<div />" } },
        { path: "/builder/:id", component: { template: "<div />" } },
        { path: "/grade/:id", component: { template: "<div />" } },
      ],
    });
    await router.push("/dashboard");
    await router.isReady();

    wrapper = mount(DashboardView, {
      global: { plugins: [pinia, router] },
    });
    await flushPromises();

    expect(wrapper.find(".class-grades-table td.register-actions .register-link").exists()).toBe(true);
  });

  it("filters questions inside the scrollable AssessmentBuilderView bank dialog", async () => {
    const store = useAssessmentStore();
    const draftId = store.create();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/builder/:id", component: AssessmentBuilderView },
        { path: "/assessments/:status?", component: { template: "<div />" } },
      ],
    });
    await router.push(`/builder/${draftId}`);
    await router.isReady();

    wrapper = mount(AssessmentBuilderView, {
      attachTo: document.body,
      global: { plugins: [pinia, router] },
    });
    await flushPromises();

    // Advance to step 1 (Konten)
    await wrapper.findAll(".step")[1].trigger("click");
    await flushPromises();

    const bankBtn = wrapper.findAll("button").find((b) => b.text().includes("Dari bank soal"));
    expect(bankBtn).toBeTruthy();
    await bankBtn.trigger("click");
    await flushPromises();

    expect(wrapper.find("dialog[open] .bank-picker-list").exists()).toBe(true);
    const totalCount = wrapper.findAll("dialog[open] .bank-picker").length;
    expect(totalCount).toBeGreaterThan(1);

    const searchInput = wrapper.get('dialog[open] input[aria-label="Cari soal dari bank"]');
    await searchInput.setValue("zzz-tidak-ada-kecocokan");
    await flushPromises();
    expect(wrapper.findAll("dialog[open] .bank-picker")).toHaveLength(0);
    expect(wrapper.get("dialog[open]").text()).toContain("Tidak ada soal di bank");
  });

  it("submits TeacherClassesView dialogs using official AppDialog #footer actions", async () => {
    setStoredToken("live-teacher-token");
    setStoredSession({
      user: { id: 10, name: "Guru Biologi", email: "guru@test.id", role: "teacher" },
      apiConnected: true,
    });
    const classRecord = {
      id: 1,
      name: "Biologi X",
      description: "Sel",
      class_code: "BIOX",
      teacher_id: 10,
      students_count: 1,
    };
    vi.spyOn(apiClient, "listClasses").mockResolvedValue({ items: [classRecord] });
    vi.spyOn(apiClient, "getClass").mockResolvedValue(classRecord);
    vi.spyOn(apiClient, "listModules").mockResolvedValue({ items: [] });
    vi.spyOn(apiClient, "listClassAssignments").mockResolvedValue({ items: [] });
    vi.spyOn(apiClient, "listClassAnnouncements").mockResolvedValue({ items: [] });
    vi.spyOn(apiClient, "listClassQuizzes").mockResolvedValue({ data: [] });
    vi.spyOn(apiClient, "getClassProgress").mockResolvedValue({ students: [] });
    const createSpy = vi.spyOn(apiClient, "createClass").mockResolvedValue({
      id: 2,
      name: "Fisika XI",
      description: "Mekanika",
      class_code: "FIS11",
      teacher_id: 10,
    });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/classes/:id?", component: TeacherClassesView },
        { path: "/assessments/:status?", component: { template: "<div />" } },
        { path: "/builder/:id", component: { template: "<div />" } },
        { path: "/results/:id", component: { template: "<div />" } },
      ],
    });
    await router.push("/classes/1");
    await router.isReady();

    wrapper = mount(TeacherClassesView, {
      attachTo: document.body,
      global: { plugins: [pinia, router] },
    });
    await flushPromises();

    const newClassBtn = wrapper.findAll("button").find((b) => b.text().includes("Buat kelas"));
    await newClassBtn.trigger("click");
    await flushPromises();

    const openDialog = wrapper.get("dialog[open]");
    expect(openDialog.find(".dialog-footer .btn.primary").exists()).toBe(true);
    expect(openDialog.find(".lms-dialog-actions").exists()).toBe(false);

    await openDialog.get("input[type='text']").setValue("Fisika XI");
    await openDialog.get("textarea").setValue("Mekanika");
    await openDialog.get(".dialog-footer .btn.primary").trigger("click");
    await flushPromises();

    expect(createSpy).toHaveBeenCalledWith({
      name: "Fisika XI",
      description: "Mekanika",
    });
  });
});
