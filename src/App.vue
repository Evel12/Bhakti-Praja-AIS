<script setup>
import { onMounted, onBeforeUnmount } from "vue";
import { createAtomMotionScope } from "./motion/atoms.js";
import { useRoute } from "vue-router";
import { useAssessmentStore } from "./stores/assessmentStore.js";
import { useUiStore } from "./stores/uiStore.js";
import AppShell from "./layouts/AppShell.vue";
import ExamLayout from "./layouts/ExamLayout.vue";
import { repository } from "./repositories/assessmentRepository.js";
import { download } from "./utils/format.js";
const route = useRoute(),
  store = useAssessmentStore(),
  ui = useUiStore();
let atoms;
onMounted(() => {
  atoms = createAtomMotionScope(document.getElementById("app"));
});
onBeforeUnmount(() => atoms?.dispose());
function backup() {
  store.run(() =>
    download(
      repository.raw(),
      "examnia-data-recovery.json",
      "application/json",
    ),
  );
}
async function restore(e) {
  const f = e.target.files?.[0];
  try {
    if (f) store.restore(await f.text());
  } catch (err) {
    ui.toast(err.message, true);
  }
}
function reload() {
  window.location.reload();
}
</script>
<template>
  <section v-if="store.recoveryError" class="panel recovery">
    <h1>Pulihkan data assessment</h1>
    <p class="notice warning">{{ store.recoveryError }}</p>
    <p>
      Data asli belum diubah. Unduh salinannya, lalu pilih file JSON cadangan
      yang valid.
    </p>
    <div class="action-row mt">
      <button class="btn" @click="backup">Unduh data asli</button
      ><label class="btn"
        >Pulihkan JSON<input
          type="file"
          accept=".json"
          @change="restore" /></label
      ><button class="btn" @click="reload">Muat ulang</button>
    </div>
  </section>
  <component v-else :is="route.meta.exam ? ExamLayout : AppShell"
    ><RouterView :key="route.path"
  /></component>
  <div
    v-if="ui.message"
    id="toast"
    :class="{ error: ui.error }"
    role="status"
    aria-live="polite"
  >
    {{ ui.message }}
  </div>
</template>
