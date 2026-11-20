<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import PageTitle from "../../components/ui/PageTitle.vue";
import Icon from "../../components/ui/Icon.vue";
import AppDialog from "../../components/ui/AppDialog.vue";
import SoftSelect from "../../components/ui/SoftSelect.vue";
import MotionButton from "../../components/motion/MotionButton.vue";
import MotionField from "../../components/motion/MotionField.vue";
import MotionList from "../../components/motion/MotionList.vue";
import MotionPresence from "../../components/motion/MotionPresence.vue";
import { useLmsStore } from "../../stores/lmsStore.js";
import { useAuthStore } from "../../stores/authStore.js";
import { useAssessmentStore } from "../../stores/assessmentStore.js";
import { useUiStore } from "../../stores/uiStore.js";
import { useTabContentMotion } from "../../composables/useLmsMotion.js";
import { date } from "../../utils/format.js";

const lms = useLmsStore();
const auth = useAuthStore();
const assessmentStore = useAssessmentStore();
const ui = useUiStore();
const route = useRoute();
const router = useRouter();

const activeTab = ref("modules");
const tabBody = ref(null);

const errorBanner = ref("");
const dialogError = ref("");
const createClassOpen = ref(false);
const editClassOpen = ref(false);
const uploadDialogOpen = ref(false);
const announcementDialogOpen = ref(false);

const createClassForm = reactive({ name: "", description: "" });
const creatingClass = ref(false);
const editClassForm = reactive({ name: "", description: "" });
const updatingClass = ref(false);

const uploadInput = ref(null);
const selectedPdfFile = ref(null);
const moduleVisibilityInput = ref("public");
const isDraggingPdf = ref(false);
const uploadingModule = ref(false);
const togglingModuleId = ref(null);
const deletingModuleId = ref(null);
const downloadingModuleId = ref(null);

const announcementForm = reactive({ title: "", content: "" });
const sendingAnnouncement = ref(false);
const deletingAnnouncementId = ref(null);

const aiForm = reactive({
  moduleId: "",
  title: "",
  questionCount: 5,
});
const generatingAi = ref(false);
const openingQuizId = ref(null);

const classOptions = computed(() =>
  lms.classes.map((c) => ({
    value: String(c.id),
    label: c.class_code ? `${c.name} (${c.class_code})` : c.name,
  })),
);

const moduleSelectOptions = computed(() =>
  lms.modules.map((m) => ({
    value: String(m.id),
    label: `${m.file_name} · ${m.visibility}`,
  })),
);

const visibilityOptions = [
  { value: "public", label: "Public — Terlihat murid" },
  { value: "private", label: "Private — Hanya guru" },
];

const selectedPdfSizeLabel = computed(() => {
  if (!selectedPdfFile.value) return "";
  const sizeMb = selectedPdfFile.value.size / (1024 * 1024);
  return `${sizeMb < 0.01 ? "0.01" : sizeMb.toFixed(2)} MB`;
});

const selectedClassValue = computed({
  get: () => (lms.activeClassId ? String(lms.activeClassId) : ""),
  set: (val) => {
    if (val) handleSelectClass(Number(val));
  },
});

const { stop: stopTabMotion } = useTabContentMotion(tabBody, activeTab);

function clearErrorBanner() {
  errorBanner.value = "";
}

function notifySuccess(msg) {
  errorBanner.value = "";
  dialogError.value = "";
  ui.toast(msg);
}

function notifyError(msg) {
  errorBanner.value = msg;
  if (ui.message) ui.dismissToast();
}

function resetUploadState() {
  selectedPdfFile.value = null;
  moduleVisibilityInput.value = "public";
  isDraggingPdf.value = false;
  if (uploadInput.value) uploadInput.value.value = "";
}

function syncEditClassForm(cls = lms.currentClass) {
  editClassForm.name = cls?.name || "";
  editClassForm.description = cls?.description || "";
}

function openCreateClassDialog() {
  clearErrorBanner();
  dialogError.value = "";
  createClassForm.name = "";
  createClassForm.description = "";
  createClassOpen.value = true;
}

function closeCreateClassDialog() {
  dialogError.value = "";
  createClassForm.name = "";
  createClassForm.description = "";
  createClassOpen.value = false;
}

function openEditClassDialog() {
  clearErrorBanner();
  dialogError.value = "";
  syncEditClassForm();
  editClassOpen.value = true;
}

function closeEditClassDialog() {
  dialogError.value = "";
  syncEditClassForm();
  editClassOpen.value = false;
}

function openUploadDialog() {
  clearErrorBanner();
  dialogError.value = "";
  resetUploadState();
  uploadDialogOpen.value = true;
}

function closeUploadDialog() {
  dialogError.value = "";
  resetUploadState();
  uploadDialogOpen.value = false;
}

