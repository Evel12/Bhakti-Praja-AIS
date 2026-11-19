import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router/index.js";
import "./styles/main.css";
import { initializeEmbeddedSession } from "./integration/embeddedSession.js";

// Apply the AIS session before Vue Router runs its authentication guard.
// Without this handshake, the embedded app redirects to its own login page.
initializeEmbeddedSession().finally(() => {
  createApp(App).use(createPinia()).use(router).mount("#app");
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
