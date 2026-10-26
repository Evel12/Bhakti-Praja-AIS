<script setup>
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
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
const route = useRoute(),
  store = useAssessmentStore(),
  dialog = ref(""),
  detail = ref(null);
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
  average = computed(() =>
    graded.value.length
      ? Math.round(
          graded.value.reduce((n, x) => n + x.score, 0) / graded.value.length,
        )
      : "—",
  );
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
    "Hasil telah dirilis.",
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
      description="Tinjau pengumpulan, beri umpan balik, dan rilis hasil."
    />
    <div class="student-grid">
      <section
        v-for="item in store.db.assessments.filter((x) => x.state !== 'draft')"
        :key="item.id"
        class="panel student-card"
      >
        <div class="card-top">
          <span class="course">{{ item.course }} · {{ item.className }}</span
          ><StatusBadge :status="statusOf(item)" />
        </div>
        <h2>{{ item.title }}</h2>
        <p>
          {{
            store.db.attempts.filter(
              (x) => x.assessmentId === item.id && x.status === "submitted",
            ).length
          }}
          pengumpulan ·
          {{
            store.db.attempts.filter(
              (x) =>
                x.assessmentId === item.id &&
                x.status === "submitted" &&
                !x.graded,
            ).length
          }}
          perlu dinilai
        </p>
        <div class="card-bottom">
          <span class="section-caption">{{
            item.released
              ? "Hasil dirilis"
              : "Rilis " +
                (item.releaseMode === "manual" ? "manual" : "langsung")
          }}</span
          ><RouterLink class="btn" :to="'/results/' + item.id"
            >Tinjau hasil →</RouterLink
          >
        </div>
      </section>
    </div></template
  ><template v-else-if="a"
    ><PageTitle :title="a.title" :description="a.course + ' · ' + a.className"
      ><button
        class="btn"
        @click="
          download(exportResults(a, store.db.attempts), 'hasil-assessment.csv')
        "
      >
        Unduh CSV</button
      ><button
        class="btn primary"
        :disabled="
          a.released || !submitted.length || submitted.some((x) => !x.graded)
        "
        @click="dialog = 'release'"
      >
        {{ a.released ? "Hasil telah dirilis" : "Rilis hasil" }}
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
        <StatusBadge :status="statusOf(a)" />
      </div>
      <p v-if="submitted.some((x) => !x.graded)" class="notice">
        Nilai semua pengumpulan terlebih dahulu untuk merilis hasil.
      </p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Peserta</th>
              <th>Dikirim</th>
              <th>Status</th>
              <th>Nilai</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="at in attempts" :key="at.id">
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
                  :to="'/grade/' + at.id"
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
          </tbody>
        </table>
        <div v-if="!attempts.length" class="empty">
          Belum ada pengumpulan peserta.
        </div>
      </div>
      <div class="builder-footer">
        <RouterLink to="/results" class="btn">← Semua hasil</RouterLink
        ><button
          v-if="['Aktif', 'Terjadwal'].includes(statusOf(a))"
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
          : 'Review jawaban peserta'
    "
    @close="dialog = ''"
    ><p v-if="dialog === 'release'" class="dialog-copy">
      Peserta akan dapat melihat nilai dan pembahasan.
    </p>
    <p v-if="dialog === 'close'" class="dialog-copy">
      Peserta tidak dapat memulai lagi. Sesi kuis yang berjalan akan dikirim
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