function openAnnouncementDialog() {
  clearErrorBanner();
  dialogError.value = "";
  announcementForm.title = "";
  announcementForm.content = "";
  announcementDialogOpen.value = true;
}

function closeAnnouncementDialog() {
  dialogError.value = "";
  announcementForm.title = "";
  announcementForm.content = "";
  announcementDialogOpen.value = false;
}

async function initData() {
  try {
    const items = await lms.loadClasses({ selectFirst: false });
    const rawParam = route.params.id;
    const paramId = Number(rawParam);
    if (paramId && items.some((c) => Number(c.id) === paramId)) {
      await lms.selectClass(paramId);
    } else if (items.length > 0) {
      await lms.selectClass(items[0].id);
      if (rawParam) {
        await router.replace(`/classes/${items[0].id}`);
      }
    } else if (rawParam) {
      await router.replace("/classes");
    }
  } catch (err) {
    notifyError(lms.error || err?.message || "Gagal memuat daftar kelas.");
  }
}

onMounted(() => {
  initData();
});

watch(
  () => route.params.id,
  async (nextId) => {
    if (!route.path.startsWith("/classes") || !nextId) return;
    const num = Number(nextId);
    if (!Number.isInteger(num) || num <= 0) {
      if (lms.classes.length > 0) {
        const fallbackId = lms.classes[0].id;
        try {
          if (Number(lms.activeClassId) !== Number(fallbackId)) {
            await lms.selectClass(fallbackId);
          }
          await router.replace(`/classes/${fallbackId}`);
        } catch (err) {
          notifyError(lms.error || err?.message || "Gagal memuat detail kelas.");
        }
      } else {
        await router.replace("/classes");
      }
      return;
    }
    if (lms.classes.length > 0 && !lms.classes.some((c) => Number(c.id) === num)) {
      const fallbackId = lms.classes[0].id;
      try {
        if (Number(lms.activeClassId) !== Number(fallbackId)) {
          await lms.selectClass(fallbackId);
        }
        await router.replace(`/classes/${fallbackId}`);
      } catch (err) {
        notifyError(lms.error || err?.message || "Gagal memuat detail kelas.");
      }
      return;
    }
    if (num !== Number(lms.activeClassId)) {
      clearErrorBanner();
      resetUploadState();
      try {
        await lms.selectClass(num);
      } catch (err) {
        notifyError(lms.error || err?.message || "Gagal memuat detail kelas.");
      }
    }
  },
);

watch(
  () => lms.currentClass,
  (cls) => {
    if (cls) {
      syncEditClassForm(cls);
    }
  },
  { immediate: true },
);

watch(
  () => lms.activeClassId,
  () => {
    resetUploadState();
  },
);

watch(
  () => lms.modules,
  (list) => {
    if (!Array.isArray(list) || list.length === 0) {
      aiForm.moduleId = "";
      return;
    }
    if (aiForm.moduleId && !list.some((m) => Number(m.id) === Number(aiForm.moduleId))) {
      aiForm.moduleId = "";
      return;
    }
    if (!aiForm.moduleId) {
      aiForm.moduleId = String(list[0].id);
    }
  },
  { immediate: true },
);

watch(createClassOpen, (isOpen) => {
  dialogError.value = "";
  if (!isOpen) {
    createClassForm.name = "";
    createClassForm.description = "";
  }
});

watch(editClassOpen, () => {
  dialogError.value = "";
  syncEditClassForm();
});

watch(uploadDialogOpen, () => {
  dialogError.value = "";
  resetUploadState();
});

watch(announcementDialogOpen, (isOpen) => {
  dialogError.value = "";
  if (!isOpen) {
    announcementForm.title = "";
    announcementForm.content = "";
  }
});

async function handleSelectClass(classId) {
  if (!classId) return;
  const previousClassId = lms.currentClass?.id ?? lms.activeClassId;
  clearErrorBanner();
  dialogError.value = "";
  resetUploadState();
  aiForm.moduleId = "";
  try {
    await lms.selectClass(classId);
    if (Number(route.params.id) !== Number(classId)) {
      await router.replace(`/classes/${classId}`);
    }
  } catch (err) {
    if (previousClassId && Number(lms.currentClass?.id) === Number(previousClassId)) {
      lms.activeClassId = Number(previousClassId);
    }
    notifyError(lms.error || err?.message || "Gagal memuat detail kelas.");
  }
}

