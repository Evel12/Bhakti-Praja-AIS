import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import App from "../../src/App.vue";
import appRouter from "../../src/router/index.js";
import { motionEngine } from "../../src/motion/engine.js";
import { useAssessmentStore } from "../../src/stores/assessmentStore.js";
import { useLmsStore } from "../../src/stores/lmsStore.js";
import { installMedia, installTokenStyles } from "./motion-fixture.js";

let wrapper;
beforeEach(() => {
  localStorage.clear();
  installMedia();
  installTokenStyles();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});
afterEach(() => {
  wrapper?.unmount();
  motionEngine.dispose();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("preserves the assessment page, search and focus while fading only results on status changes", async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: appRouter.options.routes,
  });
  await router.push("/assessments/all");
  const host = document.createElement("div");
  host.id = "app";
  document.body.append(host);
  wrapper = mount(App, {
    attachTo: host,
    global: { plugins: [createPinia(), router], stubs: { AppDialog: true } },
  });
  await flushPromises();
  expect(wrapper.findAll('#sidebar [aria-label="Assessment"]')).toHaveLength(1);
  expect(wrapper.find("#assessment-submenu").exists()).toBe(false);
  expect(wrapper.find("#status-filter").exists()).toBe(true);
  expect(wrapper.find("#class-cascade").exists()).toBe(true);
  const panel = wrapper.get(".panel").element;
  const title = wrapper.get(".page-title").element;
  const results = wrapper.get(".assessment-results").element;
  await wrapper.get('[aria-label="Cari assessment"]').setValue("no matching assessment");
  const statusFilter = wrapper.get("#status-filter");
  statusFilter.element.focus();
  const animate = vi.spyOn(motionEngine, "animate");
  await router.push("/assessments/Draft");
  await flushPromises();
  expect(router.currentRoute.value.path).toBe("/assessments/Draft");
  expect(wrapper.get(".panel").element).toBe(panel);
  expect(wrapper.get(".page-title").element).toBe(title);
  expect(wrapper.get(".assessment-results").element).toBe(results);
  expect(wrapper.get('[aria-label="Cari assessment"]').element.value).toBe("no matching assessment");
  expect(wrapper.get(".assessment-results .empty").exists()).toBe(true);
  expect(animate.mock.calls.some(([target, to, options]) =>
    target === results && to.opacity === 1 && options.from.opacity === 0,
  )).toBe(true);
  expect(animate.mock.calls.some(([target]) =>
    [panel, title, wrapper.get("#route-scene").element].includes(target),
  )).toBe(false);
  await router.push("/assessments/Aktif");
  await flushPromises();
  expect(wrapper.get(".assessment-results").element).toBe(results);
  expect(document.querySelector(".liquid-exit-ghost")).toBeNull();
});

