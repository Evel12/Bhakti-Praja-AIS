<script setup>
import IdentityStep from "../../components/assessment/IdentityStep.vue";
import ContentStep from "../../components/assessment/ContentStep.vue";
import SettingsStep from "../../components/assessment/SettingsStep.vue";
import PreviewStep from "../../components/assessment/PreviewStep.vue";
import { computed, nextTick, ref, watch } from "vue";
import { useRoute, useRouter, onBeforeRouteLeave } from "vue-router";
import { useAssessmentStore } from "../../stores/assessmentStore.js";
import { useUiStore } from "../../stores/uiStore.js";
import {
  clone,
  newQuestion,
  uid,
} from "../../domain/assessment.js";
import { assessmentIssues } from "../../domain/assessmentValidation.js";
import PageTitle from "../../components/ui/PageTitle.vue";
import AppDialog from "../../components/ui/AppDialog.vue";
import Icon from "../../components/ui/Icon.vue";
import { useDraftAutosave } from "../../composables/useDraftAutosave.js";
const store = useAssessmentStore(),
  ui = useUiStore(),
  route = useRoute(),
  router = useRouter();
const found = store.db.assessments.find((a) => a.id === route.params.id);
const draft = ref(found ? clone(found) : null),
  step = ref(0),
  index = ref(0),
  validatedSteps = ref([]),
  publishAttempted = ref(false),
  validationNow = ref(Date.now()),
  dialog = ref(""),
  selected = ref([]);
const steps = ["Identitas", "Konten", "Pengaturan", "Pratinjau"];
const errors = computed(() => draft.value
  ? assessmentIssues(draft.value, { forPublish: publishAttempted.value, now: validationNow.value })
    .filter((issue) => publishAttempted.value || validatedSteps.value.includes(issue.step))
  : []);
const stepErrors = (value) => errors.value.filter((issue) => issue.step === value).length;
async function goToError(issue) {
  step.value = issue.step;
  if (issue.questionId) {
    const position = draft.value.questions.findIndex((q) => q.id === issue.questionId);
    if (position >= 0) index.value = position;
  }
  await nextTick();
  const input = document.getElementById(issue.target);
  input?.focus();
  input?.scrollIntoView?.({ block: "center" });
}
const { dirty, status: saveStatus, error: saveError, save: persistDraft, markSaved } = useDraftAutosave(
  draft,
  (value) => store.saveDraft(value),
);
function save(show = true) {
  const result = persistDraft();
  if (result && show) ui.toast("Draft tersimpan.");
  return result;
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
  if (!validatedSteps.value.includes(step.value)) validatedSteps.value.push(step.value);
  const first = errors.value.find((issue) => issue.step === step.value);
  if (first) goToError(first);
  else if (save(false)) step.value++;
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
  validationNow.value = Date.now();
  publishAttempted.value = true;
  if (errors.value.length) goToError(errors.value[0]);
  else dialog.value = "publish";
}
function publish() {
  validationNow.value = Date.now();
  if (errors.value.length) {
    dialog.value = "";
    goToError(errors.value[0]);
    return;
  }
  const result = store.run(
    () => store.publish(draft.value),
    "Assessment berhasil diterbitkan.",
  );
  if (result) {
    draft.value.state = "published";
    markSaved();
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
      description="Susun langkah demi langkah. Draft disimpan otomatis di browser ini."
      ><span class="unsaved" role="status" aria-live="polite" aria-atomic="true">{{
        saveStatus === "error" ? "Draft belum tersimpan" : saveStatus === "saving" ? "Menyimpan…" : "Draft tersimpan"
      }}</span
      ><button class="btn" @click="save()">
        <Icon name="save" />Simpan draft
      </button></PageTitle
    >
    <p v-if="saveError" class="notice warning" role="alert">
      {{ saveError }} Edit Anda tetap terbuka. Coba lagi dengan tombol Simpan draft sebelum menutup halaman.
    </p>
    <div class="builder-grid">
      <nav class="step-nav" aria-label="Langkah pembuatan">
        <button
          v-for="(s, i) in steps"
          :key="s"
          class="step"
          :class="{ active: step === i, 'step-has-errors': stepErrors(i) }"
          :aria-current="step === i ? 'step' : undefined"
          @click="step = i"
        >
          <span class="step-number">{{ i + 1 }}</span
          ><span>{{ s }}<small v-if="stepErrors(i)" class="step-error-label">{{ stepErrors(i) }} perlu diperbaiki</small></span>
        </button>
      </nav>
      <section class="panel builder-form">
        <form @submit.prevent>
          <IdentityStep v-if="step === 0" :draft="draft" :issues="errors" />
          <ContentStep
            v-if="step === 1"
            :draft="draft"
            :index="index"
            :issues="errors"
            @add="add"
            @bank="dialog = 'bank'"
            @ai="dialog = 'ai'"
            @remove="dialog = 'remove'"
            @select="index = $event"
          />
          <SettingsStep v-if="step === 2" :draft="draft" :issues="errors" />
          <PreviewStep v-if="step === 3" :draft="draft" />
          <div v-if="errors.length" class="error-box" role="alert">
            <strong>Periksa kembali</strong>
            <ul>
              <li v-for="error in errors" :key="error.target"><a :href="'#' + error.target" @click.prevent="goToError(error)">{{ steps[error.step] }} · {{ error.message }}</a></li>
            </ul>
          </div>
          <div class="builder-footer">
            <span class="tiny muted">Langkah {{ step + 1 }} dari 4</span>
            <div class="action-row">
              <button
                v-if="step"
                type="button"
                class="btn"
                @click="step--"
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