async function handleCreateClass() {
  if (creatingClass.value) return;
  const trimmedName = createClassForm.name.trim();
  if (!trimmedName) {
    dialogError.value = "Nama kelas wajib diisi.";
    return;
  }
  creatingClass.value = true;
  dialogError.value = "";
  try {
    const created = await lms.createClass({
      name: trimmedName,
      description: createClassForm.description.trim(),
    });
    closeCreateClassDialog();
    const className = created?.name || trimmedName;
    const codeText = created?.class_code ? ` (${created.class_code})` : "";
    notifySuccess(`Kelas "${className}" dibuat${codeText}.`);
    if (created?.id) {
      await router.replace(`/classes/${created.id}`);
    }
  } catch (err) {
    dialogError.value = lms.error || err?.message || "Gagal membuat kelas.";
  } finally {
    creatingClass.value = false;
  }
}

async function handleUpdateClass({ regenerateCode = false } = {}) {
  if (!lms.currentClass || updatingClass.value) return;
  const trimmedName = editClassForm.name.trim();
  if (!trimmedName) {
    dialogError.value = "Nama kelas wajib diisi.";
    return;
  }
  updatingClass.value = true;
  dialogError.value = "";
  try {
    const updated = await lms.updateClass(lms.currentClass.id, {
      name: trimmedName,
      description: editClassForm.description.trim(),
      regenerate_code: regenerateCode,
    });
    closeEditClassDialog();
    notifySuccess(
      regenerateCode
        ? updated?.class_code
          ? `Kode kelas baru: ${updated.class_code}.`
          : "Kode kelas baru berhasil dibuat."
        : "Informasi kelas diperbarui.",
    );
  } catch (err) {
    dialogError.value = lms.error || err?.message || "Gagal memperbarui kelas.";
  } finally {
    updatingClass.value = false;
  }
}

async function copyClassCode() {
  const code = lms.currentClass?.class_code;
  if (!code) return;
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(code).catch(() => {});
  }
  notifySuccess(`Kode kelas ${code} disalin.`);
}

const MAX_PDF_BYTES = 20 * 1024 * 1024;

function validateAndSelectPdfFile(file, inputEl = uploadInput.value) {
  if (!file) {
    selectedPdfFile.value = null;
    return false;
  }
  const isPdfExtension = file.name.toLowerCase().endsWith(".pdf");
  const isPdfMime = file.type === "application/pdf" || file.type === "application/x-pdf";
  const hasConflictingMime = Boolean(file.type) && !isPdfMime;
  if ((!isPdfExtension && !isPdfMime) || hasConflictingMime) {
    selectedPdfFile.value = null;
    if (inputEl) inputEl.value = "";
    dialogError.value = "Hanya file berformat PDF yang diperbolehkan.";
    return false;
  }
  if (file.size === 0) {
    selectedPdfFile.value = null;
    if (inputEl) inputEl.value = "";
    dialogError.value = "File PDF tidak boleh kosong (0 byte).";
    return false;
  }
  if (file.size > MAX_PDF_BYTES) {
    selectedPdfFile.value = null;
    if (inputEl) inputEl.value = "";
    dialogError.value = "Ukuran file PDF maksimal 20 MiB.";
    return false;
  }
  dialogError.value = "";
  selectedPdfFile.value = file;
  return true;
}

function onFileChange(event) {
  const inputEl = event?.target || uploadInput.value;
  const file = inputEl?.files?.[0] || null;
  if (!file) {
    selectedPdfFile.value = null;
    return;
  }
  validateAndSelectPdfFile(file, inputEl);
}

function onPdfDragOver() {
  if (uploadingModule.value) return;
  isDraggingPdf.value = true;
}

function onPdfDragLeave(event) {
  if (event?.currentTarget && event?.relatedTarget && event.currentTarget.contains(event.relatedTarget)) {
    return;
  }
  isDraggingPdf.value = false;
}

function onPdfDrop(event) {
  isDraggingPdf.value = false;
  if (uploadingModule.value) return;
  const file = event?.dataTransfer?.files?.[0] || null;
  if (!file) return;
  if (uploadInput.value) uploadInput.value.value = "";
  validateAndSelectPdfFile(file, uploadInput.value);
}

async function handleUploadModule() {
  if (uploadingModule.value) return;
  if (!lms.currentClass || !selectedPdfFile.value) {
    dialogError.value = "Pilih file PDF terlebih dahulu.";
    return;
  }
  uploadingModule.value = true;
  dialogError.value = "";
  try {
    await lms.uploadModule(lms.currentClass.id, {
      file: selectedPdfFile.value,
      visibility: moduleVisibilityInput.value,
    });
    closeUploadDialog();
    notifySuccess("Materi PDF berhasil diunggah.");
  } catch (err) {
    dialogError.value = lms.error || err?.message || "Gagal mengunggah PDF.";
  } finally {
    uploadingModule.value = false;
  }
}

