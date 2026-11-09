import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router/index.js";
import { initializeEmbeddedSession } from "./integration/embeddedSession.js";
import "./styles/main.css";

async function boot() {
  await initializeEmbeddedSession();
  createApp(App).use(createPinia()).use(router).mount("#app");
}
boot();
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
