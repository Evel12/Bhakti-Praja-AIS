<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useAssessmentStore } from "../../stores/assessmentStore.js";
import { statusOf } from "../../domain/assessment.js";
import { date, time } from "../../utils/format.js";
import PageTitle from "../../components/ui/PageTitle.vue";
import Icon from "../../components/ui/Icon.vue";
import AssessmentTable from "../../components/assessment/AssessmentTable.vue";
const store = useAssessmentStore(),
  router = useRouter();
const active = computed(
    () => store.db.assessments.filter((a) => statusOf(a) === "Aktif").length,
  ),
  pending = computed(
    () =>
      store.db.attempts.filter((a) => a.status === "submitted" && !a.graded)
        .length,
  ),
  graded = computed(() => store.db.attempts.filter((a) => a.graded)),
  avg = computed(() =>
    graded.value.length
      ? Math.round(
          graded.value.reduce((s, a) => s + a.score, 0) / graded.value.length,
        )
      : 0,
  ),
  upcoming = computed(() =>
    store.db.assessments
      .filter((a) => ["Aktif", "Terjadwal"].includes(statusOf(a)))
      .sort((a, b) => Date.parse(a.closeAt) - Date.parse(b.closeAt))
      .slice(0, 3),
  );
const now = new Date(),
  weekday = (now.getDay() + 6) % 7,
  week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + i - weekday);
    return d.getDate();
  });
function create() {
  const id = store.run(() => store.create());
  if (id) router.push("/builder/" + id);
}
</script>
<template>
  <PageTitle
    title="Ringkasan assessment"
    description="Selamat datang kembali. Mari siapkan pembelajaran yang bermakna."
    ><button class="btn primary" @click="create">
      <Icon name="plus" />Buat assessment
    </button></PageTitle
  >
  <section class="panel overview-panel">
    <div class="panel-header">
      <h2>Overview</h2>
      <span class="section-caption">{{ date(now.toISOString()) }}</span>
    </div>
    <div class="overview-grid">
      <div class="metric">
        <span class="metric-icon"><Icon name="briefcase" /></span
        ><span class="metric-top">Assessment aktif</span>
        <div class="metric-value-row">
          <span class="metric-value">{{
            String(active).padStart(2, "0")
          }}</span>
        </div>
        <div class="metric-foot">
          <span class="soft-tag">Siap dikerjakan</span
          ><RouterLink to="/assessments/Aktif">Lihat assessment →</RouterLink>
        </div>
      </div>
      <div class="metric">
        <span class="metric-icon"><Icon name="edit" /></span
        ><span class="metric-top">Perlu dinilai</span>
        <div class="metric-value-row">
          <span class="metric-value">{{
            String(pending).padStart(2, "0")
          }}</span>
        </div>
        <div class="metric-foot">
          Pengumpulan tugas ·
          <RouterLink to="/results">Tinjau sekarang</RouterLink>
        </div>
      </div>
      <div class="metric">
        <span class="metric-icon"><Icon name="chart" /></span
        ><span class="metric-top">Rata-rata nilai</span>
        <div class="metric-value-row">
          <span class="metric-value">{{ avg }}<em>/100</em></span
          ><svg
            v-if="graded.length > 1"
            class="sparkline"
            viewBox="0 0 96 56"
            role="img"
            aria-label="Tren nilai peserta terakhir"
          >
            <polyline
              :points="
                graded
                  .slice(-6)
                  .map(
                    (a, i, arr) =>
                      `${4 + (i * 88) / (arr.length - 1)},${48 - a.score * 0.39}`,
                  )
                  .join(' ')
              "
              fill="none"
              stroke="#83b69a"
              stroke-width="2.4"
            />
          </svg>
        </div>
        <div class="metric-foot">
          Dari {{ graded.length }} hasil yang sudah dinilai
        </div>
      </div>
    </div>
  </section>
  <div class="dashboard-grid">
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Aktivitas assessment</h2>
          <p>Semua yang sedang Anda siapkan.</p>
        </div>
        <RouterLink to="/assessments/all" class="btn ghost small"
          >Lihat semua →</RouterLink
        >
      </div>
      <AssessmentTable
        :items="
          store.db.assessments.filter((a) => a.state !== 'archived').slice(0, 4)
        "
        compact
      />
    </section>
    <aside class="dashboard-aside">
      <section class="panel">
        <div class="panel-header">
          <h2>Agenda terdekat</h2>
          <Icon name="calendar" />
        </div>
        <div class="week-strip">
          <div
            v-for="(d, i) in week"
            :key="i"
            class="week-day"
            :class="{ selected: i === weekday }"
            :aria-current="i === weekday ? 'date' : undefined"
          >
            <span>{{
              ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"][i]
            }}</span
            ><strong>{{ d }}</strong>
          </div>
        </div>
        <RouterLink
          v-for="a in upcoming"
          :key="a.id"
          :to="'/results/' + a.id"
          class="agenda-entry"
          ><span class="agenda-line"></span>
          <div>
            <div class="agenda-date">
              {{ date(a.closeAt) }} · {{ time(a.closeAt) }} WIB
            </div>
            <h3>{{ a.title }}</h3>
            <p>{{ a.type }} · {{ a.className }}</p>
          </div></RouterLink
        >
        <p v-if="!upcoming.length" class="muted">Belum ada agenda mendatang.</p>
      </section>
      <section class="help-card">
        <h3>Soal yang baik dimulai dari ide sederhana.</h3>
        <p>Gunakan kembali soal Anda dan susun assessment lebih cepat.</p>
        <RouterLink to="/bank" class="btn small"
          >Jelajahi bank soal →</RouterLink
        >
      </section>
    </aside>
  </div>
</template>
