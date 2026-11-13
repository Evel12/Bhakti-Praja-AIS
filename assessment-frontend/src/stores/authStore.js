import { computed, ref } from "vue";
import { defineStore } from "pinia";
import {
  apiClient,
  getStoredSession,
  getStoredToken,
  setStoredSession,
  setStoredToken,
} from "../services/apiClient.js";
import { useAssessmentStore } from "./assessmentStore.js";
import { useLmsStore } from "./lmsStore.js";

const EMAIL_ACCOUNTS = [
  {
    id: 2,
    name: "Demo Teacher",
    email: "teacher@example.test",
    role: "teacher",
    password: "DemoPassword123!",
  },
  {
    id: 3,
    name: "Demo Student One",
    email: "student1@example.test",
    role: "student",
    password: "DemoPassword123!",
  },
  {
    id: 4,
    name: "Demo Student Two",
    email: "student2@example.test",
    role: "student",
    password: "DemoPassword123!",
  },
];

export const useAuthStore = defineStore("auth", () => {
  const initialSession = getStoredSession();
  const token = ref(getStoredToken());
  const user = ref(
    initialSession?.user || {
      id: EMAIL_ACCOUNTS[0].id,
      name: EMAIL_ACCOUNTS[0].name,
      email: EMAIL_ACCOUNTS[0].email,
      role: EMAIL_ACCOUNTS[0].role,
    },
  );
  const authMethod = ref("email");
  const apiConnected = ref(Boolean(initialSession?.apiConnected));
  const loading = ref(false);
  const error = ref("");
  const notice = ref("");

  const isAuthenticated = computed(() => Boolean(token.value && user.value));
  const currentRole = computed(() => user.value?.role || "teacher");

  const authBadgeLabel = computed(() => {
    if (!token.value) {
      return "Masuk";
    }
    return user.value?.email || "Akun Email";
  });

  function persistSession() {
    setStoredSession({
      user: user.value,
      authMethod: "email",
      apiConnected: apiConnected.value,
    });
  }

  async function applySession({ nextUser, nextToken, connected = true }) {
    user.value = nextUser;
    token.value = nextToken || null;
    authMethod.value = "email";
    apiConnected.value = connected;
    setStoredToken(nextToken || null);
    persistSession();

    const assessmentStore = useAssessmentStore();
    const mappedRole = nextUser?.role === "student" ? "student" : "teacher";
    assessmentStore.setRole(mappedRole);

    if (connected && nextToken && typeof assessmentStore.syncFromApi === "function") {
      await assessmentStore.syncFromApi();
      const lmsStore = useLmsStore();
      if (typeof lmsStore.loadNotifications === "function") {
        lmsStore.loadNotifications().catch(() => {});
      }
    }
  }

  async function loginWithEmail({ email, password }) {
    loading.value = true;
    error.value = "";
    notice.value = "";

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const rawPassword = String(password || "");

    if (!normalizedEmail || !rawPassword) {
      loading.value = false;
      error.value = "Email dan kata sandi wajib diisi.";
      return { ok: false, error: error.value };
    }

    try {
      const data = await apiClient.login({
        email: normalizedEmail,
        password: rawPassword,
        device_name: "examnia-spa-email",
      });

      await applySession({
        nextUser: data.user,
        nextToken: data.token,
        connected: true,
      });

      notice.value = `Berhasil masuk sebagai ${data.user.name} (${data.user.email}).`;
      return { ok: true, mode: "api", user: data.user };
    } catch (err) {
      if (err?.status === 0 || err?.code === "NETWORK_ERROR") {
        const matchedAccount = EMAIL_ACCOUNTS.find(
          (acc) => acc.email.toLowerCase() === normalizedEmail && acc.password === rawPassword,
        );

        if (!matchedAccount) {
          error.value = "Email atau kata sandi tidak sesuai.";
          return { ok: false, error: error.value };
        }

        await applySession({
          nextUser: {
            id: matchedAccount.id,
            name: matchedAccount.name,
            email: matchedAccount.email,
            role: matchedAccount.role,
          },
          nextToken: `local-email-token-${matchedAccount.id}`,
          connected: false,
        });

        notice.value = `Berhasil masuk sebagai ${matchedAccount.name} (${matchedAccount.email}).`;
        return { ok: true, mode: "local", user: user.value };
      }

      error.value = err?.message || "Email atau kata sandi tidak sesuai.";
      return { ok: false, error: error.value };
    } finally {
      loading.value = false;
    }
  }

  function triggerSsoPlaceholder() {
    error.value = "";
    notice.value = "Fitur SSO sedang disiapkan. Silakan masuk menggunakan Email dan Kata Sandi.";
  }

  async function restoreSession() {
    const savedToken = getStoredToken();
    if (!savedToken || String(savedToken).startsWith("local-")) {
      return;
    }

    try {
      const profile = await apiClient.me();
      if (profile?.id) {
        await applySession({
          nextUser: profile,
          nextToken: savedToken,
          connected: true,
        });
      }
    } catch {
      apiConnected.value = false;
    }
  }

  async function logout() {
    loading.value = true;
    try {
      if (apiConnected.value && token.value && !String(token.value).startsWith("local-")) {
        await apiClient.logout();
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      token.value = null;
      apiConnected.value = false;
      setStoredToken(null);
      setStoredSession(null);
      const lmsStore = useLmsStore();
      lmsStore.notifications = [];
      lmsStore.unreadCount = 0;
      lmsStore.classes = [];
      lmsStore.activeClassId = null;
      lmsStore.activeClass = null;
      loading.value = false;
      error.value = "";
      notice.value = "Anda telah keluar dari sesi.";
    }
  }

  async function requestPasswordReset(email) {
    loading.value = true;
    error.value = "";
    notice.value = "";
    try {
      const response = await apiClient.forgotPassword(email);
      notice.value =
        response?.message ||
        "Jika akun terdaftar, tautan reset kata sandi telah dikirim ke email Anda.";
      return { ok: true };
    } catch (err) {
      if (err?.status === 0 || err?.code === "NETWORK_ERROR") {
        notice.value = `Tautan pemulihan kata sandi telah dikirim ke ${email}.`;
        return { ok: true, simulated: true };
      }
      error.value = err?.message || "Gagal mengirim permintaan reset kata sandi.";
      return { ok: false, error: error.value };
    } finally {
      loading.value = false;
    }
  }

  async function confirmPasswordReset({ email, resetToken, password, passwordConfirmation }) {
    loading.value = true;
    error.value = "";
    notice.value = "";
    try {
      await apiClient.resetPassword({
        email,
        token: resetToken,
        password,
        password_confirmation: passwordConfirmation,
      });
      notice.value = "Kata sandi berhasil diperbarui. Silakan masuk kembali.";
      return { ok: true };
    } catch (err) {
      if (err?.status === 0 || err?.code === "NETWORK_ERROR") {
        notice.value = "Kata sandi berhasil diperbarui. Silakan masuk dengan kata sandi baru.";
        return { ok: true, simulated: true };
      }
      error.value = err?.message || "Token pemulihan tidak valid atau sudah kedaluwarsa.";
      return { ok: false, error: error.value };
    } finally {
      loading.value = false;
    }
  }

  return {
    token,
    user,
    authMethod,
    apiConnected,
    loading,
    error,
    notice,
    isAuthenticated,
    currentRole,
    authBadgeLabel,
    loginWithEmail,
    triggerSsoPlaceholder,
    restoreSession,
    logout,
    requestPasswordReset,
    confirmPasswordReset,
  };
});
