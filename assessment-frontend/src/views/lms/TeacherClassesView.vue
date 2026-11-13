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
const createClassOpen = ref(false);
const editClassOpen = ref(false);
const uploadDialogOpen = ref(false);
const announcementDialogOpen = ref(false);

const createClassForm = reactive({ name: "", description: "" });
const editClassForm = reactive({ name: "", description: "" });

const uploadInput = ref(null);
const selectedPdfFile = ref(null);
const moduleVisibilityInput = ref("public");
const uploadingModule = ref(false);

const announcementForm = reactive({ title: "", content: "" });
const sendingAnnouncement = ref(false);

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
    label: `${c.name} (${c.class_code})`,
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

const selectedClassValue = computed({
  get: () => (lms.activeClassId ? String(lms.activeClassId) : ""),
  set: (val) => {
    if (val) handleSelectClass(Number(val));
  },
});

const { stop: stopTabMotion } = useTabContentMotion(tabBody, activeTab);

function notifySuccess(msg) {
  errorBanner.value = "";
  ui.toast(msg);
}

function notifyError(msg) {
  errorBanner.value = msg;
  ui.toast(msg, true);
}

async function initData() {
  try {
    const items = await lms.loadClasses({ selectFirst: false });
    const paramId = Number(route.params.id);
    if (paramId && items.some((c) => Number(c.id) === paramId)) {
      await lms.selectClass(paramId);
    } else if (items.length > 0) {
      await lms.selectClass(items[0].id);
    }
  } catch {
    // Store records error state
  }
}

onMounted(() => {
  initData();
});

watch(
  () => route.params.id,
  (nextId) => {
    const num = Number(nextId);
    if (num && num !== Number(lms.activeClassId)) {
      lms.selectClass(num).catch(() => {});
    }
  },
);

watch(
  () => lms.currentClass,
  (cls) => {
    if (cls) {
      editClassForm.name = cls.name || "";
      editClassForm.description = cls.description || "";
    }
  },
  { immediate: true },
);

watch(
  () => lms.modules,
  (list) => {
    if (list.length > 0 && !list.some((m) => Number(m.id) === Number(aiForm.moduleId))) {
      aiForm.moduleId = String(list[0].id);
    }
  },
  { immediate: true },
);

async function handleSelectClass(classId) {
  errorBanner.value = "";
  await lms.selectClass(classId);
  if (Number(route.params.id) !== Number(classId)) {
    router.replace(`/classes/${classId}`);
  }
}

async function handleCreateClass() {
  if (!createClassForm.name.trim()) {
    notifyError("Nama kelas wajib diisi.");
    return;
  }
  try {
    const created = await lms.createClass({
      name: createClassForm.name.trim(),
      description: createClassForm.description.trim(),
    });
    createClassForm.name = "";
    createClassForm.description = "";
    createClassOpen.value = false;
    notifySuccess(`Kelas "${created.name}" dibuat (${created.class_code}).`);
    if (created?.id) {
      router.replace(`/classes/${created.id}`);
    }
  } catch (err) {
    notifyError(lms.error || err.message || "Gagal membuat kelas.");
  }
}

