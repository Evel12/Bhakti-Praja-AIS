<script setup>
import { computed } from "vue";
import MotionList from "../motion/MotionList.vue";
import { useRouter } from "vue-router";
import { useAssessmentStore } from "../../stores/assessmentStore.js";
import { statusOf } from "../../domain/assessment.js";
import { submittedCountsByAssessment } from "../../domain/assessmentSort.js";
import { date, time } from "../../utils/format.js";
import StatusBadge from "../ui/StatusBadge.vue";
import Icon from "../ui/Icon.vue";

const props = defineProps({
  items: Array,
  compact: Boolean,
  showStatus: { type: Boolean, default: true },
  motion: { type: Boolean, default: true },
  sortable: { type: Boolean, default: false },
  sortKey: { type: String, default: "default" },
  sortDir: { type: String, default: "asc" },
});
const emit = defineEmits(["sort"]);

const store = useAssessmentStore(),
  router = useRouter();

const submittedCounts = computed(() =>
  submittedCountsByAssessment(store.db.attempts),
);

function ariaSortFor(key) {
  if (!props.sortable) return undefined;
  if (props.sortKey !== key) return "none";
  return props.sortDir === "desc" ? "descending" : "ascending";
}

function sortIconFor(key) {
  if (props.sortKey !== key) return "down";
  return props.sortDir === "desc" ? "down" : "up";
}

function requestSort(key) {
  if (props.sortable) emit("sort", key);
}

function duplicate(a) {
  const id = store.run(() => store.duplicate(a), "Salinan draft dibuat.");
  if (id) router.push("/builder/" + id);
}
</script>
<template>
  <div class="table-wrap">
    <table class="mobile-cards">
      <thead>
        <tr>
          <th :aria-sort="ariaSortFor('title')">
            <button
              v-if="sortable"
              type="button"
              class="table-sort-btn"
              :class="{ active: sortKey === 'title' }"
              @click="requestSort('title')"
            >
              <span>Assessment</span>
              <Icon
                :name="sortIconFor('title')"
                class="sort-icon"
                :class="{ 'is-idle': sortKey !== 'title' }"
              />
            </button>
            <template v-else>Assessment</template>
          </th>
          <th v-if="showStatus" :aria-sort="ariaSortFor('status')">
            <button
              v-if="sortable"
              type="button"
              class="table-sort-btn"
              :class="{ active: sortKey === 'status' }"
              @click="requestSort('status')"
            >
              <span>Status</span>
              <Icon
                :name="sortIconFor('status')"
                class="sort-icon"
                :class="{ 'is-idle': sortKey !== 'status' }"
              />
            </button>
            <template v-else>Status</template>
          </th>
          <th :aria-sort="ariaSortFor('closeAt')">
            <button
              v-if="sortable"
              type="button"
              class="table-sort-btn"
              :class="{ active: sortKey === 'closeAt' }"
              @click="requestSort('closeAt')"
            >
              <span>Deadline</span>
              <Icon
                :name="sortIconFor('closeAt')"
                class="sort-icon"
                :class="{ 'is-idle': sortKey !== 'closeAt' }"
              />
            </button>
            <template v-else>Deadline</template>
          </th>
          <th v-if="!compact" :aria-sort="ariaSortFor('submitted')">
            <button
              v-if="sortable"
              type="button"
              class="table-sort-btn"
              :class="{ active: sortKey === 'submitted' }"
              @click="requestSort('submitted')"
            >
              <span>Terkirim</span>
              <Icon
                :name="sortIconFor('submitted')"
                class="sort-icon"
                :class="{ 'is-idle': sortKey !== 'submitted' }"
              />
            </button>
            <template v-else>Terkirim</template>
          </th>
          <th scope="col"><span class="sr-only">Tindakan</span></th>
        </tr>
      </thead>
      <MotionList as="tbody" :item-keys="items.map((a) => a.id)" :enabled="motion">
        <tr v-for="a in items" :key="a.id" :data-motion-key="a.id">
          <td class="title-cell">
            <div class="title-with-icon">
              <span class="type-icon"
                ><Icon :name="a.type === 'Tugas' ? 'file' : 'briefcase'"
              /></span>
              <div>
                <RouterLink
                  :to="(a.state === 'draft' ? '/builder/' : '/results/') + a.id"
                  class="assessment-title"
                  >{{ a.title || "Draft tanpa judul" }}</RouterLink
                >
                <div class="table-secondary">
                  {{ a.course }} · {{ a.className }}
                </div>
              </div>
            </div>
          </td>
          <td v-if="showStatus" data-label="Status"><StatusBadge :status="statusOf(a)" /></td>
          <td data-label="Deadline">
            <span>{{ date(a.closeAt) }}</span>
            <div class="table-secondary">{{ time(a.closeAt) }} WIB</div>
          </td>
          <td v-if="!compact" data-label="Terkirim">
            {{ submittedCounts.get(a.id) ?? 0 }} peserta
          </td>
          <td>
            <div class="action-row table-action-buttons">
              <RouterLink
                class="icon-btn"
                :to="(a.state === 'draft' ? '/builder/' : '/results/') + a.id"
                :aria-label="
                  (a.state === 'draft' ? 'Edit ' : 'Lihat hasil ') + a.title
                "
                ><Icon
                  :name="a.state === 'draft' ? 'edit' : 'eye'" /></RouterLink
              ><button
                v-if="!compact"
                class="icon-btn"
                :aria-label="'Duplikat ' + a.title"
                @click="duplicate(a)"
              >
                <Icon name="copy" />
              </button>
            </div>
          </td>
        </tr>
      </MotionList>
    </table>
    <div v-if="!items.length" class="empty">
      <h3>Belum ada assessment yang sesuai</h3>
      <p>Coba filter lain atau buat assessment baru.</p>
    </div>
  </div>
</template>
