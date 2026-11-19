import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { apiClient, getStoredSession, getStoredToken } from "../../../src/assessment-module/services/apiClient.js";
import { mountAssessmentApp } from "../../../src/assessment-module/integration/mountEmbedded.js";
import { installMedia, installTokenStyles } from "./motion-fixture.js";

let mounted;
let container;

beforeEach(() => {
  localStorage.clear();
  installMedia();
  installTokenStyles();
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  container = document.createElement("div");
  container.className = "assessment-root";
  document.body.appendChild(container);
});

afterEach(() => {
  mounted?.destroy();
  mounted = undefined;
  container?.remove();
  container = undefined;
  delete globalThis.__AIS_COMBINED_SHELL__;
  vi.restoreAllMocks();
});

describe("Combined In-Process Assessment Mount Bridge", () => {
  it("mounts teacher workspace without duplicate sidebar/topbar and syncs routes bidirectionally", async () => {
    vi.spyOn(apiClient, "exchangeAisSession").mockResolvedValue({
      token: "assessment-token-teacher",
      user: {
        id: 7,
        name: "Pak Budi",
        email: "budi@bhaktiprajabatang.sch.id",
        role: "teacher",
      },
    });
    vi.spyOn(apiClient, "listClasses").mockResolvedValue({ items: [] });
    vi.spyOn(apiClient, "listQuestionBank").mockResolvedValue([]);
    vi.spyOn(apiClient, "listNotifications").mockResolvedValue({ items: [], unread_count: 3 });

    const routeChanges = [];
    const unreadUpdates = [];
    const examStates = [];

    mounted = await mountAssessmentApp(container, {
      user: { id: 7, name: "Pak Budi", email: "budi@bhaktiprajabatang.sch.id", role: "guru" },
      aisToken: "ais-token-7",
      initialSubpath: "/",
      onRouteChange: (path) => routeChanges.push(path),
      onUnreadChange: (count) => unreadUpdates.push(count),
      onExamModeChange: (exam) => examStates.push(exam),
    });

    await nextTick();
    await new Promise((r) => setTimeout(r, 20));

    expect(getStoredToken()).toBe("assessment-token-teacher");
    expect(getStoredSession()?.user?.aisRole).toBe("guru");
    expect(container.querySelector("#sidebar")).toBeNull();
    expect(container.querySelector(".topbar")).toBeNull();
    expect(container.querySelector(".mobile-bottom-nav")).toBeNull();
    expect(container.querySelector(".assessment-embedded-stage")).not.toBeNull();
    expect(routeChanges.at(-1)).toBe("/dashboard");
    expect(examStates.at(-1)).toBe(false);
    expect(unreadUpdates).toContain(3);

    await mounted.navigateTo("/bank");
    await nextTick();
    expect(container.textContent).toContain("Bank soal");
  });

  it("mounts student workspace and toggles distraction-free exam mode on /attempt/:id", async () => {
    vi.spyOn(apiClient, "exchangeAisSession").mockResolvedValue({
      token: "assessment-token-student",
      user: {
        id: 19,
        name: "Siti Aminah",
        email: "siti@bhaktiprajabatang.sch.id",
        role: "student",
      },
    });
    vi.spyOn(apiClient, "listClasses").mockResolvedValue({ items: [] });
    vi.spyOn(apiClient, "getPersonalGrades").mockResolvedValue({ items: [] });
    vi.spyOn(apiClient, "listNotifications").mockResolvedValue({ items: [], unread_count: 0 });

    const examStates = [];
    mounted = await mountAssessmentApp(container, {
      user: { id: 19, name: "Siti Aminah", email: "siti@bhaktiprajabatang.sch.id", role: "murid" },
      aisToken: "ais-token-19",
      initialSubpath: "/student",
      onExamModeChange: (exam) => examStates.push(exam),
    });

    await nextTick();
    expect(container.textContent).toContain("Assessment saya");
    expect(examStates.at(-1)).toBe(false);

    await mounted.navigateTo("/attempt/demo-1");
    await nextTick();
    expect(examStates.at(-1)).toBe(true);
    expect(container.querySelector(".exam-shell")).not.toBeNull();
  });
});