async function handleUpdateClass({ regenerateCode = false } = {}) {
  if (!lms.currentClass) return;
  try {
    const updated = await lms.updateClass(lms.currentClass.id, {
      name: editClassForm.name.trim(),
      description: editClassForm.description.trim(),
      regenerate_code: regenerateCode,
    });
    editClassOpen.value = false;
    notifySuccess(
      regenerateCode
        ? `Kode kelas baru: ${updated.class_code}.`
        : "Informasi kelas diperbarui.",
    );
  } catch (err) {
    notifyError(lms.error || err.message || "Gagal memperbarui kelas.");
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

function onFileChange(event) {
  const file = event?.target?.files?.[0] || null;
  if (!file) {
    selectedPdfFile.value = null;
    return;
  }
  const maxBytes = 20 * 1024 * 1024;
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    notifyError("Hanya file berformat PDF yang diperbolehkan.");
    event.target.value = "";
    return;
  }
  if (file.size > maxBytes) {
    notifyError("Ukuran file PDF maksimal 20 MiB.");
    event.target.value = "";
    return;
  }
  selectedPdfFile.value = file;
}

async function handleUploadModule() {
  if (!lms.currentClass || !selectedPdfFile.value) {
    notifyError("Pilih file PDF terlebih dahulu.");
    return;
  }
  uploadingModule.value = true;
  try {
    await lms.uploadModule(lms.currentClass.id, {
      file: selectedPdfFile.value,
      visibility: moduleVisibilityInput.value,
    });
    selectedPdfFile.value = null;
    if (uploadInput.value) uploadInput.value.value = "";
    uploadDialogOpen.value = false;
    notifySuccess("Materi PDF berhasil diunggah.");
  } catch (err) {
    notifyError(lms.error || err.message || "Gagal mengunggah PDF.");
  } finally {
    uploadingModule.value = false;
  }
}

async function toggleModuleVisibility(mod) {
  const next = mod.visibility === "public" ? "private" : "public";
  try {
    await lms.setModuleVisibility(mod.id, next);
    notifySuccess(`Visibilitas "${mod.file_name}" diubah menjadi ${next}.`);
  } catch (err) {
    notifyError(lms.error || err.message || "Gagal mengubah visibilitas.");
  }
}

async function handleDeleteModule(mod) {
  try {
    await lms.deleteModule(mod.id);
    notifySuccess(`Materi "${mod.file_name}" dihapus.`);
  } catch (err) {
    notifyError(lms.error || err.message || "Materi tidak dapat dihapus.");
  }
}

async function handleDownloadModule(mod) {
  try {
    await lms.downloadModule(mod.id);
  } catch (err) {
    notifyError(lms.error || err.message || "Gagal mengunduh materi.");
  }
}

function launchAiQuizFromModule(mod) {
  aiForm.moduleId = String(mod.id);
  activeTab.value = "quizzes";
}

async function handleGenerateQuizAi() {
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
      await lms.pollQuizGeneration(job.id, { maxAttempts: 12, pollWaitMs: 1200 });
      notifySuccess("Draf kuis AI selesai. Lanjutkan review & publish di halaman Assessment.");
      activeTab.value = "quizzes";
    }
  } catch (err) {
    notifyError(lms.error || err.message || "Gagal generate soal AI.");
  } finally {
    generatingAi.value = false;
  }
}

async function openQuizInAssessment(quiz) {
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
  if (!lms.currentClass || !announcementForm.title.trim() || !announcementForm.content.trim()) {
    notifyError("Judul dan isi pengumuman wajib diisi.");
    return;
  }
  sendingAnnouncement.value = true;
  try {
    await lms.createAnnouncement(lms.currentClass.id, {
      title: announcementForm.title.trim(),
      content: announcementForm.content.trim(),
    });
    announcementForm.title = "";
    announcementForm.content = "";
    announcementDialogOpen.value = false;
    notifySuccess("Pengumuman dikirim ke murid terdaftar.");
  } catch (err) {
    notifyError(lms.error || err.message || "Gagal mengirim pengumuman.");
  } finally {
    sendingAnnouncement.value = false;
  }
}

function submitDialogForm(formId, handler) {
  const formEl = typeof document !== "undefined" ? document.getElementById(formId) : null;
  if (formEl && typeof formEl.reportValidity === "function" && !formEl.reportValidity()) return;
  handler();
}

async function handleDeleteAnnouncement(item) {
  try {
    await lms.deleteAnnouncement(item.id);
    notifySuccess("Pengumuman dihapus.");
  } catch (err) {
    notifyError(lms.error || err.message || "Gagal menghapus pengumuman.");
  }
}
</script>

