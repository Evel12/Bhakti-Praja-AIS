import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, disposePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import App from '../../src/App.vue';
import appRouter from '../../src/router/index.js';
import { useAssessmentStore } from '../../src/stores/assessmentStore.js';
import { motionEngine, completed } from '../../src/motion/engine.js';
import { installMedia, installTokenStyles } from './motion-fixture.js';
import { chooseSoftSelect } from './soft-select-fixture.js';

let wrapper, pinia, observers, animate;
beforeEach(() => {
  localStorage.clear();
  observers = [];
  installMedia();
  installTokenStyles();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback) { this.callback = callback; this.nodes = new Set(); observers.push(this); }
    observe(el) { this.nodes.add(el); }
    unobserve(el) { this.nodes.delete(el); }
    disconnect() { this.nodes.clear(); }
    fire() { this.callback([...this.nodes].map(target => ({ target, isIntersecting: true }))); }
  });
  HTMLDialogElement.prototype.showModal = function () { this.open = true; this.querySelector('button')?.focus(); };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  pinia = createPinia();
  setActivePinia(pinia);
  animate = vi.spyOn(motionEngine, 'animate').mockImplementation(() => completed());
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  motionEngine.dispose();
  disposePinia(pinia);
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function open(path) {
  const store = useAssessmentStore();
  store.start(store.db.assessments.find(a => a.id === 'as-network'));
  store.transaction(db => {
    db.attempts.find(a => a.assessmentId === 'as-network' && a.status === 'in_progress').id = 'motion-active';
    db.attempts.find(a => a.id === 'attempt-seed-0').studentId = 'student-demo';
  });
  const router = createRouter({ history: createMemoryHistory(), routes: appRouter.options.routes });
  await router.push(path);
  const host = document.createElement('div');
  host.id = 'app'; document.body.append(host);
  wrapper = mount(App, { attachTo: host, global: { plugins: [pinia, router] } });
  await flushPromises();
  return router;
}
async function deliverObservers() {
  await flushPromises();
  observers.forEach(observer => observer.fire());
  await flushPromises();
}
function expectNoBroadMotion() {
  const broad = animate.mock.calls.filter(([el]) => el.matches('#app,.shell,#main-content,#route-scene,.panel,.bank-card,.help-card'));
  expect(broad.map(([el]) => el.className || el.id)).toEqual([]);
}

it.each(['/dashboard', '/assessments/all', '/builder/as-sql', '/bank', '/results', '/results/as-security', '/grade/task-seed-0', '/student', '/instructions/as-network', '/attempt/motion-active', '/review/attempt-seed-0', '/my-results'])(
  'gives routed content one entrance owner on %s, even when observers fire late', async path => {
    await open(path);
    animate.mockClear();
    await deliverObservers();
    expectNoBroadMotion();
    expect(animate.mock.calls.filter(([el]) => el.closest('#route-scene,.exam-shell'))).toHaveLength(0);
  },
);
it('keeps the entire dashboard still while repeatedly changing class-grade courses', async () => {
  await open('/dashboard');
  for (const course of ['Jaringan Komputer', 'Basis Data', 'Sistem Operasi', 'Jaringan Komputer']) {
    animate.mockClear();
    await chooseSoftSelect(wrapper, 'Mata kuliah', course);
    await deliverObservers();
    expectNoBroadMotion();
    expect(animate).not.toHaveBeenCalled();
  }
});
it('keeps result filters local and cancels route effects before input changes', async () => {
  const router = await open('/dashboard');
  await router.push('/results'); await flushPromises();
  animate.mockClear();
  await chooseSoftSelect(wrapper, 'Kelas', 'Kelas B');
  await deliverObservers(); expectNoBroadMotion();
  await chooseSoftSelect(wrapper, 'Mata kuliah', 'Basis Data');
  await deliverObservers(); expectNoBroadMotion();
  expect(wrapper.text()).toContain('Tidak ada hasil untuk pilihan ini');
});
it('keeps assessment and question-bank searches from animating parent panels', async () => {
  const router = await open('/assessments/all');
  animate.mockClear();
  await wrapper.get('[aria-label="Cari assessment"]').setValue('no match');
  await deliverObservers(); expectNoBroadMotion();
  await router.push('/bank'); await flushPromises(); animate.mockClear();
  await wrapper.get('[aria-label="Cari bank soal"]').setValue('DNS');
  await deliverObservers(); expectNoBroadMotion();
});
it('gives dialogs their own entrance without introducing their panels or page again', async () => {
  await open('/bank'); animate.mockClear();
  await wrapper.findAll('button').find(b => b.text().includes('Tambah soal')).trigger('click');
  await deliverObservers();
  expectNoBroadMotion();
  expect(animate.mock.calls.some(([el]) => el.tagName === 'DIALOG')).toBe(true);
});
