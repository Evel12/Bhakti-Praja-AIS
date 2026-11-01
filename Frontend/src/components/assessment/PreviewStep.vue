<script setup>
import { computed } from "vue";
import { date, time } from "../../utils/format.js";
import QuestionPreview from "./QuestionPreview.vue";

const props = defineProps({ draft: Object, issues: { type: Array, required: true } });
const emit = defineEmits(["resolve"]);
const steps = ["Identitas", "Konten", "Pengaturan"];
const ready = computed(() => !props.issues.length);
const contentReady = computed(() => !props.issues.some((issue) => issue.step === 1));
const task = computed(() => props.draft.type === "Tugas");
const totalPoints = computed(() => {
  if (props.issues.some((issue) => issue.field === "points")) return "Belum valid";
  return props.draft.questions.reduce((total, question) => total + Number(question.points), 0) + " poin";
});
function schedule(value) {
  return Number.isFinite(Date.parse(value)) ? `${date(value)} · ${time(value)} WIB` : "Belum diatur";
}
</script>
<template>
  <div class="publication-readiness">
    <h2>{{ ready ? "Siap diterbitkan" : "Belum siap diterbitkan" }}</h2>
    <p class="section-caption readiness-copy" role="status">
      {{ ready
        ? "Semua isian sudah lengkap. Cek sekali lagi sebelum terbit."
        : `${issues.length} hal perlu diperbaiki. Klik bagian di bawah untuk melengkapinya.` }}
    </p>
    <div v-if="!ready" class="error-box readiness-issues" role="alert">
      <strong>Cek kembali</strong>
      <ul>
        <li v-for="issue in issues" :key="issue.target">
          <a :href="'#' + issue.target" @click.prevent="emit('resolve', issue)">{{ steps[issue.step] }} · {{ issue.message }}</a>
        </li>
      </ul>
    </div>
  </div>

  <h3>Ringkasan assessment</h3>
  <dl class="detail-grid publication-summary">
    <div><dt>Judul</dt><dd>{{ draft.title.trim() || "Belum diisi" }}</dd></div>
    <div><dt>Mata kuliah</dt><dd>{{ draft.course || "Belum dipilih" }}</dd></div>
    <div><dt>Kelas</dt><dd>{{ draft.className || "Belum dipilih" }}</dd></div>
    <div><dt>Jenis</dt><dd>{{ draft.type }}</dd></div>
    <div>
      <dt>Durasi</dt>
      <dd>{{ task ? "Sampai tenggat pengumpulan" : issues.some((issue) => issue.field === 'duration') ? "Belum valid" : `${draft.duration} menit` }}</dd>
    </div>
    <div><dt>Jumlah soal</dt><dd>{{ task ? "Tidak berlaku untuk tugas" : `${draft.questions.length} soal` }}</dd></div>
    <div><dt>Total poin</dt><dd>{{ task ? "Penilaian manual · nilai 0–100" : totalPoints }}</dd></div>
    <div><dt>Waktu buka (WIB)</dt><dd>{{ schedule(draft.openAt) }}</dd></div>
    <div><dt>Waktu tutup (WIB)</dt><dd>{{ schedule(draft.closeAt) }}</dd></div>
    <div>
      <dt>Rilis nilai</dt>
      <dd>{{ draft.releaseMode === "manual" ? "Manual oleh pengajar" : "Langsung setelah peserta mengirim jawaban" }}</dd>
    </div>
  </dl>
  <section class="publication-content" aria-label="Preview konten">
    <h3>Preview konten</h3>
    <template v-if="contentReady">
      <p v-if="draft.instructions" class="body-copy preview-instructions">{{ draft.instructions }}</p>
      <QuestionPreview v-if="!task" :questions="draft.questions" />
    </template>
    <p v-else class="notice">{{ task
      ? "Konten belum lengkap. Lengkapi instruksi tugas melalui tautan perbaikan di atas."
      : "Konten belum lengkap. Perbaiki isian Konten di atas untuk menampilkan preview soal dan kunci jawaban." }}</p>
  </section>
  <p class="notice publication-lock">Konten dikunci setelah terbit. Pastikan kelas, jadwal, dan {{ task ? "instruksi tugas" : "kunci jawaban" }} sudah sesuai.</p>
</template>
<style scoped>
.publication-readiness {
  padding-bottom: 24px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--line);
}
.readiness-copy {
  margin-top: 10px;
  max-width: 65ch;
}
.readiness-issues {
  margin-top: 16px;
}
.readiness-issues a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding-block: 6px;
  overflow-wrap: anywhere;
}
.publication-summary {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 16px;
}
.publication-summary dd {
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
.publication-content {
  margin-top: 28px;
}
.preview-instructions,
.publication-content .notice {
  margin-top: 12px;
}
.publication-lock {
  margin-top: 24px;
}
@media (max-width: 640px) {
  .publication-summary {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
