<script setup>
import MotionList from "../../components/motion/MotionList.vue";
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAssessmentStore } from "../../stores/assessmentStore.js";
import {
  exportResults,
  finishAttempt,
  statusOf,
} from "../../domain/assessment.js";
import { date, time, download } from "../../utils/format.js";
import PageTitle from "../../components/ui/PageTitle.vue";
import AppDialog from "../../components/ui/AppDialog.vue";
import QuestionPreview from "../../components/assessment/QuestionPreview.vue";
import StatusBadge from "../../components/ui/StatusBadge.vue";
import SoftSelect from "../../components/ui/SoftSelect.vue";
import { gradingDestination, gradingQueue } from "../../domain/teacherWork.js";
import { assessmentResultRows } from "../../domain/resultSummary.js";
import { resultContext } from "../../utils/resultNavigation.js";
import { useAssessmentClock } from "../../composables/useAssessmentClock.js";
const route = useRoute(),
  router = useRouter(),
  store = useAssessmentStore(),
  dialog = ref(""),
  detail = ref(null);
const pendingOnly = computed(() => route.query.filter === "pending");
const now = useAssessmentClock(() => store.db.assessments);
const resultRows = computed(() => assessmentResultRows(store.db));
const classes = computed(() => [...new Set(resultRows.value.map((row) => row.assessment.className))].sort((a, b) => a.localeCompare(b, "id", { numeric: true })));
const courses = computed(() => [...new Set(resultRows.value.map((row) => row.assessment.course))].sort((a, b) => a.localeCompare(b, "id")));
const context = computed(() => resultContext(route.query));
const classFilter = computed(() => context.value.class ?? "");
const courseFilter = computed(() => context.value.course ?? "");
const classOptions = computed(() => [
  { value: "", label: "Semua kelas" },
  ...(classFilter.value && !classes.value.includes(classFilter.value) ? [{ value: classFilter.value, label: classFilter.value + " (tidak tersedia)" }] : []),
  ...classes.value.map(name => ({ value: name, label: name })),
]);
const courseOptions = computed(() => [
  { value: "", label: "Semua mata kuliah" },
  ...(courseFilter.value && !courses.value.includes(courseFilter.value) ? [{ value: courseFilter.value, label: courseFilter.value + " (tidak tersedia)" }] : []),
  ...courses.value.map(name => ({ value: name, label: name })),
]);
const filtered = computed(() => Boolean(classFilter.value || courseFilter.value));
const modeDestination = (pending) => ({ path: route.path, query: { ...context.value, ...(pending ? { filter: "pending" } : {}) } });
const registerDestination = computed(() => ({ path: "/results", query: { ...(pendingOnly.value ? { filter: "pending" } : {}), ...context.value } }));
const detailDestination = (assessment) => ({ path: "/results/" + assessment.id, query: context.value });
function setFilter(key, value) {
  router.replace({ path: route.path, query: { ...route.query, [key]: value || undefined } });
}
const queue = computed(() => gradingQueue(store.db));
const firstPending = (assessment) => queue.value.find((entry) => entry.assessment.id === assessment.id)?.attempts[0];
const reviewDestination = (assessment) => {
  const attempt = firstPending(assessment);
  if (!attempt) return detailDestination(assessment);
  const destination = router.resolve(gradingDestination(assessment, attempt));
  return { path: destination.path, query: { ...destination.query, ...context.value } };
};
const gradeDestination = (attempt) => ({ path: "/grade/" + attempt.id, query: { ...(pendingOnly.value ? { queue: "pending" } : {}), ...context.value } });
const a = computed(() =>
    store.db.assessments.find((x) => x.id === route.params.id),
  ),
  attempts = computed(() =>
    store.db.attempts.filter((x) => x.assessmentId === a.value?.id),
  ),
  submitted = computed(() =>
    attempts.value.filter((x) => x.status === "submitted"),
  ),
  graded = computed(() => submitted.value.filter((x) => x.graded)),
  average = computed(() => resultRows.value.find((row) => row.assessment.id === a.value?.id)?.average ?? "—");
