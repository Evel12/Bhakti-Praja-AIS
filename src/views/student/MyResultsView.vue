<script setup>
import MotionList from "../../components/motion/MotionList.vue";
import { computed } from "vue";
import { useAssessmentStore } from "../../stores/assessmentStore.js";
import { STUDENT_ID, visibleScore } from "../../domain/assessment.js";
import { date } from "../../utils/format.js";
import PageTitle from "../../components/ui/PageTitle.vue";
const store = useAssessmentStore();
const rows = computed(() =>
  store.db.attempts
    .filter((x) => x.studentId === STUDENT_ID && x.status === "submitted")
    .map((at) => ({
      at,
      a: store.db.assessments.find((x) => x.id === at.assessmentId),
    }))
    .filter((x) => x.a),
);
</script>
<template>
  <PageTitle
    title="Hasil saya"
    description="Lihat perkembangan Anda dan pelajari umpan balik pengajar."
  />
  <section class="panel">
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Assessment</th>
            <th>Dikirim</th>
            <th>Nilai</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <MotionList as="tbody" :item-keys="rows.map((x) => x.at.id)">
          <tr v-for="{ at, a } in rows" :key="at.id" :data-motion-key="at.id">
            <td>
              <strong>{{ a.title }}</strong>
              <p class="table-secondary">{{ a.course }}</p>
            </td>
            <td>{{ date(at.submittedAt) }}</td>
            <td>
              {{
                visibleScore(a, at) ??
                (at.graded ? "Belum dirilis" : "Menunggu penilaian")
              }}
            </td>
            <td>
              <RouterLink :to="'/review/' + at.id" class="btn small"
                >Lihat hasil</RouterLink
              >
            </td>
          </tr>
        </MotionList>
      </table>
    </div>
    <div v-if="!rows.length" class="empty">
      <h3>Belum ada hasil</h3>
      <p>Hasil pengumpulan Anda akan tampil di sini.</p>
      <RouterLink to="/student" class="btn">Lihat assessment</RouterLink>
    </div>
  </section>
</template>
