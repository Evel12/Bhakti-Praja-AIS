<script setup>
import { computed } from "vue";
import StatusBadge from "../ui/StatusBadge.vue";
import Icon from "../ui/Icon.vue";
import { date, time } from "../../utils/format.js";

const props = defineProps({ entry: { type: Object, required: true } });
const action = computed(() => {
  const { assessment, attempt, permission, status } = props.entry;
  if (attempt?.status === "submitted")
    return { label: "Lihat pengumpulan", to: "/review/" + attempt.id };
  if (attempt?.status === "in_progress")
    return { label: permission.allowed ? "Lanjutkan sesi" : "Lihat sesi tersimpan", to: "/instructions/" + assessment.id };
  return { label: status === "Terjadwal" ? "Lihat jadwal" : status === "Ditutup" ? "Lihat rincian" : "Lihat petunjuk", to: "/instructions/" + assessment.id };
});
</script>

<template>
  <section class="panel student-card" :aria-labelledby="'assessment-title-' + entry.assessment.id">
    <header class="student-card-header">
      <span class="student-card-class">{{ entry.assessment.className }}</span>
      <span class="student-card-course">{{ entry.assessment.course }}</span>
    </header>
    <div class="student-card-body">
      <div class="student-card-status">
        <span class="student-card-type">{{ entry.assessment.type }}</span>
        <StatusBadge :status="entry.attempt?.status === 'submitted' ? 'Terkirim' : entry.expired ? 'Waktu habis' : entry.status" />
      </div>
      <h3 :id="'assessment-title-' + entry.assessment.id" class="student-card-title">{{ entry.assessment.title }}</h3>
      <p v-if="entry.assessment.description" class="student-card-description">{{ entry.assessment.description }}</p>
      <ul class="student-card-meta" aria-label="Informasi assessment">
        <li><Icon name="calendar" class="sm" /><span><span class="sr-only">Tenggat: </span><time :datetime="entry.assessment.closeAt">{{ date(entry.assessment.closeAt) }}, {{ time(entry.assessment.closeAt) }} WIB</time></span></li>
        <template v-if="entry.assessment.type === 'Tugas'">
          <li><Icon name="upload" class="sm" /><span>Upload file</span></li>
          <li><Icon name="file" class="sm" /><span>Maks. 2 MB</span></li>
        </template>
        <template v-else>
          <li><Icon name="help" class="sm" /><span>{{ entry.assessment.questions.length }} soal</span></li>
          <li><Icon name="clock" class="sm" /><span>{{ entry.assessment.duration }} menit</span></li>
        </template>
      </ul>
      <RouterLink class="btn student-card-action" :class="{ primary: entry.permission.allowed }" :to="action.to">{{ action.label }}<Icon v-if="entry.attempt?.status !== 'submitted'" name="arrow" class="sm" /></RouterLink>
    </div>
  </section>
</template>

<style scoped>
.student-card-title {
  font-size: 18px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
</style>