async function toggleModuleVisibility(mod) {
  if (togglingModuleId.value === mod.id || deletingModuleId.value === mod.id) return;
  const next = mod.visibility === "public" ? "private" : "public";
  togglingModuleId.value = mod.id;
  try {
    await lms.setModuleVisibility(mod.id, next);
    notifySuccess(`Visibilitas "${mod.file_name}" diubah menjadi ${next}.`);
  } catch (err) {
    notifyError(lms.error || err?.message || "Gagal mengubah visibilitas.");
  } finally {
    if (togglingModuleId.value === mod.id) togglingModuleId.value = null;
  }
}

async function handleDeleteModule(mod) {
  if (deletingModuleId.value === mod.id) return;
  deletingModuleId.value = mod.id;
  try {
    await lms.deleteModule(mod.id);
    notifySuccess(`Materi "${mod.file_name}" dihapus.`);
  } catch (err) {
    notifyError(lms.error || err?.message || "Materi tidak dapat dihapus.");
  } finally {
    if (deletingModuleId.value === mod.id) deletingModuleId.value = null;
  }
}

async function handleDownloadModule(mod) {
  if (downloadingModuleId.value === mod.id || deletingModuleId.value === mod.id) return;
  downloadingModuleId.value = mod.id;
  try {
    await lms.downloadModule(mod.id);
  } catch (err) {
    notifyError(lms.error || err?.message || "Gagal mengunduh materi.");
  } finally {
    if (downloadingModuleId.value === mod.id) downloadingModuleId.value = null;
  }
}

function launchAiQuizFromModule(mod) {
  aiForm.moduleId = String(mod.id);
  activeTab.value = "quizzes";
}

async function handleGenerateQuizAi() {
  if (generatingAi.value) return;
  if (!aiForm.moduleId) {
    notifyError("Pilih materi PDF sumber untuk generate soal AI.");
    return;
  }
  generatingAi.value = true;
  try {
    const job = await lms.generateQuizFromModule(
      Number(aiForm.moduleId),
      Number(aiForm.questionCount) || 5,
      aiForm.title.trim(),
    );
    notifySuccess("Memproses draf kuis AI Bahasa Indonesia...");
    if (job?.id) {
      const finalJob = await lms.pollQuizGeneration(job.id, { maxAttempts: 65, pollWaitMs: 2000 });
      if (finalJob?.status === "completed") {
        aiForm.title = "";
        notifySuccess("Draf kuis AI selesai. Lanjutkan review & publish di halaman Assessment.");
        activeTab.value = "quizzes";
      } else if (finalJob?.status === "queued") {
        notifyError("Permintaan generate AI masih dalam antrean (queued). Pastikan queue worker assessment-backend berjalan (composer run serve atau composer run worker).");
      } else {
        notifyError("Proses generate AI masih berjalan di latar belakang. Muat ulang tab Kuis beberapa saat lagi.");
      }
    }
  } catch (err) {
    notifyError(lms.error || err?.message || "Gagal generate soal AI.");
  } finally {
    generatingAi.value = false;
  }
}

async function openQuizInAssessment(quiz) {
  if (openingQuizId.value === quiz.id) return;
  openingQuizId.value = quiz.id;
  try {
    const syncedId = await assessmentStore.ensureQuizSynced(quiz, lms.currentClass);
    const targetId = syncedId || `api-quiz-${quiz.id}`;
    const targetRoute = quiz.status === "draft" ? `/builder/${targetId}` : `/results/${targetId}`;
    await router.push(targetRoute);
  } catch (err) {
    notifyError(err?.message || "Gagal membuka kuis di halaman Assessment.");
  } finally {
    openingQuizId.value = null;
  }
}

async function handleSendAnnouncement() {
  if (sendingAnnouncement.value) return;
  if (!lms.currentClass || !announcementForm.title.trim() || !announcementForm.content.trim()) {
    dialogError.value = "Judul dan isi pengumuman wajib diisi.";
    return;
  }
  sendingAnnouncement.value = true;
  dialogError.value = "";
  try {
    await lms.createAnnouncement(lms.currentClass.id, {
      title: announcementForm.title.trim(),
      content: announcementForm.content.trim(),
    });
    closeAnnouncementDialog();
    notifySuccess("Pengumuman dikirim ke murid terdaftar.");
  } catch (err) {
    dialogError.value = lms.error || err?.message || "Gagal mengirim pengumuman.";
  } finally {
    sendingAnnouncement.value = false;
  }
}

function submitDialogForm(handler) {
  handler();
}

async function handleDeleteAnnouncement(item) {
  if (deletingAnnouncementId.value === item.id) return;
  deletingAnnouncementId.value = item.id;
  try {
    await lms.deleteAnnouncement(item.id);
    notifySuccess("Pengumuman dihapus.");
  } catch (err) {
    notifyError(lms.error || err?.message || "Gagal menghapus pengumuman.");
  } finally {
    if (deletingAnnouncementId.value === item.id) deletingAnnouncementId.value = null;
  }
}
</script>

