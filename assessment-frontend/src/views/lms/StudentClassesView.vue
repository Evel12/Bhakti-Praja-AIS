<script setup>
import { computed, onMounted, ref } from "vue";
import PageTitle from "../../components/ui/PageTitle.vue";
import Icon from "../../components/ui/Icon.vue";
import SoftSelect from "../../components/ui/SoftSelect.vue";
import MotionButton from "../../components/motion/MotionButton.vue";
import MotionField from "../../components/motion/MotionField.vue";
import MotionList from "../../components/motion/MotionList.vue";
import MotionPresence from "../../components/motion/MotionPresence.vue";
import { useLmsStore } from "../../stores/lmsStore.js";
import { useAuthStore } from "../../stores/authStore.js";
import { useUiStore } from "../../stores/uiStore.js";
import { useTabContentMotion, useProgressBarMotion } from "../../composables/useLmsMotion.js";
import { date } from "../../utils/format.js";

const lms = useLmsStore();
const auth = useAuthStore();
const ui = useUiStore();

const joinCode = ref("");
const joining = ref(false);
const activeTab = ref("modules");
const tabBody = ref(null);
const progressBar = ref(null);
const leaveConfirmId = ref(null);
const errorBanner = ref("");

const classOptions = computed(() =>
  lms.classes.map((c) => ({
    value: String(c.id),
    label: `${c.name} (${c.teacher_name || "Guru"})`,
  })),
);

const selectedClassValue = computed({
  get: () => (lms.activeClassId ? String(lms.activeClassId) : ""),
  set: (val) => {
    if (val) handleSelectClass(Number(val));
  },
});

const progressRatio = computed(() => {
  const pct = Number(lms.moduleProgress.progress_percentage ?? 0);
  return Math.max(0, Math.min(1, pct / 100));
});

const { stop: stopTabMotion } = useTabContentMotion(tabBody, activeTab);
useProgressBarMotion(progressBar, progressRatio);

function notifySuccess(msg) {
  errorBanner.value = "";
  ui.toast(msg);
}

function notifyError(msg) {
  errorBanner.value = msg;
  ui.toast(msg, true);
}

onMounted(() => {
  lms.loadClasses().catch(() => {});
});

async function handleJoinClass() {
  const code = joinCode.value.trim();
  if (!code) {
    notifyError("Masukkan kode kelas terlebih dahulu.");
    return;
  }
  joining.value = true;
  try {
    const joined = await lms.joinClass(code);
    joinCode.value = "";
    notifySuccess(`Berhasil bergabung ke kelas "${joined.name}".`);
  } catch (err) {
    notifyError(lms.error || err.message || "Gagal bergabung ke kelas.");
  } finally {
    joining.value = false;
  }
}

async function handleSelectClass(classId) {
  leaveConfirmId.value = null;
  errorBanner.value = "";
  await lms.selectClass(classId);
}

async function handleLeaveClass(classId) {
  try {
    await lms.leaveClass(classId);
    leaveConfirmId.value = null;
    notifySuccess("Anda telah keluar dari kelas tersebut.");
  } catch (err) {
    notifyError(lms.error || err.message || "Gagal keluar dari kelas.");
  }
}

async function handleDownload(mod) {
  try {
    await lms.downloadModule(mod.id);
  } catch (err) {
    notifyError(lms.error || err.message || "Gagal mengunduh materi PDF.");
  }
}

async function handleMarkRead(mod) {
  try {
    await lms.markModuleRead(mod.id);
    notifySuccess(`Materi "${mod.file_name}" ditandai sudah dibaca.`);
  } catch (err) {
    notifyError(lms.error || err.message || "Gagal memperbarui progres baca.");
  }
}
</script>

