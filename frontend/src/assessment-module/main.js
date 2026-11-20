import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router/index.js";
import "./styles/main.css";
import { initializeEmbeddedSession } from "./integration/embeddedSession.js";
import {
  setStoredSession,
  setStoredToken,
  setUnauthorizedHandler,
} from "./services/apiClient.js";
import { useAuthStore } from "./stores/authStore.js";
import { useLmsStore } from "./stores/lmsStore.js";

const pinia = createPinia();

setUnauthorizedHandler(() => {
  setStoredToken(null);
  setStoredSession(null);

  const authStore = useAuthStore(pinia);
  authStore.token = null;
  authStore.user = null;
  authStore.apiConnected = false;
  authStore.error = "";
  authStore.notice = "Sesi Anda telah berakhir. Silakan masuk kembali.";

  const lmsStore = useLmsStore(pinia);
  lmsStore.notifications = [];
  lmsStore.unreadCount = 0;
  lmsStore.classes = [];
  lmsStore.activeClassId = null;
  lmsStore.activeClass = null;

  if (!router.currentRoute.value?.meta?.auth) {
    router.replace("/login").catch(() => {});
  }
});

// Apply the AIS session before Vue Router runs its authentication guard.
// Without this handshake, the embedded app redirects to its own login page.
initializeEmbeddedSession().finally(() => {
  createApp(App).use(pinia).use(router).mount("#app");
});
if (import.meta.env.DEV) {
  let tuning;
  let disposed = false;
  import("./motion/tuning.js").then(({ installMotionTuning }) => {
    if (!disposed) tuning = installMotionTuning(document.documentElement);
  });
  import.meta.hot?.dispose(() => {
    disposed = true;
    tuning?.dispose();
  });
}
