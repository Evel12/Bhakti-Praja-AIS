<script setup>
import MotionList from "../../components/motion/MotionList.vue";
import { computed } from "vue";
import { useAssessmentStore } from "../../stores/assessmentStore.js";
import { STUDENT_ID, statusOf } from "../../domain/assessment.js";
import { date, time } from "../../utils/format.js";
import PageTitle from "../../components/ui/PageTitle.vue";
import StatusBadge from "../../components/ui/StatusBadge.vue";
const store = useAssessmentStore();
const items = computed(() =>
  store.db.assessments.filter(
    (a) =>
      !["draft", "archived"].includes(a.state) && a.className === "Kelas A",
  ),
);
const attempt = (a) =>
  store.db.attempts.find(
    (x) => x.assessmentId === a.id && x.studentId === STUDENT_ID,
  );
</script>
<template>
  <PageTitle
    title="Assessment saya"
    description="Satu langkah lebih dekat untuk memahami apa yang Anda pelajari."
  />
  <MotionList class="student-grid" :item-keys="items.map((a) => a.id)">
    <section
      v-for="a in items"
      :key="a.id"
      :data-motion-key="a.id"
      class="panel student-card"
    >
      <div class="card-top">
        <span class="course">{{ a.course }} · {{ a.type }}</span
        ><StatusBadge
          :status="
            attempt(a)?.status === 'submitted' ? 'Terkirim' : statusOf(a)
          "
        />
      </div>
      <h2>{{ a.title }}</h2>
      <p>{{ a.description }}</p>
      <div class="section-caption">
        Tenggat {{ date(a.closeAt) }} · {{ time(a.closeAt) }} WIB<br />{{
          a.type === "Tugas"
            ? "Unggah berkas · Maks. 2 MB"
            : a.questions.length + " soal · " + a.duration + " menit"
        }}
      </div>
      <div class="card-bottom">
        <span class="section-caption">{{ a.className }}</span
        ><RouterLink
          v-if="attempt(a)?.status === 'submitted'"
          class="btn"
          :to="'/review/' + attempt(a).id"
          >Lihat pengumpulan</RouterLink
        ><RouterLink
          v-else
          class="btn"
          :class="{ primary: statusOf(a) === 'Aktif' }"
          :to="'/instructions/' + a.id"
          >{{
            attempt(a)?.status === "in_progress"
              ? "Lanjutkan sesi"
              : "Lihat petunjuk"
          }}
          →</RouterLink
        >
      </div>
    </section>
    <div v-if="!items.length" class="panel empty">
      Belum ada assessment untuk kelas Anda.
    </div>
  </MotionList>
</template>
