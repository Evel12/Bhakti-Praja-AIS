import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import LoginView from "../../src/views/auth/LoginView.vue";
import ResetPasswordView from "../../src/views/auth/ResetPasswordView.vue";
import { useAuthStore } from "../../src/stores/authStore.js";

let pinia, wrapper;

beforeEach(() => {
  localStorage.clear();
  pinia = createPinia();
  setActivePinia(pinia);
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mountAuthRouter(initialPath = "/login") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/login", name: "login", component: LoginView, meta: { auth: true } },
      { path: "/reset-password", name: "reset-password", component: ResetPasswordView, meta: { auth: true } },
      { path: "/dashboard", component: { template: "<p>Ruang Pengajar</p>" } },
      { path: "/student", component: { template: "<p>Ruang Peserta</p>" } },
    ],
  });
  await router.push(initialPath);
  wrapper = mount(RouterView, {
    attachTo: document.body,
    global: { plugins: [pinia, router] },
  });
  await flushPromises();
  return router;
}

describe("Opsi A Unified Login Card & Email Authentication", () => {
  it("renders Opsi A Unified Card with a button labeled 'SSO' that prompts Email login", async () => {
    const router = await mountAuthRouter("/login");
    const authStore = useAuthStore();

    expect(wrapper.find(".auth-unified-card").exists()).toBe(true);
    const ssoBtn = wrapper.get(".auth-sso-btn");
    expect(ssoBtn.text()).toBe("SSO");

    await ssoBtn.trigger("click");
    await flushPromises();

    expect(authStore.notice).toContain("Email");
    expect(router.currentRoute.value.path).toBe("/login");
  });

  it("authenticates via Email + Password (POST /api/auth/login) and routes teacher to /dashboard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            success: true,
            data: {
              token: "sanctum-email-token-456",
              user: {
                id: 2,
                name: "Demo Teacher",
                email: "teacher@example.test",
                role: "teacher",
              },
            },
          }),
      }),
    );

    const router = await mountAuthRouter("/login");
    const authStore = useAuthStore();

    await wrapper.get("form.auth-email-form").trigger("submit");
    await flushPromises();

    expect(authStore.authMethod).toBe("email");
    expect(authStore.apiConnected).toBe(true);
    expect(authStore.user.email).toBe("teacher@example.test");
    expect(authStore.user.role).toBe("teacher");
    expect(router.currentRoute.value.path).toBe("/dashboard");
  });

  it("validates Email + Password in offline fallback mode and routes student1@example.test to /student", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));

    const router = await mountAuthRouter("/login");
    const authStore = useAuthStore();

    await wrapper.get('input[type="password"]').setValue("WrongPassword");
    await wrapper.get("form.auth-email-form").trigger("submit");
    await flushPromises();

    expect(authStore.error).toContain("tidak sesuai");
    expect(router.currentRoute.value.path).toBe("/login");

    const studentPill = wrapper.findAll(".auth-quick-pill")[1];
    await studentPill.trigger("click");
    await wrapper.get("form.auth-email-form").trigger("submit");
    await flushPromises();

    expect(authStore.user.email).toBe("student1@example.test");
    expect(authStore.user.role).toBe("student");
    expect(router.currentRoute.value.path).toBe("/student");
  });
});
