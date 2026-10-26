<script setup>
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAssessmentStore } from "../../stores/assessmentStore.js";
import { statusOf } from "../../domain/assessment.js";
import PageTitle from "../../components/ui/PageTitle.vue";
import AssessmentTable from "../../components/assessment/AssessmentTable.vue";
import Icon from "../../components/ui/Icon.vue";
const store = useAssessmentStore(),
  route = useRoute(),
  router = useRouter(),
  search = ref("");
const filter = computed(() => route.params.status || "all");
const items = computed(() =>
  store.db.assessments.filter(
    (a) =>
      a.state !== "archived" &&
      (filter.value === "all" || statusOf(a) === filter.value) &&
      `${a.title} ${a.course} ${a.className}`
        .toLowerCase()
        .includes(search.value.toLowerCase()),
  ),
);
function create() {
  const id = store.run(() => store.create());
  if (id) router.push("/builder/" + id);
}
</script>
<template>
  <PageTitle
    title="Assessment"
    description="Kelola kuis, tugas, dan ujian Anda dengan lebih teratur."
    ><button class="btn primary" @click="create">
      <Icon name="plus" />Buat assessment
    </button></PageTitle
  >
  <section class="panel">
    <div class="filters">
      <div class="tabs" aria-label="Filter status">
        <RouterLink
          v-for="s in ['all', 'Aktif', 'Draft', 'Terjadwal', 'Ditutup']"
          :key="s"
          :to="'/assessments/' + s"
          class="tab"
          :class="{ active: filter === s }"
          >{{ s === "all" ? "Semua" : s }}</RouterLink
        >
      </div>
      <label class="search"
        ><Icon name="search" /><input
          v-model="search"
          class="input"
          placeholder="Cari assessment..."
          aria-label="Cari assessment"
      /></label>
    </div>
    <AssessmentTable :items="items" />
  </section>
</template>
