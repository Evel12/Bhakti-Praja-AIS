<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useAssessmentStore } from "../../stores/assessmentStore.js";
import { statusOf } from "../../domain/assessment.js";
import { dashboardWork, gradingQueue } from "../../domain/teacherWork.js";
import { assessmentResultRows, classGradeRows } from "../../domain/resultSummary.js";
import { date, time, deadlineDay } from "../../utils/format.js";
import { useAssessmentClock } from "../../composables/useAssessmentClock.js";
import PageTitle from "../../components/ui/PageTitle.vue";
import Icon from "../../components/ui/Icon.vue";
import SoftSelect from "../../components/ui/SoftSelect.vue";
const store = useAssessmentStore(),
  router = useRouter();
const now = useAssessmentClock(() => store.db.assessments);
const selectedCourse = ref("");
const resultRows = computed(() => assessmentResultRows(store.db));
const courses = computed(() => [...new Set(resultRows.value.map((row) => row.assessment.course))].sort((a, b) => a.localeCompare(b, "id")));
const courseOptions = computed(() => courses.value.map(name => ({ value: name, label: name })));
const course = computed(() => courses.value.includes(selectedCourse.value) ? selectedCourse.value : courses.value[0] ?? "");
const classGrades = computed(() => classGradeRows(resultRows.value, course.value));
const active = computed(
    () => store.db.assessments.filter((a) => statusOf(a, now.value) === "Aktif").length,
  ),
  grading = computed(() => gradingQueue(store.db)),
  pending = computed(() => grading.value.reduce((sum, entry) => sum + entry.attempts.length, 0)),
  work = computed(() => dashboardWork(store.db, now.value).slice(0, 4)),
  upcoming = computed(() =>
    store.db.assessments
      .filter((a) => ["Aktif", "Terjadwal"].includes(statusOf(a, now.value)))
      .sort((a, b) => Date.parse(a.closeAt) - Date.parse(b.closeAt))
      .slice(0, 3),
  );
