<script setup>
import IdentityStep from "../../components/assessment/IdentityStep.vue";
import ContentStep from "../../components/assessment/ContentStep.vue";
import SettingsStep from "../../components/assessment/SettingsStep.vue";
import PreviewStep from "../../components/assessment/PreviewStep.vue";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter, onBeforeRouteLeave } from "vue-router";
import { animateSlide } from "../../motion/presence.js";
import { useAssessmentStore } from "../../stores/assessmentStore.js";
import { useAuthStore } from "../../stores/authStore.js";
import { useLmsStore } from "../../stores/lmsStore.js";
import { useUiStore } from "../../stores/uiStore.js";
import { apiClient } from "../../services/apiClient.js";
import { findMatchingLmsClass } from "../../domain/classSync.js";
import {
  clone,
  newQuestion,
  uid,
} from "../../domain/assessment.js";
import { assessmentIssues } from "../../domain/assessmentValidation.js";
import PageTitle from "../../components/ui/PageTitle.vue";
import AppDialog from "../../components/ui/AppDialog.vue";
import Icon from "../../components/ui/Icon.vue";
import MotionField from "../../components/motion/MotionField.vue";
import { useDraftAutosave } from "../../composables/useDraftAutosave.js";
const store = useAssessmentStore(),
  auth = useAuthStore(),
  lms = useLmsStore(),
  ui = useUiStore(),
  route = useRoute(),
  router = useRouter();
const found = store.db.assessments.find((a) => a.id === route.params.id);
const draft = ref(found ? clone(found) : null),
  step = ref(0),
  index = ref(0),
  stepNav = ref(),
  stepStage = ref(),
  validatedSteps = ref([]),
  previewVisited = ref(false),
  publishAttempted = ref(false),
  validationNow = ref(Date.now()),
  dialog = ref(""),
  selected = ref([]),
  bankSearch = ref(""),
  uploadedPdf = ref(null),
  aiModuleOptions = ref([]),
  selectedAiModuleId = ref(""),
  aiQuestionCount = ref(5),
  generatingAi = ref(false);
const filteredBank = computed(() => {
  const query = bankSearch.value.trim().toLowerCase();
  if (!query) return store.db.bank;
  return store.db.bank.filter((q) =>
    `${q.text} ${q.topic}`.toLowerCase().includes(query),
  );
});
watch(dialog, (val) => {
  if (val === "bank") bankSearch.value = "";
});
const steps = ["Identitas", "Konten", "Pengaturan", "Preview"];
const errors = computed(() => draft.value
  ? assessmentIssues(draft.value, { forPublish: publishAttempted.value || previewVisited.value, now: validationNow.value })
    .filter((issue) => publishAttempted.value || previewVisited.value || validatedSteps.value.includes(issue.step))
  : []);
let stepMotion;
watch(step, (value, oldValue) => {
  if (value === 3) {
    validationNow.value = Date.now();
    previewVisited.value = true;
  }
  nextTick(() => {
    stepNav.value
      ?.querySelector(".step.active")
      ?.scrollIntoView?.({ block: "nearest", inline: "center" });
    if (typeof oldValue === "number" && value !== oldValue && stepStage.value) {
      stepMotion?.stop?.();
      stepMotion = animateSlide(stepStage.value, {
        direction: value > oldValue ? 1 : -1,
        preset: "snappy",
      });
    }
  });
}, { flush: "sync" });
onBeforeUnmount(() => {
  stepMotion?.stop?.();
});
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
        "Pilih satu jawaban yang paling tepat. Cek jawaban sebelum mengirim."
      )
        draft.value.instructions =
          "Upload laporan sesuai instruksi pengajar. Gunakan PDF, DOCX, JPG, atau PNG maksimal 2 MB.";
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
async function openAiDialog() {
  dialog.value = "ai";
  uploadedPdf.value = null;
  selectedAiModuleId.value = "";
  if (!auth.apiConnected) {
    aiModuleOptions.value = [];
    return;
  }
  const matchedClass = findMatchingLmsClass(lms.classes, draft.value || {});
  const targetClassId = matchedClass?.id || draft.value?.backendClassId || null;
  if (
    targetClassId &&
    Number(lms.activeClassId) === Number(targetClassId) &&
    lms.modules.length
  ) {
    aiModuleOptions.value = lms.modules;
    selectedAiModuleId.value = String(lms.modules[0].id);
    return;
  }
  if (targetClassId) {
    try {
      const modRes = await apiClient.listModules(targetClassId);
      const list = Array.isArray(modRes?.items) ? modRes.items : [];
      aiModuleOptions.value = list;
      if (list.length) selectedAiModuleId.value = String(list[0].id);
      return;
    } catch {
      // Fall back to already loaded store modules if available
    }
  }
  aiModuleOptions.value = lms.modules;
  if (lms.modules.length) {
    selectedAiModuleId.value = String(lms.modules[0].id);
  }
}

