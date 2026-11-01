<script setup>
import MotionList from "../../components/motion/MotionList.vue";
import { computed } from "vue";
import { useAssessmentStore } from "../../stores/assessmentStore.js";
import { STUDENT_ID, statusOf } from "../../domain/assessment.js";
import { date, time } from "../../utils/format.js";
import PageTitle from "../../components/ui/PageTitle.vue";
import StatusBadge from "../../components/ui/StatusBadge.vue";
import Icon from "../../components/ui/Icon.vue";
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
      :aria-labelledby="'assessment-title-' + a.id"
    >
      <header class="student-card-header">
        <span class="student-card-class">{{ a.className }}</span>
        <span class="student-card-course">{{ a.course }}</span>
      </header>
      <div class="student-card-body">
        <div class="student-card-status">
          <span class="student-card-type">{{ a.type }}</span>
          <StatusBadge
            :status="
              attempt(a)?.status === 'submitted' ? 'Terkirim' : statusOf(a)
            "
          />
        </div>
        <h2 :id="'assessment-title-' + a.id">{{ a.title }}</h2>
        <p v-if="a.description" class="student-card-description">
          {{ a.description }}
        </p>
        <ul class="student-card-meta" aria-label="Informasi assessment">
          <li>
            <Icon name="calendar" class="sm" />
            <span>
              <span class="sr-only">Tenggat: </span>
              <time :datetime="a.closeAt"
                >{{ date(a.closeAt) }}, {{ time(a.closeAt) }} WIB</time
              >
            </span>
          </li>
          <template v-if="a.type === 'Tugas'">
            <li>
              <Icon name="upload" class="sm" /><span>Unggah berkas</span>
            </li>
            <li>
              <Icon name="file" class="sm" /><span>Maks. 2 MB</span>
            </li>
          </template>
          <template v-else>
            <li>
              <Icon name="help" class="sm" /><span>{{ a.questions.length }} soal</span>
            </li>
            <li>
              <Icon name="clock" class="sm" /><span>{{ a.duration }} menit</span>
            </li>
          </template>
        </ul>
        <RouterLink
          v-if="attempt(a)?.status === 'submitted'"
          class="btn student-card-action"
          :to="'/review/' + attempt(a).id"
          >Lihat pengumpulan</RouterLink
        >
        <RouterLink
          v-else
          class="btn student-card-action"
          :class="{ primary: statusOf(a) === 'Aktif' }"
          :to="'/instructions/' + a.id"
          >{{
            attempt(a)?.status === "in_progress"
              ? "Lanjutkan sesi"
              : "Lihat petunjuk"
          }}
          <Icon name="arrow" class="sm" />
        </RouterLink>
      </div>
    </section>
    <div v-if="!items.length" class="panel empty">
      Belum ada assessment untuk kelas Anda.
    </div>
  </MotionList>
</template>