it("sorts teacher assessments via clickable table headers without a toolbar sort dropdown while working with StatusFilterDropdown, ClassCascadeSelect, and Reset Filter", async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: appRouter.options.routes,
  });
  await router.push("/assessments/all");
  const host = document.createElement("div");
  host.id = "app";
  document.body.append(host);
  wrapper = mount(App, {
    attachTo: host,
    global: { plugins: [createPinia(), router], stubs: { AppDialog: true } },
  });
  await flushPromises();

  const rowTitles = () =>
    wrapper.findAll(".assessment-results tbody tr .assessment-title").map((el) => el.text());

  const initialOrder = rowTitles();
  expect(initialOrder.length).toBeGreaterThan(2);

  // Click "Assessment" column header -> A-Z -> Z-A -> default store order
  const titleHeaderBtn = () =>
    wrapper.findAll("thead th button.table-sort-btn").find((b) => b.text().includes("Assessment"));
  await titleHeaderBtn().trigger("click");
  await flushPromises();

  const sortedAsc = [...initialOrder].sort((a, b) =>
    a.localeCompare(b, "id", { sensitivity: "base", numeric: true }),
  );
  expect(rowTitles()).toEqual(sortedAsc);
  expect(wrapper.get('thead th[aria-sort="ascending"]').text()).toContain("Assessment");
  expect(wrapper.text()).toContain("Urut: Judul (A–Z)");

  await titleHeaderBtn().trigger("click");
  await flushPromises();
  expect(rowTitles()).toEqual([...sortedAsc].reverse());
  expect(wrapper.get('thead th[aria-sort="descending"]').text()).toContain("Assessment");

  await titleHeaderBtn().trigger("click");
  await flushPromises();
  expect(rowTitles()).toEqual(initialOrder);
  expect(wrapper.find(".toolbar-summary").exists()).toBe(false);

  expect(wrapper.find(".toolbar-sort-select").exists()).toBe(false);

  // Click "Terkirim" column header -> desc ("Terkirim terbanyak") without animating .panel
  const animate = vi.spyOn(motionEngine, "animate");
  const panel = wrapper.get(".panel").element;
  const submittedHeaderBtn = () =>
    wrapper.findAll("thead th button.table-sort-btn").find((b) => b.text().includes("Terkirim"));
  await submittedHeaderBtn().trigger("click");
  await flushPromises();
  expect(wrapper.get('thead th[aria-sort="descending"]').text()).toContain("Terkirim");
  expect(wrapper.text()).toContain("Urut: Terkirim terbanyak");
  expect(animate.mock.calls.some(([target]) => target === panel)).toBe(false);

  // Combine with ClassCascadeSelect filter + verify Reset Filter clears both filter and sort
  await wrapper.get("#class-cascade").trigger("click");
  await flushPromises();
  const networkBtn = wrapper
    .findAll(".cascade-parent-item > button")
    .find((b) => b.text().includes("Jaringan Komputer"));
  await networkBtn.trigger("click");
  await flushPromises();
  const allNetworkOption = wrapper
    .findAll(".cascade-sub-flyout [role='treeitem']")
    .find((li) => li.text().includes("Semua Jaringan Komputer"));
  await allNetworkOption.trigger("click");
  await flushPromises();

  const visibleRows = wrapper.findAll(".assessment-results tbody tr");
  expect(visibleRows.length).toBeGreaterThan(0);
  expect(visibleRows.every((row) => row.text().includes("Jaringan Komputer"))).toBe(true);
  expect(wrapper.get(".toolbar-summary").text()).toContain(`Menampilkan ${visibleRows.length} assessment`);

  await wrapper.get(".btn-reset-filters").trigger("click");
  await flushPromises();
  expect(rowTitles()).toEqual(initialOrder);
  expect(wrapper.find(".toolbar-summary").exists()).toBe(false);
});

it("synchronizes Pilih Kelas options and Assessment Kelas data with Kelas page (lmsStore)", async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: appRouter.options.routes,
  });
  await router.push("/assessments/all");
  const host = document.createElement("div");
  host.id = "app";
  document.body.append(host);
  const pinia = createPinia();
  wrapper = mount(App, {
    attachTo: host,
    global: { plugins: [pinia, router], stubs: { AppDialog: true } },
  });
  await flushPromises();

  const lmsStore = useLmsStore();
  const assessmentStore = useAssessmentStore();
  lmsStore.classes = [
    { id: 91, name: "Biologi XI · Kelas D", class_code: "BIOX91" },
  ];

  const createdId = assessmentStore.create(undefined, {
    course: "Biologi XI",
    className: "Kelas D",
    backendClassId: 91,
  });
  assessmentStore.transaction((data) => {
    const target = data.assessments.find((a) => a.id === createdId);
    target.title = "Evaluasi Genetika";
    target.state = "published";
  });
  await flushPromises();

  await wrapper.get("#class-cascade").trigger("click");
  await flushPromises();
  const bioCourseBtn = wrapper
    .findAll(".cascade-parent-item > button")
    .find((b) => b.text().includes("Biologi XI"));
  expect(bioCourseBtn).toBeTruthy();
  await bioCourseBtn.trigger("click");
  await flushPromises();

  const kelasDOption = wrapper
    .findAll(".cascade-sub-flyout [role='treeitem']")
    .find((li) => li.text() === "Kelas D");
  expect(kelasDOption).toBeTruthy();
  await kelasDOption.trigger("click");
  await flushPromises();

  expect(wrapper.text()).toContain("Evaluasi Genetika");
  expect(wrapper.text()).toContain("Biologi XI · Kelas D");

  // Simulate renaming the class on Kelas Page -> Assessment Kelas data updates immediately
  assessmentStore.applyLmsClassUpdate({ id: 91, name: "Biologi XII · Kelas E" }, "Biologi XI · Kelas D");
  await flushPromises();
  expect(wrapper.text()).toContain("Biologi XII · Kelas E");
});
