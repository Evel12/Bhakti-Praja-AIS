<script setup>
import MotionField from "../../components/motion/MotionField.vue";
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAssessmentStore } from "../../stores/assessmentStore.js";
import PageTitle from "../../components/ui/PageTitle.vue";
import { date } from "../../utils/format.js";
const store = useAssessmentStore(),
  route = useRoute(),
  router = useRouter();
const at = computed(() =>
    store.db.attempts.find((x) => x.id === route.params.id),
  ),
  a = computed(() =>
    store.db.assessments.find((x) => x.id === at.value?.assessmentId),
  );
const score = ref(at.value?.score ?? ""),
  feedback = ref(at.value?.feedback || "");
function save() {
  if (
    score.value === "" ||
    !Number.isFinite(Number(score.value)) ||
    score.value < 0 ||
    score.value > 100
  )
    return;
  const ok = store.run(
    () =>
      store.transaction((db) => {
        const item = db.attempts.find((x) => x.id === at.value.id);
        item.score = Number(score.value);
        item.feedback = feedback.value.trim();
        item.graded = true;
        return true;
      }),
    "Penilaian tersimpan.",
  );
  if (ok) router.push("/results/" + a.value.id);
}
</script>
<template>
  <template v-if="at && a && at.status === 'submitted' && a.type === 'Tugas'"
    ><PageTitle
      :title="'Penilaian · ' + at.studentName"
      :description="a.title + ' · ' + at.className"
    />
    <div class="grading-layout">
      <section class="panel">
        <h2>Berkas pengumpulan</h2>
        <div class="file-card">
          <div>
            <strong>{{ at.attachment?.name }}</strong
            ><small>Dikirim {{ date(at.submittedAt) }}</small>
          </div>
        </div>
        <a
          v-if="at.attachment?.dataURL"
          class="btn"
          :href="at.attachment.dataURL"
          :download="at.attachment.name"
          >Unduh berkas</a
        >
        <p v-else class="notice">
          Berkas contoh tidak memiliki lampiran untuk diunduh.
        </p>
        <h3 class="mt">Instruksi tugas</h3>
        <p class="body-copy mt">{{ a.instructions }}</p>
      </section>
      <form class="panel" @submit.prevent="save">
        <h2>Nilai & umpan balik</h2>
        <label class="field mt"
          ><span class="field-label">Nilai (0–100)</span
          ><MotionField
            ><input
              v-model="score"
              type="number"
              min="0"
              max="100"
              step="1"
              required
              class="input grade-score" /></MotionField></label
        ><label class="field mt"
          ><span class="field-label">Umpan balik</span
          ><MotionField>
            <textarea
              v-model="feedback"
              class="input"
              maxlength="4000"
              placeholder="Berikan arahan untuk pengembangan berikutnya."
            />
          </MotionField>
        </label>
        <p class="notice">
          {{
            a.released
              ? "Perubahan nilai akan terlihat oleh peserta."
              : "Nilai terlihat setelah hasil dirilis."
          }}
        </p>
        <button class="btn primary block">Simpan penilaian</button
        ><RouterLink :to="'/results/' + a.id" class="btn block mt"
          >Kembali</RouterLink
        >
      </form>
    </div></template
  >
  <div v-else class="empty">Pengumpulan tugas tidak ditemukan.</div>
</template>