<template>
  <PageTitle title="Kelas">
    <MotionButton variant="primary" @click="openCreateClassDialog">
      <Icon name="plus" />
      Buat kelas
    </MotionButton>
  </PageTitle>

  <div class="lms-stack">
    <p v-if="!auth.apiConnected" class="notice">
      Masuk dengan akun Guru terhubung API Backend untuk mengelola kelas, materi PDF, pengumuman, dan AI quiz.
    </p>

    <MotionPresence>
      <div v-if="errorBanner" class="notice warning lms-error-banner" role="alert">
        <span>{{ errorBanner }}</span>
        <button
          type="button"
          class="icon-btn lms-banner-dismiss"
          aria-label="Tutup pesan kesalahan"
          @click="clearErrorBanner"
        >
          <Icon name="x" />
        </button>
      </div>
    </MotionPresence>

    <section v-if="lms.currentClass" class="panel overview-panel" aria-label="Ringkasan kelas aktif">
      <div class="lms-hero-bar">
        <div class="lms-switcher-field">
          <SoftSelect
            v-model="selectedClassValue"
            label="Pilih kelas"
            :options="classOptions"
          />
        </div>
        <div class="lms-hero-actions">
          <button
            v-if="lms.currentClass.class_code"
            type="button"
            class="btn soft"
            @click="copyClassCode"
          >
            <Icon name="copy" />
            Kode: {{ lms.currentClass.class_code }}
          </button>
          <button type="button" class="btn" @click="openEditClassDialog">
            <Icon name="edit" />
            Edit kelas
          </button>
        </div>
      </div>

      <p class="lms-class-summary">
        {{ lms.currentClass.description || "Belum ada deskripsi kelas" }}
      </p>

      <div class="lms-metrics">
        <div class="lms-metric-card">
          <span class="lms-metric-label">Murid terdaftar</span>
          <strong class="lms-metric-value">{{ lms.currentClass.students_count ?? 0 }}</strong>
        </div>
        <div class="lms-metric-card">
          <span class="lms-metric-label">Materi PDF</span>
          <strong class="lms-metric-value">{{ lms.modules.length }}</strong>
        </div>
        <div class="lms-metric-card">
          <span class="lms-metric-label">Pengumuman</span>
          <strong class="lms-metric-value">{{ lms.announcements.length }}</strong>
        </div>
        <div class="lms-metric-card">
          <span class="lms-metric-label">Kuis kelas</span>
          <strong class="lms-metric-value">{{ lms.quizzes.length }}</strong>
        </div>
      </div>

      <nav class="tabs lms-tabs" aria-label="Menu LMS kelas">
        <button type="button" class="tab" :class="{ active: activeTab === 'modules' }" @click="activeTab = 'modules'">
          Materi PDF ({{ lms.modules.length }})
        </button>
        <button type="button" class="tab" :class="{ active: activeTab === 'quizzes' }" @click="activeTab = 'quizzes'">
          Kuis Kelas ({{ lms.quizzes.length }})
        </button>
        <button type="button" class="tab" :class="{ active: activeTab === 'announcements' }" @click="activeTab = 'announcements'">
          Pengumuman ({{ lms.announcements.length }})
        </button>
        <button type="button" class="tab" :class="{ active: activeTab === 'progress' }" @click="activeTab = 'progress'">
          Progres Materi ({{ lms.classProgress.students?.length ?? 0 }})
        </button>
      </nav>
    </section>

    <section v-else class="panel empty">
      Belum ada kelas terdaftar. Klik <strong>Buat kelas</strong> di kanan atas untuk memulai.
    </section>

    <div
      v-if="lms.currentClass"
      ref="tabBody"
      class="lms-tab-body"
      @pointerdown="stopTabMotion"
      @focusin="stopTabMotion"
    >
      <!-- Tab: Materi PDF -->
      <section v-if="activeTab === 'modules'" class="panel" aria-label="Materi PDF">
        <div class="panel-header">
          <div>
            <h2>Materi Pembelajaran PDF</h2>
            <p class="section-caption">Format PDF maksimal 20 MiB · Murid hanya melihat materi berstatus Public</p>
          </div>
          <MotionButton variant="primary" @click="openUploadDialog">
            <Icon name="upload" />
            Upload PDF
          </MotionButton>
        </div>

        <div v-if="!lms.modules.length" class="empty">Belum ada materi PDF di kelas ini.</div>
        <MotionList v-else as="div" class="lms-card-grid" :item-keys="lms.modules.map((m) => m.id)">
          <article v-for="mod in lms.modules" :key="mod.id" :data-motion-key="mod.id" class="lms-item-card">
            <div>
              <div class="lms-item-head">
                <h3 class="lms-item-title">{{ mod.file_name }}</h3>
                <span class="lms-pill" :class="mod.visibility === 'public' ? 'is-success' : 'is-warn'">
                  {{ mod.visibility === "public" ? "Public" : "Private" }}
                </span>
              </div>
              <p class="lms-item-meta">
                <span>Dibaca {{ mod.reads_count ?? 0 }} kali</span>
                <span v-if="mod.created_at">· {{ date(mod.created_at) }}</span>
              </p>
            </div>
            <div class="lms-item-foot">
              <div class="action-row">
                <button
                  type="button"
                  class="btn small primary"
                  :disabled="deletingModuleId === mod.id"
                  @click="launchAiQuizFromModule(mod)"
                >
                  <Icon name="sparkles" />
                  Buat Kuis AI
                </button>
                <button
                  type="button"
                  class="btn small soft"
                  :disabled="togglingModuleId === mod.id || deletingModuleId === mod.id"
                  @click="toggleModuleVisibility(mod)"
                >
                  <Icon name="eye" />
                  {{
                    togglingModuleId === mod.id
                      ? "Menyimpan..."
                      : `Set ${mod.visibility === "public" ? "Private" : "Public"}`
                  }}
                </button>
                <button
                  type="button"
                  class="btn small"
                  :disabled="downloadingModuleId === mod.id || deletingModuleId === mod.id"
                  @click="handleDownloadModule(mod)"
                >
                  <Icon name="download" />
                  {{ downloadingModuleId === mod.id ? "Mengunduh..." : "Unduh" }}
                </button>
              </div>
              <button
                type="button"
                class="btn small danger"
                :disabled="deletingModuleId === mod.id"
                @click="handleDeleteModule(mod)"
              >
                <Icon name="trash" />
                {{ deletingModuleId === mod.id ? "Menghapus..." : "Hapus" }}
              </button>
            </div>
          </article>
        </MotionList>
      </section>

      <!-- Tab: Kuis Kelas (Generate AI + Handoff ke Assessment) -->
      <section v-if="activeTab === 'quizzes'" class="panel" aria-label="Kuis Kelas dan Generate AI">
        <div class="panel-header">
          <div>
            <h2>Kuis Kelas & Generate AI dari PDF</h2>
          </div>
          <RouterLink to="/assessments/all" class="btn soft small">
            Buka Halaman Assessment
          </RouterLink>
        </div>

        <form class="lms-ai-composer lms-card-gap" @submit.prevent="handleGenerateQuizAi">
          <SoftSelect
            v-model="aiForm.moduleId"
            label="Materi PDF sumber"
            :options="moduleSelectOptions"
            :disabled="!lms.modules.length"
          />
          <label class="field">
            <span class="field-label">Jumlah soal</span>
            <MotionField>
              <input v-model.number="aiForm.questionCount" class="input" type="number" min="1" max="50" />
            </MotionField>
          </label>
          <label class="field">
            <span class="field-label">Judul kuis (opsional)</span>
            <MotionField>
              <input v-model="aiForm.title" class="input" type="text" placeholder="Otomatis dari PDF bila kosong" />
            </MotionField>
          </label>
          <MotionButton type="submit" variant="primary" :disabled="generatingAi || !lms.modules.length">
            <Icon name="sparkles" />
            {{ generatingAi ? "Memproses..." : "Generate Soal AI" }}
          </MotionButton>
        </form>

        <div v-if="!lms.quizzes.length" class="empty">Belum ada kuis di kelas ini.</div>
        <MotionList v-else as="div" class="lms-card-grid" :item-keys="lms.quizzes.map((q) => q.id)">
          <article v-for="quiz in lms.quizzes" :key="quiz.id" :data-motion-key="quiz.id" class="lms-item-card">
            <div>
              <div class="lms-item-head">
                <h3 class="lms-item-title">{{ quiz.title }}</h3>
                <div class="lms-item-pills">
                  <span class="lms-pill" :class="quiz.assessment_type === 'assignment' ? 'is-dark' : ''">
                    {{ quiz.assessment_type === "assignment" ? "Tugas" : "Kuis" }}
                  </span>
                  <span class="lms-pill" :class="quiz.status === 'published' ? 'is-success' : quiz.status === 'closed' ? '' : 'is-warn'">
                    {{ quiz.status === "published" ? "Dipublish" : quiz.status === "closed" ? "Ditutup" : "Draft" }}
                  </span>
                </div>
              </div>
              <p class="lms-item-meta">
                <span>{{ quiz.questions_count ?? 0 }} soal</span>
                <span v-if="quiz.deadline">· Deadline: {{ date(quiz.deadline) }}</span>
              </p>
            </div>
            <div class="lms-item-foot">
              <button
                type="button"
                class="btn small"
                :class="quiz.status === 'draft' ? 'primary' : 'soft'"
                :disabled="openingQuizId === quiz.id"
                @click="openQuizInAssessment(quiz)"
              >
                <Icon :name="quiz.status === 'draft' ? 'edit' : 'chart'" />
                {{
                  openingQuizId === quiz.id
                    ? "Membuka..."
                    : quiz.status === "draft"
                      ? "Review & Edit di Assessment"
                      : "Lihat Hasil di Assessment"
                }}
              </button>
            </div>
          </article>
        </MotionList>
      </section>

      <!-- Tab: Pengumuman -->
      <section v-if="activeTab === 'announcements'" class="panel" aria-label="Pengumuman Kelas">
        <div class="panel-header">
          <div>
            <h2>Pengumuman Kelas</h2>
            <p class="section-caption">Otomatis mengirim notifikasi ke seluruh murid kelas ini</p>
          </div>
          <MotionButton variant="primary" @click="openAnnouncementDialog">
            <Icon name="send" />
            Kirim pengumuman
          </MotionButton>
        </div>

        <div v-if="!lms.announcements.length" class="empty">Belum ada pengumuman di kelas ini.</div>
        <MotionList v-else as="div" class="lms-card-grid" :item-keys="lms.announcements.map((a) => a.id)">
          <article v-for="ann in lms.announcements" :key="ann.id" :data-motion-key="ann.id" class="lms-item-card">
            <div>
              <div class="lms-item-head">
                <h3 class="lms-item-title">{{ ann.title }}</h3>
                <span class="lms-pill">{{ ann.created_at ? date(ann.created_at) : "Baru" }}</span>
              </div>
              <p class="lms-item-desc">{{ ann.content }}</p>
            </div>
            <div class="lms-item-foot">
              <span class="lms-item-meta">{{ ann.author_name || ann.teacher_name || "Guru" }}</span>
              <button
                type="button"
                class="btn small danger"
                :disabled="deletingAnnouncementId === ann.id"
                @click="handleDeleteAnnouncement(ann)"
              >
                {{ deletingAnnouncementId === ann.id ? "Menghapus..." : "Hapus" }}
              </button>
            </div>
          </article>
        </MotionList>
      </section>

      <!-- Tab: Progres Materi -->
      <section v-if="activeTab === 'progress'" class="panel" aria-label="Progres Belajar Materi">
        <div class="panel-header">
          <div>
            <h2>Progres Belajar Materi Murid</h2>
            <p class="section-caption">Total materi public: {{ lms.classProgress.total_public_modules ?? 0 }}</p>
          </div>
        </div>

        <div v-if="!lms.classProgress.students?.length" class="empty">
          Belum ada murid terdaftar di kelas ini.
        </div>
        <div v-else class="table-wrap">
          <table class="table mobile-cards">
            <thead>
              <tr>
                <th>Murid</th>
                <th>Email</th>
                <th>Materi Dibaca</th>
                <th>Progres</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="student in lms.classProgress.students" :key="student.student_id">
                <td class="title-cell"><strong>{{ student.name }}</strong></td>
                <td data-label="Email">{{ student.email }}</td>
                <td data-label="Materi Dibaca">{{ student.read_count }} / {{ student.total_modules }}</td>
                <td data-label="Progres" class="lms-progress-cell">
                  <div class="action-row">
                    <div class="progress-track">
                      <div class="progress-fill" :style="{ width: `${student.progress_percentage}%` }" />
                    </div>
                    <strong>{{ student.progress_percentage }}%</strong>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>

  <!-- Dialog: Buat Kelas -->
  <AppDialog :open="createClassOpen" title="Buat Kelas Baru" @close="closeCreateClassDialog">
    <p v-if="dialogError" class="notice warning" role="alert">
      {{ dialogError }}
    </p>
    <form id="lms-create-class-form" class="lms-form-grid" novalidate @submit.prevent="handleCreateClass">
      <label class="field">
        <span class="field-label">Nama kelas</span>
        <MotionField>
          <input v-model="createClassForm.name" class="input" type="text" placeholder="Contoh: Biologi XI IPA 1" required />
        </MotionField>
      </label>
      <label class="field">
        <span class="field-label">Deskripsi singkat</span>
        <MotionField>
          <textarea v-model="createClassForm.description" class="input" rows="3" placeholder="Ringkasan topik pembelajaran" />
        </MotionField>
      </label>
    </form>
    <template #footer>
      <button type="button" class="btn" @click="closeCreateClassDialog">Batal</button>
      <button
        type="button"
        class="btn primary"
        :disabled="creatingClass"
        @click="submitDialogForm(handleCreateClass)"
      >
        {{ creatingClass ? "Menyimpan..." : "Simpan kelas" }}
      </button>
    </template>
  </AppDialog>

  <!-- Dialog: Edit Kelas -->
  <AppDialog :open="editClassOpen" title="Edit Informasi Kelas" @close="closeEditClassDialog">
    <p v-if="dialogError" class="notice warning" role="alert">
      {{ dialogError }}
    </p>
    <form id="lms-edit-class-form" class="lms-form-grid" novalidate @submit.prevent="handleUpdateClass({ regenerateCode: false })">
      <label class="field">
        <span class="field-label">Nama kelas</span>
        <MotionField>
          <input v-model="editClassForm.name" class="input" type="text" required />
        </MotionField>
      </label>
      <label class="field">
        <span class="field-label">Deskripsi kelas</span>
        <MotionField>
          <textarea v-model="editClassForm.description" class="input" rows="3" />
        </MotionField>
      </label>
    </form>
    <template #footer>
      <button type="button" class="btn" @click="closeEditClassDialog">Batal</button>
      <button
        type="button"
        class="btn soft"
        :disabled="updatingClass"
        @click="submitDialogForm(() => handleUpdateClass({ regenerateCode: true }))"
      >
        Buat ulang kode kelas
      </button>
      <button
        type="button"
        class="btn primary"
        :disabled="updatingClass"
        @click="submitDialogForm(() => handleUpdateClass({ regenerateCode: false }))"
      >
        {{ updatingClass ? "Menyimpan..." : "Simpan perubahan" }}
      </button>
    </template>
  </AppDialog>

  <!-- Dialog: Upload PDF -->
  <AppDialog :open="uploadDialogOpen" title="Upload Materi PDF" @close="closeUploadDialog">
    <p v-if="dialogError" class="notice warning" role="alert">
      {{ dialogError }}
    </p>
    <form id="lms-upload-pdf-form" class="lms-form-grid" novalidate @submit.prevent="handleUploadModule">
      <div
        class="lms-file-picker"
        :class="{ dragging: isDraggingPdf }"
        @dragenter.prevent="onPdfDragOver"
        @dragover.prevent="onPdfDragOver"
        @dragleave.prevent="onPdfDragLeave"
        @drop.prevent="onPdfDrop"
      >
        <div class="lms-file-picker-head">
          <Icon name="upload" />
          <div>
            <strong>Pilih atau seret file materi PDF</strong>
            <small>Format PDF (.pdf), maksimal 20 MiB</small>
          </div>
        </div>
        <label class="field">
          <span class="sr-only">File PDF (maksimal 20 MiB)</span>
          <input ref="uploadInput" type="file" accept="application/pdf,.pdf" @change="onFileChange" />
        </label>
        <span v-if="selectedPdfFile" class="lms-item-meta">
          Dipilih: {{ selectedPdfFile.name }} ({{ selectedPdfSizeLabel }})
        </span>
      </div>
      <SoftSelect
        v-model="moduleVisibilityInput"
        label="Visibilitas materi"
        :options="visibilityOptions"
      />
    </form>
    <template #footer>
      <button type="button" class="btn" @click="closeUploadDialog">Batal</button>
      <button
        type="button"
        class="btn primary"
        :disabled="uploadingModule || !selectedPdfFile"
        @click="submitDialogForm(handleUploadModule)"
      >
        <Icon name="upload" />
        {{ uploadingModule ? "Mengunggah..." : "Upload PDF" }}
      </button>
    </template>
  </AppDialog>

  <!-- Dialog: Kirim Pengumuman -->
  <AppDialog :open="announcementDialogOpen" title="Kirim Pengumuman Kelas" @close="closeAnnouncementDialog">
    <p v-if="dialogError" class="notice warning" role="alert">
      {{ dialogError }}
    </p>
    <form id="lms-announcement-form" class="lms-form-grid" novalidate @submit.prevent="handleSendAnnouncement">
      <label class="field">
        <span class="field-label">Judul pengumuman</span>
        <MotionField>
          <input v-model="announcementForm.title" class="input" type="text" placeholder="Contoh: Jadwal Pembahasan Modul 1" required />
        </MotionField>
      </label>
      <label class="field">
        <span class="field-label">Isi pengumuman</span>
        <MotionField>
          <textarea v-model="announcementForm.content" class="input" rows="4" placeholder="Sampaikan pengumuman ke murid terdaftar..." required />
        </MotionField>
      </label>
    </form>
    <template #footer>
      <button type="button" class="btn" @click="closeAnnouncementDialog">Batal</button>
      <button
        type="button"
        class="btn primary"
        :disabled="sendingAnnouncement"
        @click="submitDialogForm(handleSendAnnouncement)"
      >
        <Icon name="send" />
        {{ sendingAnnouncement ? "Mengirim..." : "Kirim pengumuman" }}
      </button>
    </template>
  </AppDialog>
</template>