<template>
  <PageTitle title="Kelas & Materi Saya" />

  <div class="lms-stack">
    <p v-if="!auth.apiConnected" class="notice">
      Masuk dengan akun Murid terhubung API Backend untuk bergabung kelas via kode, membaca materi PDF, dan memantau progres.
    </p>

    <MotionPresence>
      <p v-if="errorBanner" class="notice warning" role="alert">
        {{ errorBanner }}
      </p>
    </MotionPresence>

    <section class="panel" aria-label="Gabung kelas dengan kode">
      <div class="panel-header">
        <div>
          <h2>Gabung Kelas Baru</h2>
          
        </div>
      </div>
      <form class="lms-join-bar" @submit.prevent="handleJoinClass">
        <div class="lms-join-input">
          <MotionField>
            <input
              v-model="joinCode"
              class="input"
              type="text"
              maxlength="16"
              placeholder="Masukkan kode kelas (misal: AB12CD34)"
              aria-label="Kode kelas"
            />
          </MotionField>
        </div>
        <MotionButton type="submit" variant="primary" :disabled="joining">
          <Icon name="plus" />
          {{ joining ? "Memproses..." : "Gabung kelas" }}
        </MotionButton>
      </form>
    </section>

    <section v-if="lms.currentClass" class="panel overview-panel" aria-label="Ringkasan kelas diikuti">
      <div class="lms-hero-bar">
        <div class="lms-switcher-field">
          <SoftSelect
            v-model="selectedClassValue"
            label="Kelas diikuti"
            :options="classOptions"
          />
        </div>
        <div class="lms-hero-actions">
          <MotionPresence>
            <button
              v-if="leaveConfirmId !== lms.currentClass.id"
              type="button"
              class="btn small danger"
              @click="leaveConfirmId = lms.currentClass.id"
            >
              <Icon name="logout" />
              Keluar kelas
            </button>
            <div v-else class="action-row">
              <button
                type="button"
                class="btn small primary"
                @click="handleLeaveClass(lms.currentClass.id)"
              >
                Konfirmasi keluar
              </button>
              <button type="button" class="btn small" @click="leaveConfirmId = null">
                Batal
              </button>
            </div>
          </MotionPresence>
        </div>
      </div>

      <p class="lms-class-summary">
        Pengajar: <strong>{{ lms.currentClass.teacher_name || "Guru" }}</strong>
        <span v-if="lms.currentClass.description"> · {{ lms.currentClass.description }}</span>
      </p>

      <div class="lms-progress-block" aria-label="Progres belajar materi">
        <div class="lms-progress-header">
          <span>Progres Baca Materi</span>
          <strong>
            {{ lms.moduleProgress.read_count ?? 0 }} / {{ lms.moduleProgress.total_modules ?? 0 }}
            ({{ lms.moduleProgress.progress_percentage ?? 0 }}%)
          </strong>
        </div>
        <div class="lms-progress-track">
          <div
            ref="progressBar"
            class="lms-progress-fill"
            :style="{ transform: `scaleX(${progressRatio})` }"
          />
        </div>
      </div>

      <nav class="tabs lms-tabs is-three" aria-label="Menu materi kelas murid">
        <button type="button" class="tab" :class="{ active: activeTab === 'modules' }" @click="activeTab = 'modules'">
          Materi PDF ({{ lms.modules.length }})
        </button>
        <button type="button" class="tab" :class="{ active: activeTab === 'assignments' }" @click="activeTab = 'assignments'">
          Tugas ({{ lms.assignments.length }})
        </button>
        <button type="button" class="tab" :class="{ active: activeTab === 'announcements' }" @click="activeTab = 'announcements'">
          Pengumuman ({{ lms.announcements.length }})
        </button>
      </nav>
    </section>

    <section v-else class="panel empty">
      Belum bergabung ke kelas mana pun. Masukkan kode kelas di atas untuk mulai belajar.
    </section>

    <div
      v-if="lms.currentClass"
      ref="tabBody"
      class="lms-tab-body"
      @pointerdown="stopTabMotion"
      @focusin="stopTabMotion"
    >
      <section v-if="activeTab === 'modules'" class="panel" aria-label="Daftar materi PDF">
        <div class="panel-header">
          <div>
            <h2>Materi Pembelajaran PDF</h2>
            <p class="section-caption">Unduh materi dan tandai yang sudah selesai Anda pelajari</p>
          </div>
        </div>
        <div v-if="!lms.modules.length" class="empty">Belum ada materi PDF public di kelas ini.</div>
        <MotionList v-else as="div" class="lms-card-grid" :item-keys="lms.modules.map((m) => m.id)">
          <article v-for="mod in lms.modules" :key="mod.id" :data-motion-key="mod.id" class="lms-item-card">
            <div>
              <div class="lms-item-head">
                <h3 class="lms-item-title">{{ mod.file_name }}</h3>
                <span class="lms-pill" :class="mod.is_read ? 'is-success' : 'is-warn'">
                  {{ mod.is_read ? "Sudah dibaca" : "Belum dibaca" }}
                </span>
              </div>
              <p class="lms-item-meta">
                <span v-if="mod.read_at">Dibaca {{ date(mod.read_at) }}</span>
                <span v-else>Klik Unduh PDF atau Tandai dibaca setelah selesai</span>
              </p>
            </div>
            <div class="lms-item-foot">
              <button type="button" class="btn small soft" @click="handleDownload(mod)">
                <Icon name="download" />
                Unduh PDF
              </button>
              <button
                type="button"
                class="btn small primary"
                :disabled="mod.is_read"
                @click="handleMarkRead(mod)"
              >
                <Icon name="checkCircle" />
                {{ mod.is_read ? "Sudah dibaca" : "Tandai dibaca" }}
              </button>
            </div>
          </article>
        </MotionList>
      </section>

      <section v-if="activeTab === 'assignments'" class="panel" aria-label="Daftar tugas pembelajaran">
        <div class="panel-header">
          <div>
            <h2>Tugas Pembelajaran</h2>
            <p class="section-caption">Daftar instruksi tugas yang dibagikan guru (hanya baca)</p>
          </div>
        </div>
        <div v-if="!lms.assignments.length" class="empty">Belum ada tugas dipublish untuk kelas ini.</div>
        <MotionList v-else as="div" class="lms-card-grid" :item-keys="lms.assignments.map((a) => a.id)">
          <article v-for="item in lms.assignments" :key="item.id" :data-motion-key="item.id" class="lms-item-card">
            <div>
              <div class="lms-item-head">
                <h3 class="lms-item-title">{{ item.title }}</h3>
                <span class="lms-pill">Skor: {{ item.total_score }}</span>
              </div>
              <p class="lms-item-meta">
                <span v-if="item.due_date">Deadline: {{ date(item.due_date) }}</span>
                <span v-else>Tanpa deadline</span>
              </p>
              <p v-if="item.description" class="lms-item-desc">{{ item.description }}</p>
            </div>
          </article>
        </MotionList>
      </section>

      <section v-if="activeTab === 'announcements'" class="panel" aria-label="Pengumuman kelas">
        <div class="panel-header">
          <div>
            <h2>Pengumuman Kelas</h2>
            <p class="section-caption">Informasi terbaru dari pengajar kelas ini</p>
          </div>
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
            </div>
          </article>
        </MotionList>
      </section>
    </div>
  </div>
</template>
