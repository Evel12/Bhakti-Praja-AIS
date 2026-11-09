<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useAssessmentStore } from "../../stores/assessmentStore.js";
import { visibleScore, STUDENT_ID } from "../../domain/assessment.js";
import { date, time } from "../../utils/format.js";
import QuestionPreview from "../../components/assessment/QuestionPreview.vue";
import Icon from "../../components/ui/Icon.vue";
const route = useRoute(),
  store = useAssessmentStore();
const at = computed(() =>
    store.db.attempts.find(
      (x) => x.id === route.params.id && x.studentId === STUDENT_ID,
    ),
  ),
  a = computed(() =>
    store.db.assessments.find((x) => x.id === at.value?.assessmentId),
  ),
  score = computed(() =>
    a.value && at.value ? visibleScore(a.value, at.value) : null,
  );
</script>
<template>
  <template v-if="at && a && at.status === 'submitted'"
    ><section class="panel receipt">
      <span class="receipt-icon"><Icon name="checkCircle" /></span>
      <h1>Assessment berhasil dikirim</h1>
      <p>
        {{ a.title }}<br />{{ date(at.submittedAt) }} ·
        {{ time(at.submittedAt) }} WIB
      </p>
      <div v-if="score !== null" class="score-large">
        {{ score }}<span>/100</span>
      </div>
      <p v-else class="notice">
        {{
          at.graded
            ? "Nilai akan terlihat setelah dirilis oleh pengajar."
            : "Pengumpulan menunggu penilaian pengajar."
        }}
      </p>
      <p v-if="at.attachment">File: {{ at.attachment.name }}</p>
      <p v-if="score !== null && at.feedback" class="body-copy">
        Feedback: {{ at.feedback }}
      </p>
      <div class="action-row">
        <RouterLink to="/student" class="btn primary"
          >Kembali ke assessment</RouterLink
        ><RouterLink to="/my-results" class="btn">Hasil saya</RouterLink>
      </div>
    </section>
    <section v-if="score !== null && a.type !== 'Tugas'" class="panel">
      <h2 class="mb">Cek jawaban</h2>
      <QuestionPreview
        :questions="a.questions"
        :answers="at.answers"
      /></section
  ></template>
  <div v-else class="empty">
    <h2>Pengumpulan belum tersedia</h2>
    <RouterLink v-if="at" :to="'/attempt/' + at.id" class="btn mt"
      >Lanjutkan sesi</RouterLink
    ><RouterLink v-else to="/student" class="btn mt">Kembali</RouterLink>
  </div>
</template>
