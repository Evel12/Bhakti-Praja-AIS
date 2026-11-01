<script setup>
import MotionField from "../../components/motion/MotionField.vue";
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAssessmentStore } from "../../stores/assessmentStore.js";
import { statusOf } from "../../domain/assessment.js";
import PageTitle from "../../components/ui/PageTitle.vue";
import AssessmentTable from "../../components/assessment/AssessmentTable.vue";
import Icon from "../../components/ui/Icon.vue";
import { assessmentFilters } from "../../utils/assessmentNavigation.js";
import { motionEngine } from "../../motion/engine.js";
import { safeTokens, observeMotionPolicy } from "../../motion/policy.js";
const store = useAssessmentStore(),
  route = useRoute(),
  router = useRouter(),
  search = ref("");
const filter = computed(() => route.params.status || "all");
const results = ref();
let fade, stopPolicy;
function stopFade() {
  fade?.cancel();
  if (results.value) motionEngine.reset(results.value);
}
onMounted(() => {
  stopPolicy = observeMotionPolicy(results.value, stopFade);
});
onBeforeUnmount(() => {
  stopPolicy?.();
  stopFade();
});
watch(filter, () => {
  stopFade();
  const tokens = safeTokens(results.value);
  if (!tokens || tokens.mode === "off" || document.hidden) return;
  // Fade the updated results only; keep the panel, filters and page stationary.
  fade = motionEngine.animate(results.value, { opacity: 1 }, {
    from: { opacity: 0 },
    preset: "gentle",
    tokens,
  });
}, { flush: "post" });
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
    description="Semua kuis, tugas, dan ujian kamu ada di sini."
    ><button class="btn primary" @click="create">
      <Icon name="plus" />Buat assessment
    </button></PageTitle
  >
  <section class="panel">
    <div class="filters">
      <div class="tabs" aria-label="Filter status">
        <RouterLink
          v-for="s in assessmentFilters"
          :key="s"
          :to="'/assessments/' + s"
          class="tab"
          :class="{ active: filter === s }"
          :aria-current="filter === s ? 'page' : undefined"
          >{{ s === "all" ? "Semua" : s }}</RouterLink
        >
      </div>
      <label class="search"
        ><Icon name="search" /><MotionField
          ><input
            v-model="search"
            class="input"
            placeholder="Cari assessment..."
            aria-label="Cari assessment" /></MotionField
      ></label>
    </div>
    <div
      ref="results"
      class="assessment-results"
      @focusin="stopFade"
      @pointerdown="stopFade"
    >
      <AssessmentTable :items="items" :motion="false" />
    </div>
  </section>
</template>
