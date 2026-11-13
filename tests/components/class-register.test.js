import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import DashboardView from "../../src/views/teacher/DashboardView.vue";
import ResultsView from "../../src/views/teacher/ResultsView.vue";
import AssignmentGradeView from "../../src/views/teacher/AssignmentGradeView.vue";
import { useAssessmentStore } from "../../src/stores/assessmentStore.js";
import appRouter from "../../src/router/index.js";
import { chooseSoftSelect } from "./soft-select-fixture.js";

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
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: "/dashboard", component: DashboardView },
    { path: "/results/:id?", component: ResultsView },
    { path: "/grade/:id", component: AssignmentGradeView },
    { path: "/assessments/:status", component: { template: "<p>Drafts</p>" } },
  ] });
  await router.push(path);
  wrapper = mount(RouterView, { attachTo: document.body, global: { plugins: [pinia, router], stubs: {
    AppDialog: { props: ["open"], template: '<div v-if="open"><slot /><slot name="footer" /></div>' },
    MotionField: { template: "<div><slot /></div>" },
    MotionList: { props: { as: { default: "div" } }, template: '<component :is="as"><slot /></component>' },
  } } });
  await flushPromises();
  return router;
}
const scope = { class: "Kelas A", course: "Basis Data" };
const findLink = (text) => wrapper.findAll("a").find((link) => link.text().includes(text));

describe("class comparison and class register", () => {
  it("shows course-specific class grades and opens the correctly scoped register", async () => {
    const router = await open("/dashboard");
    expect(wrapper.find(".sparkline").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Siap dikerjakan");
    await chooseSoftSelect(wrapper, "Mata kuliah", "Jaringan Komputer");
    expect(wrapper.get('.class-grade-average').text()).toBe("84/100");
    expect(wrapper.findAll('.class-grades-table tbody tr')).toHaveLength(1);
    await wrapper.get('.class-grades-table .register-link').trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({ class: "Kelas A", course: "Jaringan Komputer" });
    expect(wrapper.findAll('.result-register-row')).toHaveLength(2);
    expect(wrapper.get('.register-summary').text()).toContain("6 pengumpulan");
  });

  it("combines class/course/pending filters without losing select focus or their query state", async () => {
    const router = await open("/results");
    expect(wrapper.findAll('.result-register-row')).toHaveLength(5);
    const select = wrapper.findAll('.register-filters [role="combobox"]')[0];
    select.element.focus();
    await chooseSoftSelect(wrapper, "Kelas", "Kelas B");
    await flushPromises();
    expect(document.activeElement).toBe(select.element);
    expect(wrapper.findAll('.result-register-row')).toHaveLength(1);
    expect(wrapper.get('.result-register-row').text()).toContain("Ujian Tengah Semester");
    await chooseSoftSelect(wrapper, "Mata kuliah", "Basis Data");
    await flushPromises();
    expect(wrapper.get('[role="status"]').text()).toContain("Tidak ada hasil untuk pilihan ini");
    expect(router.currentRoute.value.query).toEqual({ class: "Kelas B", course: "Basis Data" });
    await findLink("Lihat semua hasil").trigger("click");
    await flushPromises();
    expect(wrapper.findAll('.result-register-row')).toHaveLength(5);
    await findLink("Perlu dinilai").trigger("click");
    await flushPromises();
    expect(wrapper.findAll('.result-register-row')).toHaveLength(1);
    expect(wrapper.get('.register-summary').text()).toContain("3 perlu dinilai");
    expect(wrapper.text()).not.toContain("0/0");
  });

  it("preserves the chosen class and course through grading, saving and the return to the register", async () => {
    const router = await open({ path: "/results", query: { ...scope, filter: "pending" } });
    await wrapper.get('.register-grade').trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/grade/task-seed-0");
    expect(router.currentRoute.value.query).toEqual({ queue: "pending", ...scope });
    await wrapper.get('.grade-score').setValue("88");
    await wrapper.get('form').trigger("submit");
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({ filter: "pending", ...scope });
    expect(wrapper.findAll('tbody tr')).toHaveLength(2);
    expect(wrapper.get('.stat-grid').text()).toContain("Pengumpulan3");
    expect(wrapper.get('.stat-grid').text()).toContain("Perlu dinilai2");
    expect(wrapper.get('.stat-grid').text()).toContain("Rata-rata nilai88");
    const releaseButton = wrapper.findAll('button').find((button) => button.text() === 'Rilis hasil');
    expect(releaseButton.element.disabled).toBe(true);
    await wrapper.get('.builder-footer a').trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/results");
    expect(router.currentRoute.value.query).toEqual({ filter: "pending", ...scope });
    expect(wrapper.get('.register-summary').text()).toContain("3 pengumpulan");
    expect(wrapper.get('.register-summary').text()).toContain("2 perlu dinilai");
    expect(wrapper.get('.register-average').text()).toBe("88");
    expect(wrapper.get('.register-grade').attributes('href')).toContain('/grade/task-seed-1?');
  });

  it("retains register filters through detail mode changes and the return link", async () => {
    const router = await open({ path: "/results", query: scope });
    await wrapper.get('.register-title').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/results/as-database');
    await findLink('Perlu dinilai').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({ ...scope, filter: 'pending' });
    await findLink('Semua pengumpulan').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual(scope);
    await wrapper.get('.builder-footer a').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual(scope);
    expect(wrapper.findAll('.result-register-row')).toHaveLength(1);
  });

  it("recovers from a stale class link instead of silently broadening the results", async () => {
    await open({ path: '/results', query: { class: 'Kelas lama', course: 'Mata kuliah lama' } });
    expect(wrapper.find('.result-register-table').exists()).toBe(false);
    expect(wrapper.get('[role="status"]').text()).toContain('Tidak ada hasil untuk pilihan ini');
    expect(wrapper.findAll('.register-filters [role="combobox"]')[0].text()).toContain('Kelas lama (tidak tersedia)');
    await findLink('Lihat semua hasil').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.result-register-row')).toHaveLength(5);
  });

  it("does not scroll a class filter update back to the top", () => {
    const behavior = appRouter.options.scrollBehavior;
    expect(behavior({ path: '/results', meta: {} }, { path: '/results', meta: {} })).toBe(false);
    expect(behavior({ path: '/results/as-network', meta: {} }, { path: '/results', meta: {} })).toEqual({ top: 0 });
  });
  it("shows exactly one row action and opens results from the assessment title", async () => {
    const router = await open('/results');
    const rows = wrapper.findAll('.result-register-row');
    rows.forEach(row => expect(row.findAll('.register-actions a')).toHaveLength(1));
    const pending = rows.find(row => row.text().includes('Perancangan Basis Data'));
    expect(pending.get('.register-grade').classes()).toContain('primary');
    expect(pending.find('.register-review').exists()).toBe(false);
    expect(pending.get('.register-progress').text()).toContain('3 perlu dinilai');
    const completed = rows.find(row => row.text().includes('Dasar Keamanan Jaringan'));
    expect(completed.get('.register-review').text()).toContain('Tinjau hasil');
    await pending.get('.register-title').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/results/as-database');
  });
});
