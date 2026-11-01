<script setup>
import MotionList from "../motion/MotionList.vue";
import { useRouter } from "vue-router";
import { useAssessmentStore } from "../../stores/assessmentStore.js";
import { statusOf } from "../../domain/assessment.js";
import { date, time } from "../../utils/format.js";
import StatusBadge from "../ui/StatusBadge.vue";
import Icon from "../ui/Icon.vue";
defineProps({
  items: Array,
  compact: Boolean,
  motion: { type: Boolean, default: true },
});
const store = useAssessmentStore(),
  router = useRouter();
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
          <th>Assessment</th>
          <th>Status</th>
          <th>Tenggat</th>
          <th v-if="!compact">Terkirim</th>
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
          <td data-label="Status"><StatusBadge :status="statusOf(a)" /></td>
          <td data-label="Tenggat">
            <span>{{ date(a.closeAt) }}</span>
            <div class="table-secondary">{{ time(a.closeAt) }} WIB</div>
          </td>
          <td v-if="!compact" data-label="Terkirim">
            {{
              store.db.attempts.filter(
                (x) => x.assessmentId === a.id && x.status === "submitted",
              ).length
            }}
            peserta
          </td>
          <td>
            <div class="action-row">
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