const registerRows = computed(() => {
  const byId = new Map(resultRows.value.map((row) => [row.assessment.id, row]));
  const rows = pendingOnly.value
    ? queue.value.map((entry) => byId.get(entry.assessment.id))
    : [...resultRows.value].sort((a, b) => b.pending - a.pending || a.assessment.title.localeCompare(b.assessment.title, "id"));
  return rows.filter((row) => row
    && (!classFilter.value || row.assessment.className === classFilter.value)
    && (!courseFilter.value || row.assessment.course === courseFilter.value));
});
const registerTotals = computed(() => registerRows.value.reduce((total, row) => ({
  submitted: total.submitted + row.submitted, pending: total.pending + row.pending,
}), { submitted: 0, pending: 0 }));
const visibleAttempts = computed(() => pendingOnly.value
  ? attempts.value.filter((at) => at.status === "submitted" && !at.graded)
  : attempts.value);
function release() {
  const ok = store.run(
    () =>
      store.transaction((db) => {
        const at = db.attempts.filter(
          (x) => x.assessmentId === a.value.id && x.status === "submitted",
        );
        if (!at.length || at.some((x) => !x.graded))
          throw new Error("Selesaikan semua penilaian sebelum merilis hasil.");
        db.assessments.find((x) => x.id === a.value.id).released = true;
        return true;
      }),
    "Hasil sudah dirilis.",
  );
  if (ok) dialog.value = "";
}
function closeAssessment() {
  store.run(
    () =>
      store.transaction((db) => {
        const assessment = db.assessments.find((x) => x.id === a.value.id);
        assessment.state = "closed";
        db.attempts
          .filter(
            (x) =>
              x.assessmentId === assessment.id &&
              x.status === "in_progress" &&
              assessment.type !== "Tugas",
          )
          .forEach((x) => finishAttempt(assessment, x));
      }),
    "Assessment ditutup.",
  );
  dialog.value = "";
}
</script>
<template>
  <template v-if="!route.params.id"
    ><PageTitle
      title="Hasil & penilaian"
      description="Cek pengumpulan, beri feedback, dan rilis hasil."
    />
    <div class="register-filters">
      <SoftSelect label="Kelas" :model-value="classFilter" :options="classOptions" @update:model-value="setFilter('class', $event)" />
      <SoftSelect label="Mata kuliah" :model-value="courseFilter" :options="courseOptions" @update:model-value="setFilter('course', $event)" />
    </div>
    <nav class="grading-filters" aria-label="Filter penilaian">
      <RouterLink :to="modeDestination(false)" class="btn small" :class="{ primary: !pendingOnly }" :aria-current="!pendingOnly ? 'page' : undefined">Semua hasil</RouterLink>
      <RouterLink :to="modeDestination(true)" class="btn small" :class="{ primary: pendingOnly }" :aria-current="pendingOnly ? 'page' : undefined">Perlu dinilai</RouterLink>
    </nav>
    <div v-if="registerRows.length" class="register-summary" aria-live="polite" aria-atomic="true">
      <span><strong>{{ registerRows.length }}</strong> assessment</span>
      <span><strong>{{ registerTotals.submitted }}</strong> pengumpulan</span>
      <span><strong>{{ registerTotals.pending }}</strong> perlu dinilai</span>
    </div>
    <p v-if="pendingOnly && registerRows.length" class="section-caption mb">Urutan berdasarkan pengumpulan terlama yang belum dinilai.</p>
    <section v-if="registerRows.length" class="panel results-register" aria-label="Register hasil assessment">
      <table class="lecturer-table result-register-table">
        <colgroup><col class="register-col-assessment" /><col class="register-col-submitted" /><col class="register-col-grading" /><col class="register-col-average" /><col class="register-col-action" /></colgroup>
        <caption class="sr-only">Hasil assessment{{ classFilter ? ' · ' + classFilter : '' }}{{ courseFilter ? ' · ' + courseFilter : '' }}</caption>
        <thead><tr><th scope="col">Assessment</th><th scope="col">Terkirim</th><th scope="col">Penilaian</th><th scope="col">Rata-rata</th><th scope="col"><span class="sr-only">Tindakan</span></th></tr></thead>
        <tbody>
          <tr v-for="row in registerRows" :key="row.assessment.id" class="result-register-row">
            <th scope="row" class="register-assessment">
              <RouterLink :to="detailDestination(row.assessment)" class="assessment-title register-title">{{ row.assessment.title }}</RouterLink>
              <span class="table-secondary register-meta">{{ row.assessment.course }} · {{ row.assessment.className }}</span>
              <span class="register-state">{{ statusOf(row.assessment, now) }} · {{ row.assessment.released ? 'Hasil dirilis' : 'Rilis ' + (row.assessment.releaseMode === 'manual' ? 'manual' : 'langsung') }}</span>
            </th>
            <td data-label="Terkirim">{{ row.submitted }}</td>
            <td data-label="Penilaian" class="register-progress">
              <span>{{ row.submitted ? row.graded + '/' + row.submitted : '—' }}<span v-if="row.submitted" class="table-secondary"> dinilai</span></span>
              <span v-if="row.pending" class="register-pending">{{ row.pending }} perlu dinilai</span>
            </td>
            <td data-label="Rata-rata" class="register-average">{{ row.average ?? '—' }}</td>
            <td class="register-actions">
              <RouterLink v-if="row.pending" :to="reviewDestination(row.assessment)" class="btn primary small register-grade">{{ row.assessment.type === 'Tugas' ? 'Nilai tugas' : 'Cek pengumpulan' }}<span class="sr-only"> {{ row.assessment.title }}</span></RouterLink>
              <RouterLink v-else :to="detailDestination(row.assessment)" class="btn small register-review">Cek hasil<span class="sr-only"> {{ row.assessment.title }}</span></RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
    <div v-else class="empty panel" role="status">
      <h2>{{ filtered ? 'Tidak ada hasil untuk pilihan ini' : pendingOnly ? 'Semua pengumpulan sudah dinilai' : 'Belum ada assessment terbit' }}</h2>
      <p>{{ filtered ? 'Coba kelas atau mata kuliah lain, atau tampilkan semua hasil.' : pendingOnly ? 'Pengumpulan baru yang memerlukan penilaian akan muncul di sini.' : 'Lanjutkan draft dan terbitkan assessment untuk menerima pengumpulan.' }}</p>
      <RouterLink :to="filtered || pendingOnly ? '/results' : '/assessments/Draft'" class="btn mt">{{ filtered || pendingOnly ? 'Lihat semua hasil' : 'Lanjutkan draft' }}</RouterLink>
    </div></template
  ><template v-else-if="a"
    ><PageTitle :title="a.title" :description="a.course + ' · ' + a.className"
      ><button
        class="btn"
        @click="
          download(exportResults(a, store.db.attempts), 'hasil-assessment.csv')
        "
      >
        Download CSV</button
      ><button
        class="btn primary"
        :disabled="
          a.released || !submitted.length || submitted.some((x) => !x.graded)
        "
        @click="dialog = 'release'"
      >
        {{ a.released ? "Hasil sudah dirilis" : "Rilis hasil" }}
      </button></PageTitle
    >
    <div class="stat-grid mb-5">
      <section class="panel result-stat">
        <span>Pengumpulan</span><strong>{{ submitted.length }}</strong>
      </section>
      <section class="panel result-stat">
        <span>Perlu dinilai</span
        ><strong>{{ submitted.length - graded.length }}</strong>
      </section>
      <section class="panel result-stat">
        <span>Rata-rata nilai</span><strong>{{ average }}</strong>
      </section>
    </div>
    <section class="panel">
      <div class="panel-header">
        <h2>Pengumpulan peserta</h2>
        <StatusBadge :status="statusOf(a, now)" />
      </div>
      <nav class="grading-filters" aria-label="Filter pengumpulan">
        <RouterLink :to="modeDestination(true)" class="btn small" :class="{ primary: pendingOnly }" :aria-current="pendingOnly ? 'page' : undefined">Perlu dinilai</RouterLink>
        <RouterLink :to="modeDestination(false)" class="btn small" :class="{ primary: !pendingOnly }" :aria-current="!pendingOnly ? 'page' : undefined">Semua pengumpulan</RouterLink>
      </nav>
      <p v-if="submitted.some((x) => !x.graded)" class="notice">
        Nilai semua pengumpulan dulu untuk merilis hasil.
      </p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Peserta</th>
              <th>Dikirim</th>
              <th>Status</th>
              <th>Nilai</th>
              <th scope="col"><span class="sr-only">Tindakan</span></th>
            </tr>
          </thead>
          <MotionList as="tbody" :item-keys="visibleAttempts.map((x) => x.id)">
            <tr v-for="at in visibleAttempts" :key="at.id" :data-motion-key="at.id">
              <td>
                <strong>{{ at.studentName }}</strong>
                <div class="table-secondary">{{ at.className }}</div>
              </td>
              <td>
                {{ date(at.submittedAt) }}
                <div class="table-secondary">{{ time(at.submittedAt) }}</div>
              </td>
              <td>
                {{
                  at.status === "submitted"
                    ? at.graded
                      ? "Dinilai"
                      : "Perlu dinilai"
                    : "Mengerjakan"
                }}
              </td>
              <td>{{ at.graded ? at.score : "—" }}</td>
              <td>
                <RouterLink
                  v-if="a.type === 'Tugas' && at.status === 'submitted'"
                  class="btn small"
                  :to="gradeDestination(at)"
                  >{{ at.graded ? "Edit nilai" : "Nilai tugas" }}</RouterLink
                ><button
                  v-else
                  class="btn small"
                  @click="
                    detail = at;
                    dialog = 'detail';
                  "
                >
                  Review
                </button>
              </td>
            </tr>
          </MotionList>
        </table>
        <div v-if="!visibleAttempts.length" class="empty" role="status">
          {{ pendingOnly ? 'Semua pengumpulan sudah dinilai.' : 'Belum ada pengumpulan peserta.' }}
        </div>
      </div>
      <div class="builder-footer">
        <RouterLink :to="registerDestination" class="btn">{{ pendingOnly ? '← Assessment lain yang perlu dinilai' : '← Semua hasil' }}</RouterLink
        ><button
          v-if="['Aktif', 'Terjadwal'].includes(statusOf(a, now))"
          class="btn danger"
          @click="dialog = 'close'"
        >
          Tutup assessment
        </button>
      </div>
    </section></template
  >
  <div v-else class="empty">Assessment tidak ditemukan.</div>
  <AppDialog
    :open="!!dialog"
    :title="
      dialog === 'release'
        ? 'Rilis hasil ke peserta?'
        : dialog === 'close'
          ? 'Tutup assessment?'
          : 'Cek jawaban peserta'
    "
    @close="dialog = ''"
    ><p v-if="dialog === 'release'" class="dialog-copy">
      Peserta akan dapat melihat nilai dan pembahasan.
    </p>
    <p v-if="dialog === 'close'" class="dialog-copy">
      Peserta tidak bisa memulai lagi. Sesi kuis yang berjalan akan dikirim
      dengan jawaban tersimpan.
    </p>
    <template v-if="dialog === 'detail' && detail"
      ><p class="dialog-copy">
        {{ detail.studentName }} · Nilai
        {{ detail.graded ? detail.score : "belum tersedia" }}
      </p>
      <QuestionPreview
        :questions="a.questions"
        :answers="detail.answers" /></template
    ><template #footer
      ><button class="btn" @click="dialog = ''">Kembali</button
      ><button v-if="dialog === 'release'" class="btn primary" @click="release">
        Rilis hasil sekarang</button
      ><button
        v-if="dialog === 'close'"
        class="btn danger"
        @click="closeAssessment"
      >
        Ya, tutup
      </button></template
    ></AppDialog
  >
</template>
