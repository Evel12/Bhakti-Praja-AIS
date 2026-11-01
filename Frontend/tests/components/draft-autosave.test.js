import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import AssessmentBuilderView from "../../src/views/teacher/AssessmentBuilderView.vue";
import { useAssessmentStore } from "../../src/stores/assessmentStore.js";
import { STORAGE_KEY } from "../../src/domain/assessment.js";

let wrapper, pinia;
beforeEach(() => {
  localStorage.clear();
  pinia = createPinia();
  setActivePinia(pinia);
  vi.useFakeTimers();
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  pinia._s.forEach((store) => store.$dispose());
  vi.restoreAllMocks();
  vi.useRealTimers();
});
async function open(id) {
  const store = useAssessmentStore();
  id ||= store.create();
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/builder/:id", component: AssessmentBuilderView },
      { path: "/assessments/all", component: { template: "<p>Assessment</p>" } },
    ],
  });
  await router.push(`/builder/${id}`);
  wrapper = mount(RouterView, {
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
const title = () => wrapper.get('input[placeholder="Contoh: Kuis Arsitektur Jaringan"]');
const savedDraft = (id) => JSON.parse(localStorage.getItem(STORAGE_KEY)).assessments.find((a) => a.id === id);

describe("unfinished assessment recovery", () => {
  it("debounces edits and reloads incomplete questions from acknowledged storage", async () => {
    const { id } = await open();
    const writes = vi.spyOn(Storage.prototype, "setItem");
    await title().setValue("Draft pertama");
    await vi.advanceTimersByTimeAsync(400);
    await title().setValue("Draft terbaru");
    await vi.advanceTimersByTimeAsync(599);
    expect(writes).not.toHaveBeenCalled();
    expect(wrapper.get('[role="status"]').text()).toBe("Menyimpan…");
    await vi.advanceTimersByTimeAsync(1);
    expect(writes).toHaveBeenCalledTimes(1);
    await wrapper.findAll(".step")[1].trigger("click");
    await wrapper.get(".question-editor textarea").setValue("Pertanyaan belum selesai 📝");
    await wrapper.get('[aria-label="Pilihan A"]').setValue("Pilihan pertama");
    await vi.advanceTimersByTimeAsync(600);
    expect(wrapper.get('[role="status"]').text()).toBe("Draft tersimpan");
    expect(savedDraft(id).questions[0].options[1]).toBe("");
    expect(savedDraft(id).state).toBe("draft");
    wrapper.unmount();
    wrapper = undefined;
    pinia._s.forEach((store) => store.$dispose());
    pinia = createPinia();
    setActivePinia(pinia);
    await open(id);
    expect(title().element.value).toBe("Draft terbaru");
    await wrapper.findAll(".step")[1].trigger("click");
    expect(wrapper.get(".question-editor textarea").element.value).toBe("Pertanyaan belum selesai 📝");
    expect(wrapper.get('[aria-label="Pilihan A"]').element.value).toBe("Pilihan pertama");
  });

  it("flushes the last keystroke before refresh without warning after a successful write", async () => {
    const { id } = await open();
    const writes = vi.spyOn(Storage.prototype, "setItem");
    await title().setValue("Sebelum refresh");
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(savedDraft(id).title).toBe("Sebelum refresh");
    await vi.advanceTimersByTimeAsync(1000);
    expect(writes).toHaveBeenCalledTimes(1);
  });

  it.each(["visibilitychange", "pagehide"])("flushes pending work on %s", async (type) => {
    const { id } = await open();
    const writes = vi.spyOn(Storage.prototype, "setItem");
    await title().setValue("Disimpan saat beralih aplikasi");
    if (type === "visibilitychange") {
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
      document.dispatchEvent(new Event(type));
    } else window.dispatchEvent(new Event(type));
    expect(savedDraft(id).title).toBe("Disimpan saat beralih aplikasi");
    await vi.advanceTimersByTimeAsync(1000);
    expect(writes).toHaveBeenCalledTimes(1);
  });

  it("keeps failed edits open, blocks accidental exit and allows a manual retry", async () => {
    const { id, router, store } = await open();
    const before = localStorage.getItem(STORAGE_KEY);
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    await title().setValue("Tetap terbuka");
    await vi.advanceTimersByTimeAsync(600);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
    expect(store.db.assessments.find((a) => a.id === id).title).toBe("");
    expect(wrapper.get('[role="status"]').text()).toBe("Draft belum tersimpan");
    expect(wrapper.get('[role="alert"]').text()).toContain("Simpan draft");
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await router.push("/assessments/all");
    expect(router.currentRoute.value.path).toBe(`/builder/${id}`);
    expect(title().element.value).toBe("Tetap terbuka");
    write.mockRestore();
    await wrapper.get(".page-title button").trigger("click");
    expect(savedDraft(id).title).toBe("Tetap terbuka");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.get('[role="status"]').text()).toBe("Draft tersimpan");
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
  });

  it("flushes on app navigation and removes timers and exit listeners on unmount", async () => {
    const { id, router } = await open();
    await title().setValue("Sebelum berpindah halaman");
    await router.push("/assessments/all");
    expect(savedDraft(id).title).toBe("Sebelum berpindah halaman");
    const writes = vi.spyOn(Storage.prototype, "setItem");
    window.dispatchEvent(new Event("pagehide"));
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("beforeunload", { cancelable: true }));
    await vi.advanceTimersByTimeAsync(1000);
    expect(writes).not.toHaveBeenCalled();
  });

  it("cancels pending autosave after publication so it cannot restore a draft", async () => {
    const store = useAssessmentStore();
    const id = store.duplicate(store.db.assessments.find((a) => a.state === "published"));
    const { router } = await open(id);
    await title().setValue("Siap diterbitkan");
    await wrapper.findAll(".step")[3].trigger("click");
    await wrapper.get(".builder-footer .primary").trigger("click");
    const writes = vi.spyOn(Storage.prototype, "setItem");
    await wrapper.findAll("button").find((button) => button.text() === "Ya, terbitkan").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/assessments/all");
    await vi.advanceTimersByTimeAsync(1000);
    expect(writes).toHaveBeenCalledTimes(1);
    expect(savedDraft(id).state).toBe("published");
    expect(savedDraft(id).title).toBe("Siap diterbitkan");
  });

  it("does not write read-only published assessments", async () => {
    const store = useAssessmentStore();
    const published = store.db.assessments.find((a) => a.state === "published");
    const writes = vi.spyOn(Storage.prototype, "setItem");
    await open(published.id);
    window.dispatchEvent(new Event("pagehide"));
    await vi.advanceTimersByTimeAsync(1000);
    wrapper.unmount();
    wrapper = undefined;
    expect(writes).not.toHaveBeenCalled();
  });
});