async function generateAiQuestions() {
  if (auth.apiConnected && !selectedAiModuleId.value && !uploadedPdf.value) {
    ui.toast("Pilih materi PDF kelas atau unggah file PDF terlebih dahulu.", true);
    return;
  }
  generatingAi.value = true;
  try {
    const generated = await store.generateQuestionsFromPdf(
      draft.value,
      uploadedPdf.value,
      {
        moduleId: selectedAiModuleId.value ? Number(selectedAiModuleId.value) : null,
        count: Number(aiQuestionCount.value) || 5,
      },
    );
    if (!Array.isArray(generated) || !generated.length) {
      ui.toast("AI tidak menghasilkan soal dari materi tersebut.", true);
      return;
    }
    if (
      draft.value.questions.length === 1 &&
      !draft.value.questions[0].text.trim()
    ) {
      draft.value.questions = [];
    }
    index.value = draft.value.questions.length;
    draft.value.questions.push(...generated);
    uploadedPdf.value = null;
    dialog.value = "";
    ui.toast(`${generated.length} soal AI ditambahkan. Review tiap soal sebelum menerbitkan.`);
  } catch (err) {
    ui.toast(err?.message || "Gagal generate soal AI.", true);
  } finally {
    generatingAi.value = false;
  }
}

function addBank() {
  const qs = store.db.bank
    .filter((q) => selected.value.includes(q.id))
    .map((q) => ({
      ...clone(q),
      id: uid(),
    }));
  if (!qs.length) {
    ui.toast("Pilih minimal satu soal.", true);
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
    uploadedPdf.value = null;
    ui.toast("Pilih PDF maksimal 10 MB.", true);
    return;
  }
  uploadedPdf.value = f || null;
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
      title="Assessment sudah terbit"
      description="Buat salinan kalau mau mengedit soal. Hasil peserta tetap aman."
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
      {{ saveError }} Perubahan kamu masih ada di halaman ini. Coba lagi dengan tombol Simpan draft sebelum menutup halaman.
    </p>
    <div class="builder-grid">
      <nav ref="stepNav" class="step-nav" aria-label="Langkah pembuatan">
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
          <div ref="stepStage" class="builder-step-stage">
            <IdentityStep v-if="step === 0" :draft="draft" :issues="errors" />
            <ContentStep
              v-if="step === 1"
              :draft="draft"
              :index="index"
              :issues="errors"
              @add="add"
              @bank="dialog = 'bank'"
              @ai="openAiDialog"
              @remove="dialog = 'remove'"
              @select="index = $event"
            />
            <SettingsStep v-if="step === 2" :draft="draft" :issues="errors" />
            <PreviewStep v-if="step === 3" :draft="draft" :issues="errors" @resolve="goToError" />
            <div v-if="errors.length && step !== 3" class="error-box" role="alert">
              <strong>Cek kembali</strong>
              <ul>
                <li v-for="error in errors" :key="error.target"><a :href="'#' + error.target" @click.prevent="goToError(error)">{{ steps[error.step] }} · {{ error.message }}</a></li>
              </ul>
            </div>
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
                {{ errors.length ? "Perbaiki sebelum terbit" : "Terbitkan assessment" }}
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
      <label class="field mb">
        <span class="field-label">Cari soal</span>
        <MotionField>
          <input
            v-model="bankSearch"
            class="input"
            placeholder="Cari pertanyaan atau mata pelajaran..."
            aria-label="Cari soal dari bank"
          />
        </MotionField>
      </label>
      <div class="bank-picker-list">
        <label v-for="q in filteredBank" :key="q.id" class="bank-picker"
          ><input v-model="selected" type="checkbox" :value="q.id" /><span
            >{{ q.text }}<small>{{ q.topic }}</small></span
          ></label
        >
        <p v-if="!filteredBank.length" class="muted">
          Tidak ada soal di bank yang sesuai pencarian.
        </p>
      </div></template
    >
    <template v-if="dialog === 'ai'">
      <p v-if="!auth.apiConnected" class="notice warning">
        Mode demo offline · menggunakan contoh soal bank sebagai simulasi draf AI. Hubungkan API Backend untuk analisis PDF nyata.
      </p>
      <p v-else class="notice">
        AI menyusun soal pilihan ganda 4 opsi Bahasa Indonesia berstatus Perlu Review. Cek isi dan kunci jawaban tiap soal sebelum menerbitkan.
      </p>
      <label v-if="auth.apiConnected && aiModuleOptions.length" class="field mb">
        <span class="field-label">Materi PDF yang sudah ada di kelas</span>
        <MotionField>
          <select v-model="selectedAiModuleId" class="input" aria-label="Pilih PDF kelas">
            <option value="">Atau unggah file PDF baru di bawah</option>
            <option v-for="m in aiModuleOptions" :key="m.id" :value="String(m.id)">
              {{ m.file_name }} ({{ m.visibility }})
            </option>
          </select>
        </MotionField>
      </label>
      <label class="upload">
        <Icon name="upload" />
        <strong>Pilih / unggah materi PDF baru</strong>
        <small>Format PDF, maksimal 10 MB</small>
        <input
          type="file"
          accept=".pdf"
          aria-label="Pilih materi PDF"
          @change="pdf"
        />
      </label>
      <span v-if="uploadedPdf" class="tiny muted">File baru dipilih: {{ uploadedPdf.name }}</span>
      <label v-if="auth.apiConnected" class="field mt">
        <span class="field-label">Jumlah soal AI</span>
        <MotionField>
          <input v-model.number="aiQuestionCount" class="input" type="number" min="1" max="20" />
        </MotionField>
      </label>
    </template>
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
        :disabled="generatingAi"
        @click="generateAiQuestions"
      >
        {{ generatingAi ? "Menyusun soal AI..." : auth.apiConnected ? "Generate soal AI" : "Gunakan 3 soal contoh" }}
      </button
      ><button v-if="dialog === 'remove'" class="btn danger" @click="remove">
        Hapus soal</button
      ><button v-if="dialog === 'publish'" class="btn primary" @click="publish">
        Ya, terbitkan
      </button></template
    >
  </AppDialog>
</template>
