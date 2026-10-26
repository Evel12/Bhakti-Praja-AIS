<script setup>
import IdentityStep from "../../components/assessment/IdentityStep.vue";
import ContentStep from "../../components/assessment/ContentStep.vue";
import SettingsStep from "../../components/assessment/SettingsStep.vue";
import PreviewStep from "../../components/assessment/PreviewStep.vue";
import { ref, computed, watch } from "vue";
import { useRoute, useRouter, onBeforeRouteLeave } from "vue-router";
import { useAssessmentStore } from "../../stores/assessmentStore.js";
import { useUiStore } from "../../stores/uiStore.js";
import {
  clone,
  newQuestion,
  uid,
  validateAssessment,
} from "../../domain/assessment.js";
import PageTitle from "../../components/ui/PageTitle.vue";
import AppDialog from "../../components/ui/AppDialog.vue";
import Icon from "../../components/ui/Icon.vue";
const store = useAssessmentStore(),
  ui = useUiStore(),
  route = useRoute(),
  router = useRouter();
const found = store.db.assessments.find((a) => a.id === route.params.id);
const draft = ref(found ? clone(found) : null),
  step = ref(0),
  index = ref(0),
  errors = ref([]),
  dialog = ref(""),
  selected = ref([]),
  saved = ref(found ? JSON.stringify(found) : "");