function create() {
  const id = store.run(() => store.create());
  if (id) router.push("/builder/" + id);
}
</script>
<template>
  <PageTitle
    title="Ringkasan assessment"
    description="Halo lagi! Yuk, cek kelas dan siapkan assessment berikutnya."
    ><button class="btn primary" @click="create">
      <Icon name="plus" />Buat assessment
    </button></PageTitle
  >
  <section class="panel overview-panel dashboard-summary" aria-labelledby="dashboard-summary-title">
    <div class="panel-header">
      <h2 id="dashboard-summary-title">Ringkasan singkat</h2>
      <span class="section-caption">{{ date(new Date(now).toISOString()) }}</span>
    </div>
    <div class="overview-grid lecturer-overview">
      <div class="metric">
        <span class="metric-top">Assessment aktif</span>
        <div class="metric-value-row">
          <span class="metric-value">{{
            String(active).padStart(2, "0")
          }}</span>
        </div>
        <div class="metric-foot">
          <RouterLink to="/assessments/Aktif">Lihat assessment →</RouterLink>
        </div>
      </div>
      <div class="metric">
        <span class="metric-top">Perlu dinilai</span>
        <div class="metric-value-row">
          <span class="metric-value">{{
            String(pending).padStart(2, "0")
          }}</span>
        </div>
        <div class="metric-foot">
          <RouterLink to="/results?filter=pending">Cek sekarang</RouterLink>
        </div>
      </div>
    </div>
  </section>
  <div class="dashboard-grid">
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Perlu dicek</h2>
          <p>Penilaian tertunda, tenggat terdekat, lalu draft yang bisa dilanjutkan.</p>
        </div>
        <RouterLink :to="pending ? '/results?filter=pending' : '/assessments/all'" class="btn ghost small"
          >{{ pending ? 'Semua penilaian tertunda' : 'Semua assessment' }} →</RouterLink
        >
      </div>
      <ul v-if="work.length" class="teacher-work-list">
        <li v-for="task in work" :key="task.assessment.id" class="teacher-work-item" :data-task-kind="task.kind">
          <div class="teacher-work-copy">
            <RouterLink :to="task.to" class="assessment-title">{{ task.assessment.title || 'Draft tanpa judul' }}</RouterLink>
            <p class="table-secondary">{{ task.assessment.course }} · {{ task.assessment.className }}</p>
            <p class="task-reason">{{ task.reason }}<template v-if="task.kind === 'deadline'"> · {{ date(task.assessment.closeAt) }} · {{ time(task.assessment.closeAt) }} WIB</template></p>
          </div>
          <RouterLink :to="task.to" class="btn small">{{ task.action }} →<span class="sr-only"> {{ task.assessment.title || 'Draft tanpa judul' }}</span></RouterLink>
        </li>
      </ul>
      <div v-else class="empty">
        <h3>Semua sudah beres untuk sekarang</h3>
        <p>Buat assessment baru untuk menyiapkan pembelajaran berikutnya.</p>
        <button class="btn mt" @click="create">Buat assessment</button>
      </div>
    </section>
    <aside class="dashboard-aside">
      <section class="panel">
        <div class="panel-header">
          <div><h2>Tenggat terdekat</h2><p>Waktu tutup assessment · WIB</p></div>
          <Icon name="calendar" />
        </div>
        <ul v-if="upcoming.length" class="deadline-list">
          <li v-for="a in upcoming" :key="a.id">
            <RouterLink :to="'/results/' + a.id" class="deadline-entry">
              <p class="deadline-relative">{{ deadlineDay(a.closeAt, now) }}</p>
              <time :datetime="a.closeAt" class="deadline-date">{{ date(a.closeAt) }} · {{ time(a.closeAt) }} WIB</time>
              <h3>{{ a.title }}</h3>
              <p class="deadline-meta">{{ a.type }} · {{ a.className }}</p>
              <span class="deadline-action">Pantau pengumpulan →</span>
            </RouterLink>
          </li>
        </ul>
        <p v-else class="muted">Belum ada tenggat mendatang.</p>
      </section>
      <section class="help-card">
        <h3>Soal yang baik dimulai dari ide sederhana.</h3>
        <p>Pakai lagi soal yang sudah ada supaya lebih cepat.</p>
        <RouterLink to="/bank" class="btn small"
          >Buka bank soal →</RouterLink
        >
      </section>
    </aside>
  </div>
  <section class="panel class-comparison" aria-labelledby="class-grades-title">
    <div class="panel-header class-grades-header">
      <div>
        <h2 id="class-grades-title">Nilai per kelas</h2>
        <p>Rata-rata pengumpulan yang sudah dinilai · skala 0–100.</p>
      </div>
      <SoftSelect v-if="courses.length" label="Mata kuliah" class="class-course-picker" :model-value="course" :options="courseOptions" @update:model-value="selectedCourse = $event" />
    </div>
    <table v-if="classGrades.length" class="lecturer-table class-grades-table">
      <caption class="sr-only">Perbandingan nilai kelas untuk {{ course }}</caption>
      <thead><tr><th scope="col">Kelas</th><th scope="col">Rata-rata</th><th scope="col">Dinilai</th><th scope="col">Perlu dinilai</th><th scope="col"><span class="sr-only">Rincian kelas</span></th></tr></thead>
      <tbody>
        <tr v-for="row in classGrades" :key="row.className">
          <th scope="row">{{ row.className }}</th>
          <td data-label="Rata-rata" class="class-grade-average">{{ row.average === null ? '—' : row.average + '/100' }}</td>
          <td data-label="Dinilai">{{ row.graded }}</td>
          <td data-label="Perlu dinilai"><span :class="{ 'pending-count': row.pending }">{{ row.pending }}</span></td>
          <td><RouterLink class="register-link" :to="{ path: '/results', query: { class: row.className, course } }" :aria-label="'Rincian ' + course + ' · ' + row.className">Rincian <Icon name="arrow" /></RouterLink></td>
        </tr>
      </tbody>
    </table>
    <p v-if="classGrades.length && classGrades.every((row) => row.average === null)" class="section-caption class-grade-note">Belum ada hasil dinilai untuk mata kuliah ini.</p>
    <div v-if="!courses.length" class="empty">
      <h3>Belum ada assessment terbit</h3>
      <p>Perbandingan kelas muncul setelah assessment diterbitkan. Nilai ditampilkan setelah pengumpulan dinilai.</p>
      <RouterLink to="/assessments/Draft" class="btn mt">Lanjutkan draft</RouterLink>
    </div>
  </section>
</template>