<template>
  <PageTitle title="Kelas">
    <MotionButton variant="primary" @click="createClassOpen = true">
      <Icon name="plus" />
      Buat kelas
    </MotionButton>
  </PageTitle>

  <div class="lms-stack">
    <p v-if="!auth.apiConnected" class="notice">
      Masuk dengan akun Guru terhubung API Backend untuk mengelola kelas, materi PDF, pengumuman, dan AI quiz.
    </p>

    <MotionPresence>
      <p v-if="errorBanner" class="notice warning" role="alert">
        {{ errorBanner }}
      </p>
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
          <button type="button" class="btn soft" @click="copyClassCode">
            <Icon name="copy" />
            Kode: {{ lms.currentClass.class_code }}
          </button>
          <button type="button" class="btn" @click="editClassOpen = true">
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
          <MotionButton variant="primary" @click="uploadDialogOpen = true">
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
                <button type="button" class="btn small primary" @click="launchAiQuizFromModule(mod)">
                  <Icon name="sparkles" />
                  Buat Kuis AI
                </button>
                <button type="button" class="btn small soft" @click="toggleModuleVisibility(mod)">
                  <Icon name="eye" />
                  Set {{ mod.visibility === "public" ? "Private" : "Public" }}
                </button>
                <button type="button" class="btn small" @click="handleDownloadModule(mod)">
                  <Icon name="download" />
                  Unduh
                </button>
              </div>
              <button type="button" class="btn small danger" @click="handleDeleteModule(mod)">
                <Icon name="trash" />
                Hapus
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
            <p class="section-caption">
              Buat draf soal AI 4 opsi Bahasa Indonesia dari materi PDF kelas, lalu review & publish melalui halaman Assessment
            </p>
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
                <span class="lms-pill" :class="quiz.status === 'published' ? 'is-success' : quiz.status === 'closed' ? '' : 'is-warn'">
                  {{ quiz.status === "published" ? "Dipublish" : quiz.status === "closed" ? "Ditutup" : "Draft" }}
                </span>
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
          <MotionButton variant="primary" @click="announcementDialogOpen = true">
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
              <span class="lms-item-meta">{{ ann.teacher_name || "Guru" }}</span>
              <button type="button" class="btn small danger" @click="handleDeleteAnnouncement(ann)">Hapus</button>
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
          <table class="table">
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
                <td><strong>{{ student.name }}</strong></td>
                <td>{{ student.email }}</td>
                <td>{{ student.read_count }} / {{ student.total_modules }}</td>
                <td>
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
  <AppDialog :open="createClassOpen" title="Buat Kelas Baru" @close="createClassOpen = false">
    <form id="lms-create-class-form" class="lms-form-grid" @submit.prevent="handleCreateClass">
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
      <button type="button" class="btn" @click="createClassOpen = false">Batal</button>
      <button type="button" class="btn primary" @click="submitDialogForm('lms-create-class-form', handleCreateClass)">
        Simpan kelas
      </button>
    </template>
  </AppDialog>

  <!-- Dialog: Edit Kelas -->
  <AppDialog :open="editClassOpen" title="Edit Informasi Kelas" @close="editClassOpen = false">
    <form id="lms-edit-class-form" class="lms-form-grid" @submit.prevent="handleUpdateClass({ regenerateCode: false })">
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
      <button type="button" class="btn soft" @click="submitDialogForm('lms-edit-class-form', () => handleUpdateClass({ regenerateCode: true }))">
        Buat ulang kode kelas
      </button>
      <button type="button" class="btn primary" @click="submitDialogForm('lms-edit-class-form', () => handleUpdateClass({ regenerateCode: false }))">
        Simpan perubahan
      </button>
    </template>
  </AppDialog>

  <!-- Dialog: Upload PDF -->
  <AppDialog :open="uploadDialogOpen" title="Upload Materi PDF" @close="uploadDialogOpen = false">
    <form id="lms-upload-pdf-form" class="lms-form-grid" @submit.prevent="handleUploadModule">
      <div class="lms-file-picker">
        <div class="lms-file-picker-head">
          <Icon name="upload" />
          <div>
            <strong>Pilih file materi PDF</strong>
            <small>Format PDF, maksimal 20 MiB</small>
          </div>
        </div>
        <label class="field">
          <span class="sr-only">File PDF (maksimal 20 MiB)</span>
          <input ref="uploadInput" type="file" accept="application/pdf,.pdf" @change="onFileChange" />
        </label>
        <span v-if="selectedPdfFile" class="lms-item-meta">Dipilih: {{ selectedPdfFile.name }}</span>
      </div>
      <SoftSelect
        v-model="moduleVisibilityInput"
        label="Visibilitas materi"
        :options="visibilityOptions"
      />
    </form>
    <template #footer>
      <button type="button" class="btn" @click="uploadDialogOpen = false">Batal</button>
      <button
        type="button"
        class="btn primary"
        :disabled="uploadingModule || !selectedPdfFile"
        @click="submitDialogForm('lms-upload-pdf-form', handleUploadModule)"
      >
        <Icon name="upload" />
        {{ uploadingModule ? "Mengunggah..." : "Upload PDF" }}
      </button>
    </template>
  </AppDialog>

  <!-- Dialog: Kirim Pengumuman -->
  <AppDialog :open="announcementDialogOpen" title="Kirim Pengumuman Kelas" @close="announcementDialogOpen = false">
    <form id="lms-announcement-form" class="lms-form-grid" @submit.prevent="handleSendAnnouncement">
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
      <button type="button" class="btn" @click="announcementDialogOpen = false">Batal</button>
      <button
        type="button"
        class="btn primary"
        :disabled="sendingAnnouncement"
        @click="submitDialogForm('lms-announcement-form', handleSendAnnouncement)"
      >
        <Icon name="send" />
        {{ sendingAnnouncement ? "Mengirim..." : "Kirim pengumuman" }}
      </button>
    </template>
  </AppDialog>
</template>
