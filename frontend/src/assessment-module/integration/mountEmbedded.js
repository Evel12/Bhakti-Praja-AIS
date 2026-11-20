import { createApp, watch } from "vue";
import { createPinia } from "pinia";
import App from "../App.vue";
import { createAssessmentRouter } from "../router/index.js";
import "../motion/tokens.css";
import "../styles/embedded.css";
import {
  apiClient,
  getStoredSession,
  getStoredToken,
  releaseCombinedShell,
  retainCombinedShell,
  setStoredSession,
  setStoredToken,
  setUnauthorizedHandler,
} from "../services/apiClient.js";
import { useAuthStore } from "../stores/authStore.js";
import { useAssessmentStore } from "../stores/assessmentStore.js";
import { useLmsStore } from "../stores/lmsStore.js";

const ROLE_MAP = {
  admin: "admin",
  guru: "teacher",
  teacher: "teacher",
  murid: "student",
  student: "student",
};

export function resolveAssessmentRole(aisRole) {
  return ROLE_MAP[aisRole] || null;
}

export function defaultAssessmentPathForRole(mappedRole) {
  return mappedRole === "student" ? "/student" : "/dashboard";
}

export function normalizeAssessmentSubpath(subpath, mappedRole) {
  const raw = String(subpath || "").trim();
  const stripped = raw.replace(/^\/assessment(?=\/|$|\?)/, "");
  if (!stripped || stripped === "/") {
    return defaultAssessmentPathForRole(mappedRole);
  }
  return stripped.startsWith("/") ? stripped : `/${stripped}`;
}

export function clearAssessmentAuthStorage() {
  setStoredToken(null);
  setStoredSession(null);
}

async function ensureAssessmentSession({ user, aisToken, mappedRole, onUnauthorized }) {
  const existingToken = getStoredToken();
  const existingSession = getStoredSession();
  const sameUserLive =
    existingToken &&
    !String(existingToken).startsWith("local-") &&
    existingSession?.authMethod === "ais-sso" &&
    existingSession?.user?.email &&
    existingSession.user.email === user.email &&
    existingSession?.user?.role === mappedRole;

  if (sameUserLive) {
    return {
      token: existingToken,
      user: existingSession.user,
      apiConnected: Boolean(existingSession.apiConnected),
    };
  }

  if (aisToken && !String(aisToken).startsWith("local-")) {
    try {
      const exchanged = await apiClient.exchangeAisSession({
        ais_token: aisToken,
        device_name: "ais-unified-ui",
      });
      if (exchanged?.token && exchanged?.user) {
        const sessionUser = { ...exchanged.user, aisRole: user.role };
        setStoredToken(exchanged.token);
        setStoredSession({
          user: sessionUser,
          authMethod: "ais-sso",
          apiConnected: true,
        });
        return { token: exchanged.token, user: sessionUser, apiConnected: true };
      }
    } catch (err) {
      if (err?.status === 401) {
        clearAssessmentAuthStorage();
        onUnauthorized?.();
        throw err;
      }
      if (!import.meta.env?.DEV) {
        throw err;
      }
    }
  }

  if (import.meta.env?.DEV) {
    const localToken = `local-ais-sso-${user.id}`;
    const localUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: mappedRole,
      aisRole: user.role,
    };
    setStoredToken(localToken);
    setStoredSession({
      user: localUser,
      authMethod: "ais-sso",
      apiConnected: false,
    });
    return { token: localToken, user: localUser, apiConnected: false };
  }

  throw new Error("Sesi assessment tidak dapat divalidasi.");
}

const activeUnauthorizedHandlers = new Map();

export async function mountAssessmentApp(containerEl, options = {}) {
  const {
    user,
    aisToken,
    apiBaseUrl = "",
    initialSubpath = "",
    onRouteChange,
    onUnreadChange,
    onExamModeChange,
    onUnauthorized,
  } = options;

  const mappedRole = resolveAssessmentRole(user?.role);
  if (!mappedRole) {
    throw new Error("Peran akun tidak memiliki akses ke ruang assessment.");
  }

  const mountToken = Symbol("assessment-mount");
  let released = false;
  let authStoreRef = null;

  const handleUnauthorized = () => {
    clearAssessmentAuthStorage();
    if (authStoreRef) {
      authStoreRef.token = null;
      authStoreRef.user = null;
      authStoreRef.apiConnected = false;
    }
    onUnauthorized?.();
  };

  function releaseMountResources() {
    if (released) return;
    released = true;
    activeUnauthorizedHandlers.delete(mountToken);
    const remainingHandlers = [...activeUnauthorizedHandlers.values()];
    setUnauthorizedHandler(remainingHandlers.at(-1) || null);
    releaseCombinedShell(mountToken);
  }

  retainCombinedShell(mountToken, apiBaseUrl);
  activeUnauthorizedHandlers.set(mountToken, handleUnauthorized);
  setUnauthorizedHandler(handleUnauthorized);

  let sessionState;
  let pinia;
  let router;
  let app;
  let authStore;
  let lmsStore;

  try {
    sessionState = await ensureAssessmentSession({
      user,
      aisToken,
      mappedRole,
      onUnauthorized,
    });

    pinia = createPinia();
    router = createAssessmentRouter({ memory: true, combined: true });
    app = createApp(App);

    app.use(pinia);
    app.use(router);
    app.provide("assessmentCombinedShell", true);
    app.provide("assessmentMotionRoot", containerEl);
    app.provide("assessmentPortalTarget", containerEl);

    authStore = useAuthStore(pinia);
    authStoreRef = authStore;
    const assessmentStore = useAssessmentStore(pinia);
    lmsStore = useLmsStore(pinia);

    authStore.token = sessionState.token;
    authStore.user = sessionState.user;
    authStore.authMethod = "ais-sso";
    authStore.apiConnected = sessionState.apiConnected;
    assessmentStore.setRole(mappedRole === "student" ? "student" : "teacher");

    if (sessionState.apiConnected && mappedRole !== "admin") {
      assessmentStore.syncFromApi().catch(() => {});
      lmsStore.loadNotifications().catch(() => {});
    }

    const targetPath = normalizeAssessmentSubpath(initialSubpath, mappedRole);
    await router.replace(targetPath);
    await router.isReady();
  } catch (err) {
    releaseMountResources();
    throw err;
  }

  let disposed = false;
  let syncingFromHost = false;

  const stopRouteWatch = watch(
    () => router.currentRoute.value.fullPath,
    (fullPath) => {
      if (disposed) return;
      const meta = router.currentRoute.value.meta || {};
      onExamModeChange?.(Boolean(meta.exam));
      if (!syncingFromHost) {
        onRouteChange?.(fullPath, meta);
      }
    },
    { immediate: true },
  );

  const stopUnreadWatch = watch(
    () => lmsStore.unreadCount,
    (count) => {
      if (!disposed) {
        onUnreadChange?.(Number(count) || 0);
      }
    },
    { immediate: true },
  );

  app.mount(containerEl);

  return {
    async navigateTo(nextSubpath) {
      if (disposed) return;
      const resolved = normalizeAssessmentSubpath(nextSubpath, mappedRole);
      if (router.currentRoute.value.fullPath === resolved) return;
      syncingFromHost = true;
      try {
        await router.replace(resolved);
      } finally {
        syncingFromHost = false;
      }
    },
    async logoutAssessment() {
      try {
        await authStore.logout();
      } finally {
        clearAssessmentAuthStorage();
      }
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      stopRouteWatch();
      stopUnreadWatch();
      app.unmount();
      releaseMountResources();
    },
  };
}