const steps = ["Identitas", "Konten", "Pengaturan", "Pratinjau"];
const dirty = computed(
  () => draft.value && JSON.stringify(draft.value) !== saved.value,
);
function save(show = true) {
  const result = store.run(
    () => store.saveDraft(draft.value),
    show ? "Draft tersimpan." : "",
  );
  if (result) saved.value = JSON.stringify(draft.value);
  return !!result;
}
onBeforeRouteLeave(() => {
  if (draft.value?.state === "draft" && dirty.value) return save(false);
});
watch(
  () => draft.value?.type,
  (type) => {
    if (type === "Tugas") {
      draft.value.releaseMode = "manual";
      if (
        draft.value.instructions ===
        "Pilih satu jawaban yang paling tepat. Periksa jawaban sebelum mengirim."
      )
        draft.value.instructions =
          "Unggah laporan sesuai instruksi pengajar. Gunakan PDF, DOCX, JPG, atau PNG maksimal 2 MB.";
    }
  },
);
function next() {
  errors.value = [];
  const d = draft.value;
  if (step.value === 0 && !d.title.trim())
    errors.value = ["Tuliskan judul assessment terlebih dahulu."];
  if (step.value === 1)
    errors.value = validateAssessment(d).filter((x) =>
      /soal|pertanyaan|pilihan|poin|instruksi/i.test(x),
    );
  if (step.value === 2)
    errors.value = validateAssessment(d).filter((x) => /waktu|durasi/i.test(x));
  if (!errors.value.length && save(false)) step.value++;
}
function add() {
  draft.value.questions.push(newQuestion());
  index.value = draft.value.questions.length - 1;
}
function remove() {
  draft.value.questions.splice(index.value, 1);
  index.value = Math.max(0, index.value - 1);
  dialog.value = "";
}
function addBank(ai = false) {
  const qs = (
    ai
      ? store.db.bank.slice(0, 3)
      : store.db.bank.filter((q) => selected.value.includes(q.id))
  ).map((q) => ({
    ...clone(q),
    id: uid(),
    ...(ai ? { source: "ai", reviewed: false } : {}),
  }));
  if (!qs.length) {
    ui.toast("Pilih setidaknya satu soal.", true);
    return;
  }
  if (
    draft.value.questions.length === 1 &&
    !draft.value.questions[0].text.trim()
  )
    draft.value.questions = [];
  index.value = draft.value.questions.length;
  draft.value.questions.push(...qs);
  dialog.value = "";
  selected.value = [];
}
function checkPublish() {
  errors.value = validateAssessment(draft.value);
  if (Date.parse(draft.value.closeAt) <= Date.now())
    errors.value.push("Waktu tutup sudah lewat. Atur jadwal baru.");
  if (!errors.value.length) dialog.value = "publish";
}
function publish() {
  const result = store.run(
    () => store.publish(draft.value),
    "Assessment berhasil diterbitkan.",
  );
  if (result) {
    draft.value.state = "published";
    saved.value = JSON.stringify(draft.value);
    dialog.value = "";
    router.push("/assessments/all");
  }
}
function duplicate() {
  const id = store.run(() => store.duplicate(draft.value));
  if (id) router.push("/builder/" + id);
}
function pdf(e) {
  const f = e.target.files?.[0];
  if (
    f &&
    (!f.name.toLowerCase().endsWith(".pdf") || f.size > 10 * 1024 * 1024)
  ) {
    e.target.value = "";
    ui.toast("Pilih PDF maksimal 10 MB.", true);
  }
}
</script>
<template>
  <div v-if="!draft" class="empty">
    <h1>Draft tidak ditemukan</h1>
    <RouterLink to="/assessments/all" class="btn mt"
      >Kembali ke assessment</RouterLink
    >
  </div>
  <template v-else-if="draft.state !== 'draft'"
    ><PageTitle
      title="Konten sudah dipublikasikan"
      description="Buat salinan untuk merevisi soal tanpa mengubah hasil peserta."
    />
    <section class="panel">
      <button class="btn primary" @click="duplicate">Buat salinan draft</button>
    </section></template
  ><template v-else
    ><PageTitle
      :title="draft.title || 'Buat assessment'"
      description="Susun langkah demi langkah. Draft disimpan saat berpindah halaman."
      ><span class="unsaved">{{
        dirty ? "Perubahan belum disimpan" : "Draft tersimpan"
      }}</span
      ><button class="btn" @click="save()">
        <Icon name="save" />Simpan draft
      </button></PageTitle
    >
    <div class="builder-grid">
      <nav class="step-nav" aria-label="Langkah pembuatan">
        <button
          v-for="(s, i) in steps"
          :key="s"
          class="step"
          :class="{ active: step === i }"
          :aria-current="step === i ? 'step' : undefined"
          @click="
            step = i;
            errors = [];
          "
        >
          <span class="step-number">{{ i + 1 }}</span
          ><span>{{ s }}</span>
        </button>
      </nav>
      <section class="panel builder-form">
        <form @submit.prevent>
          <IdentityStep v-if="step === 0" :draft="draft" />
          <ContentStep
            v-if="step === 1"
            :draft="draft"
            :index="index"
            @add="add"
            @bank="dialog = 'bank'"
            @ai="dialog = 'ai'"
            @remove="dialog = 'remove'"
            @select="index = $event"
          />
          <SettingsStep v-if="step === 2" :draft="draft" />
          <PreviewStep v-if="step === 3" :draft="draft" />
          <div v-if="errors.length" class="error-box" role="alert">
            <strong>Periksa kembali</strong>
            <ul>
              <li v-for="error in errors" :key="error">{{ error }}</li>
            </ul>
          </div>
          <div class="builder-footer">
            <span class="tiny muted">Langkah {{ step + 1 }} dari 4</span>
            <div class="action-row">
              <button
                v-if="step"
                type="button"
                class="btn"
                @click="
                  step--;
                  errors = [];
                "
              >
                Sebelumnya</button
              ><button
                v-if="step < 3"
                type="button"
                class="btn primary"
                @click="next"
              >
                Lanjutkan →</button
              ><button
                v-else
                type="button"
                class="btn primary"
                @click="checkPublish"
              >
                Terbitkan assessment
              </button>
            </div>
          </div>
        </form>
      </section>
    </div></template
  >
  <AppDialog
    :open="!!dialog"
    :title="
      {
        bank: 'Pilih dari bank soal',
        ai: 'Bantu susun soal dengan AI',
        remove: 'Hapus soal ini?',
        publish: 'Terbitkan assessment?',
      }[dialog]
    "
    @close="dialog = ''"
  >
    <template v-if="dialog === 'bank'"
      ><p class="dialog-copy">
        Soal disalin ke draft, bank soal asli tetap tersimpan.
      </p>
      <label v-for="q in store.db.bank" :key="q.id" class="bank-picker"
        ><input v-model="selected" type="checkbox" :value="q.id" /><span
          >{{ q.text }}<small>{{ q.topic }}</small></span
        ></label
      ></template
    >
    <template v-if="dialog === 'ai'"
      ><p class="notice warning">
        Pratinjau alur AI · layanan pembuat soal belum dihubungkan.
      </p>
      <label class="upload"
        >Pilih materi PDF (maksimal 10 MB)<input
          type="file"
          accept=".pdf"
          aria-label="Pilih materi PDF"
          @change="pdf"
      /></label>
      <p class="notice">
        Soal contoh berasal dari bank soal, bukan hasil analisis PDF. Tinjau
        soal dan kunci sebelum terbit.
      </p></template
    >
    <p v-if="dialog === 'remove'" class="dialog-copy">
      Soal {{ index + 1 }} akan dihapus dari draft ini.
    </p>
    <p v-if="dialog === 'publish'" class="dialog-copy">
      {{ draft.title }} akan tersedia untuk {{ draft.className }} sesuai jadwal.
      Konten dikunci setelah terbit.
    </p>
    <template #footer
      ><button class="btn" @click="dialog = ''">Batal</button
      ><button v-if="dialog === 'bank'" class="btn primary" @click="addBank()">
        Tambahkan soal</button
      ><button
        v-if="dialog === 'ai'"
        class="btn primary"
        @click="addBank(true)"
      >
        Gunakan 3 soal contoh</button
      ><button v-if="dialog === 'remove'" class="btn danger" @click="remove">
        Hapus soal</button
      ><button v-if="dialog === 'publish'" class="btn primary" @click="publish">
        Ya, terbitkan
      </button></template
    >
  </AppDialog>
</template>
