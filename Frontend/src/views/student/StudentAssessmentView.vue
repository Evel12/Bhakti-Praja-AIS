<script setup>
import { computed } from "vue";
import MotionList from "../../components/motion/MotionList.vue";
import StudentAssessmentCard from "../../components/assessment/StudentAssessmentCard.vue";
import PageTitle from "../../components/ui/PageTitle.vue";
import { useAssessmentStore } from "../../stores/assessmentStore.js";
import { useAssessmentClock } from "../../composables/useAssessmentClock.js";
import { canStart, STUDENT_ID, statusOf } from "../../domain/assessment.js";

const store = useAssessmentStore();
// Include attempt deadlines so a resumable session moves to history when its time ends.
const now = useAssessmentClock(() => [
  ...store.db.assessments,
  ...store.db.attempts.filter((attempt) => attempt.studentId === STUDENT_ID && attempt.status === "in_progress")
    .map((attempt) => ({ state: "published", closeAt: attempt.expiresAt })),
]);
const entries = computed(() => store.db.assessments
  .filter((assessment) => !["draft", "archived"].includes(assessment.state) && assessment.className === "Kelas A")
  .map((assessment) => {
    const attempt = store.db.attempts.find((item) => item.assessmentId === assessment.id && item.studentId === STUDENT_ID);
    return {
      assessment,
      attempt,
      status: statusOf(assessment, now.value),
      permission: canStart(assessment, store.db.attempts, now.value),
      expired: attempt?.status === "in_progress" && Date.parse(attempt.expiresAt) <= now.value,
    };
  }));
const history = computed(() => entries.value
  .filter((entry) => entry.attempt?.status === "submitted" || entry.status === "Ditutup" || entry.expired)
  .sort((a, b) => Date.parse(b.assessment.closeAt) - Date.parse(a.assessment.closeAt)));
const upcoming = computed(() => entries.value
  .filter((entry) => entry.status === "Terjadwal" && entry.attempt?.status !== "submitted" && !entry.expired)
  .sort((a, b) => Date.parse(a.assessment.openAt) - Date.parse(b.assessment.openAt)));
const current = computed(() => entries.value
  .filter((entry) => entry.permission.allowed)
  .sort((a, b) => Number(b.attempt?.status === "in_progress") - Number(a.attempt?.status === "in_progress")
    || Date.parse(a.assessment.closeAt) - Date.parse(b.assessment.closeAt)));
</script>

<template>
  <PageTitle title="Assessment saya" description="Yuk, lanjut belajar. Pilih assessment yang mau dikerjakan." />
  <div v-if="!entries.length" class="panel empty">Belum ada assessment untuk kelas kamu.</div>
  <template v-else>
    <section class="student-section" aria-labelledby="student-current-title" data-assessment-group="current">
      <div class="student-section-heading">
        <h2 id="student-current-title">Perlu dikerjakan</h2>
        <p>{{ current.length ? 'Lanjutkan sesi kamu atau mulai dari tenggat terdekat.' : 'Tidak ada tugas aktif saat ini.' }}</p>
      </div>
      <MotionList v-if="current.length" class="student-grid" :item-keys="current.map((entry) => entry.assessment.id)">
        <StudentAssessmentCard v-for="entry in current" :key="entry.assessment.id" :data-motion-key="entry.assessment.id" :entry="entry" />
      </MotionList>
      <p v-else class="notice">{{ upcoming.length ? 'Assessment berikutnya akan tersedia sesuai jadwal di bawah.' : 'Pengumpulan dan sesi sebelumnya tetap tersedia di riwayat.' }}</p>
    </section>
    <section v-if="upcoming.length" class="student-section" aria-labelledby="student-upcoming-title" data-assessment-group="upcoming">
      <div class="student-section-heading"><h2 id="student-upcoming-title">Terjadwal</h2><p>Cek petunjuk dan waktu buka sebelum mulai.</p></div>
      <MotionList class="student-grid" :item-keys="upcoming.map((entry) => entry.assessment.id)">
        <StudentAssessmentCard v-for="entry in upcoming" :key="entry.assessment.id" :data-motion-key="entry.assessment.id" :entry="entry" />
      </MotionList>
    </section>
    <details v-if="history.length" class="student-history student-section" data-assessment-group="history">
      <summary><span>Selesai & ditutup</span><span class="history-count">{{ history.length }} assessment</span></summary>
      <p class="student-history-description">Lihat pengumpulan, hasil yang sudah dirilis, atau sesi yang waktunya berakhir.</p>
      <MotionList class="student-grid" :item-keys="history.map((entry) => entry.assessment.id)">
        <StudentAssessmentCard v-for="entry in history" :key="entry.assessment.id" :data-motion-key="entry.assessment.id" :entry="entry" />
      </MotionList>
    </details>
  </template>
</template>

<style scoped>
.student-section + .student-section {
  margin-top: 30px;
}
.student-section-heading {
  margin-bottom: 16px;
}
.student-section-heading p,
.student-history-description {
  margin-top: 6px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.65;
}
.student-history {
  border-top: 1px solid var(--line);
  padding-top: 14px;
}
.student-history summary {
  min-height: 44px;
  padding: 10px 0;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
}
.history-count {
  margin-left: 12px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 400;
  white-space: nowrap;
}
.student-history-description {
  margin-bottom: 16px;
}
</style>
