import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import StudentAssessmentView from "../../src/views/student/StudentAssessmentView.vue";
import AssessmentInstructionsView from "../../src/views/student/AssessmentInstructionsView.vue";
import { useAssessmentStore } from "../../src/stores/assessmentStore.js";
import { newAssessment, startAttempt, STUDENT_ID } from "../../src/domain/assessment.js";
import { date, time } from "../../src/utils/format.js";

let pinia, wrapper;
beforeEach(() => {
  localStorage.clear();
  pinia = createPinia();
  setActivePinia(pinia);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T04:00:00Z"));
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  pinia._s.forEach((store) => store.$dispose());
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function assessment(id, open = -1000, close = 600000) {
  return {
    ...newAssessment(), id, title: id, state: "published",
    openAt: new Date(Date.now() + open).toISOString(),
    closeAt: new Date(Date.now() + close).toISOString(),
  };
}
function attempt(a, overrides = {}) {
  return { ...startAttempt(a, [], Date.now()), id: "attempt-" + a.id, ...overrides };
}
function seed(assessments, attempts = []) {
  const store = useAssessmentStore();
  store.transaction((db) => { db.assessments = assessments; db.attempts = attempts; });
  return store;
}
async function open(path = "/student") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/student", component: {} },
      { path: "/instructions/:id", component: {} },
      { path: "/:pathMatch(.*)*", component: {} },
    ],
  });
  await router.push(path);
  wrapper = mount(path === "/student" ? StudentAssessmentView : AssessmentInstructionsView, {
    global: {
      plugins: [pinia, router],
      stubs: { MotionList: { template: '<div><slot /></div>' } },
    },
  });
  await flushPromises();
  return router;
}
const group = (name) => wrapper.get(`[data-assessment-group="${name}"]`);
const titles = (name) => group(name).findAll(".student-card-title").map((heading) => heading.text());

describe("participant task priorities", () => {
  it("puts resumable work before deadline-ordered new work, with upcoming and closed work secondary", async () => {
    const later = assessment("Later deadline", -1000, 800000);
    const soon = assessment("Nearest deadline", -1000, 200000);
    const resume = assessment("Resume this", -1000, 900000);
    const scheduled = assessment("Upcoming", 100000, 1000000);
    const closed = assessment("Closed", -100000, -1000);
    const done = assessment("Submitted");
    seed([later, scheduled, closed, soon, resume, done], [
      attempt(resume),
      attempt(done, { status: "submitted", submittedAt: new Date().toISOString(), score: 0, graded: true }),
    ]);
    await open();
    expect(titles("current")).toEqual(["Resume this", "Nearest deadline", "Later deadline"]);
    expect(titles("upcoming")).toEqual(["Upcoming"]);
    expect(titles("history")).toEqual(["Submitted", "Closed"]);
    expect(group("history").element.tagName).toBe("DETAILS");
    expect(group("history").attributes("open")).toBeUndefined();
    expect(group("current").findAll("a")[0].text()).toContain("Lanjutkan sesi");
    expect(group("upcoming").get("a").text()).toContain("Lihat jadwal");
    expect(group("history").findAll("a")[0].attributes("href")).toBe("/review/attempt-Submitted");
  });

  it("moves an expired stored attempt to history and never advertises it as resumable", async () => {
    const a = assessment("Expired session");
    seed([a], [attempt(a, { expiresAt: new Date(Date.now() - 1000).toISOString() })]);
    await open();
    expect(group("current").text()).toContain("Tidak ada tugas aktif saat ini");
    expect(group("current").find(".student-card").exists()).toBe(false);
    const saved = group("history").get("a");
    expect(saved.text()).toContain("Lihat sesi tersimpan");
    expect(saved.attributes("href")).toBe("/instructions/Expired session");
    expect(group("history").text()).toContain("Waktu habis");
    expect(wrapper.text()).not.toContain("Lanjutkan sesi");
  });

  it("updates upcoming, active and expired session states at their exact boundaries", async () => {
    const scheduled = assessment("Boundary", 1000, 5000);
    const expiring = assessment("Attempt boundary", -1000, 100000);
    seed([scheduled, expiring], [attempt(expiring, { expiresAt: new Date(Date.now() + 2000).toISOString() })]);
    await open();
    expect(titles("upcoming")).toEqual(["Boundary"]);
    expect(titles("current")).toEqual(["Attempt boundary"]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(wrapper.find('[data-assessment-group="upcoming"]').exists()).toBe(false);
    expect(titles("current")).toEqual(["Attempt boundary", "Boundary"]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(titles("current")).toEqual(["Boundary"]);
    expect(titles("history")).toEqual(["Attempt boundary"]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(group("current").text()).toContain("Tidak ada tugas aktif saat ini");
    expect(titles("history")).toEqual(["Attempt boundary", "Boundary"]);
  });

  it("keeps draft, archived, other-class and another student's attempts out of current task decisions", async () => {
    const current = assessment("Available");
    seed([
      current,
      { ...assessment("Draft"), state: "draft" },
      { ...assessment("Archived"), state: "archived" },
      { ...assessment("Other class"), className: "Kelas B" },
    ], [attempt(current, { studentId: STUDENT_ID + "-other", status: "submitted" })]);
    await open();
    expect(titles("current")).toEqual(["Available"]);
    expect(group("current").get("a").text()).toContain("Lihat petunjuk");
    expect(wrapper.find('[data-assessment-group="history"]').exists()).toBe(false);
  });
});

describe("participant availability explanations", () => {
  it("explains the scheduled opening in WIB and enables the start flow when it opens", async () => {
    const a = assessment("scheduled", 1000, 10000);
    seed([a]);
    await open("/instructions/scheduled");
    expect(wrapper.get('[role="status"]').text()).toBe(`Assessment dibuka pada ${date(a.openAt)} · ${time(a.openAt)} WIB.`);
    expect(wrapper.find('button').exists()).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    expect(wrapper.get("button").text()).toBe("Mulai assessment");
    expect(wrapper.get("button").attributes("disabled")).toBeDefined();
  });

  it("shows the actual closing time and preserves access to an existing stored session", async () => {
    const a = assessment("closed");
    const prior = attempt(a);
    a.closeAt = new Date(Date.now() - 1000).toISOString();
    seed([a], [prior]);
    await open("/instructions/closed");
    expect(wrapper.get('[role="status"]').text()).toContain(`Assessment ditutup pada ${date(a.closeAt)} · ${time(a.closeAt)} WIB.`);
    expect(wrapper.find("button").exists()).toBe(false);
    const links = wrapper.findAll("a");
    expect(links.some((link) => link.attributes("href") === "/attempt/attempt-closed" && link.text() === "Buka sesi tersimpan")).toBe(true);
    expect(links.some((link) => link.attributes("href") === "/student")).toBe(true);
  });

  it("explains an expired attempt even while the assessment remains open", async () => {
    const a = assessment("expired");
    const prior = attempt(a, { expiresAt: new Date(Date.now() - 1000).toISOString() });
    seed([a], [prior]);
    await open("/instructions/expired");
    expect(wrapper.get('[role="status"]').text()).toContain(`Waktu pengerjaan berakhir pada ${date(prior.expiresAt)} · ${time(prior.expiresAt)} WIB.`);
    expect(wrapper.text()).toContain("Sesi tersimpan tetap dapat dibuka");
    expect(wrapper.find("button").exists()).toBe(false);
  });
});
