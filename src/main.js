import { createApp } from "vue";
import { createPinia } from "pinia";
import { initializeSession } from './integration/session.js';
import "./styles/main.css";
async function boot() {
  try {
    await initializeSession();
    const [{ default: App }, { default: router }] = await Promise.all([import('./App.vue'), import('./router/index.js')]);
    createApp(App).use(createPinia()).use(router).mount('#app');
  } catch (error) {
    const host = document.getElementById('app');
    const message = document.createElement('p');
    message.setAttribute('role', 'alert');
    message.textContent = error.message || 'Ruang assessment belum dapat dimuat.';
    const link = document.createElement('a');
    link.href = '/login'; link.target = '_top'; link.textContent = 'Kembali ke login';
    host.replaceChildren(message, link);
  }
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
