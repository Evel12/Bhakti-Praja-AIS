<script setup>
import MotionField from "../../components/motion/MotionField.vue";
import { ref, computed, watch } from "vue";
import { useRoute, useRouter, onBeforeRouteLeave, onBeforeRouteUpdate } from "vue-router";
import { useAssessmentStore } from "../../stores/assessmentStore.js";
import PageTitle from "../../components/ui/PageTitle.vue";
import { date } from "../../utils/format.js";
import { resultContext } from "../../utils/resultNavigation.js";
import { gradingQueue, gradingDestination } from "../../domain/teacherWork.js";
import { useGradingDraft } from "../../composables/useGradingDraft.js";
const store = useAssessmentStore(),
  route = useRoute(),
  router = useRouter();
const at = computed(() =>
    store.db.attempts.find((x) => x.id === route.params.id),
  ),
  a = computed(() =>
    store.db.assessments.find((x) => x.id === at.value?.assessmentId),
  );
const { score, feedback, dirty, error: draftError, restored, persist, markCommitted } = useGradingDraft(at);
const saveError = ref("");
watch(() => route.params.id, () => { saveError.value = ""; });
const scope = computed(() => resultContext(route.query));
const pending = computed(() => gradingQueue(store.db)
  .filter(({ assessment }) => assessment.type === "Tugas"
    && (!scope.value.class || assessment.className === scope.value.class)
    && (!scope.value.course || assessment.course === scope.value.course))
  .flatMap(({ assessment, attempts }) => attempts.map((attempt) => ({ assessment, attempt }))));
const position = computed(() => pending.value.findIndex(({ attempt }) => attempt.id === at.value?.id));
const nextPending = computed(() => pending.value.find(({ attempt }) => attempt.id !== at.value?.id));
const draftStatus = computed(() => draftError.value ? "Draft belum tersimpan" : restored.value ? "Draft lokal dipulihkan" : dirty.value ? "Draft lokal tersimpan" : at.value?.graded ? "Penilaian tersimpan" : "Belum dinilai");
onBeforeRouteLeave(() => persist());
onBeforeRouteUpdate(() => persist());
const returnTo = computed(() => ({
  path: '/results/' + a.value?.id,
  query: { ...(route.query.queue === 'pending' ? { filter: 'pending' } : {}), ...resultContext(route.query) },
}));
function save(event) {
  saveError.value = "";
  if (
    score.value === "" ||
    !Number.isInteger(Number(score.value)) ||
    score.value < 0 ||
    score.value > 100
  ) { saveError.value = "Isi nilai berupa bilangan bulat 0–100 sebelum menyimpan penilaian."; return; }
  const next = event?.submitter?.value === "next" ? nextPending.value : null;
  const destination = next ? router.resolve(gradingDestination(next.assessment, next.attempt)) : null;
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
  if (ok) {
    markCommitted();
    router.push(destination ? { path: destination.path, query: { ...destination.query, ...scope.value } } : returnTo.value);
  } else saveError.value = "Penilaian belum tersimpan. Nilai dan feedback kamu masih ada di halaman ini. Coba simpan penilaian lagi.";
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
        <h2>File pengumpulan</h2>
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
          >Download file</a
        >
        <p v-else class="notice">
          File contoh tidak memiliki lampiran untuk didownload.
        </p>
        <h3 class="mt">Instruksi tugas</h3>
        <p class="body-copy mt">{{ a.instructions }}</p>
      </section>
      <form class="panel" @submit.prevent="save">
        <h2>Nilai & feedback</h2>
        <p v-if="position >= 0" class="grading-queue">Pengumpulan {{ position + 1 }} dari {{ pending.length }} yang perlu dinilai</p>
        <p class="grading-draft-status" role="status" aria-live="polite" aria-atomic="true">{{ draftStatus }}</p>
        <p class="grading-draft-help">Draft tersimpan di browser ini. Klik Simpan penilaian untuk menerapkan nilai.</p>
        <div v-if="draftError" class="notice warning" role="alert">
          <p>{{ draftError }}</p>
          <button type="button" class="btn mt" @click="persist">Coba simpan draft</button>
        </div>
        <p v-if="saveError" class="notice warning" role="alert">{{ saveError }}</p>
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
          ><span class="field-label">Feedback</span
          ><MotionField>
            <textarea
              v-model="feedback"
              class="input"
              maxlength="4000"
              placeholder="Apa yang sudah bagus dan masih perlu diperbaiki?"
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
        <button v-if="position >= 0 && nextPending" type="submit" name="action" value="next" class="btn primary block grading-save-next">Simpan & nilai berikutnya</button>
        <button type="submit" class="btn block" :class="{ primary: position < 0 || !nextPending, mt: position >= 0 && nextPending }">Simpan penilaian</button
        ><RouterLink :to="returnTo" class="btn block mt"
          >Kembali</RouterLink
        >
      </form>
    </div></template
  >
  <div v-else class="empty">Pengumpulan tugas tidak ditemukan.</div>
</template>
<style scoped>
.grading-queue { margin-top: 8px; color: var(--muted); font-size: 12px; }
.grading-draft-status { margin-top: 16px; font-weight: 600; font-size: 13px; }
.grading-draft-help { margin-top: 4px; color: var(--muted); font-size: 12px; line-height: 1.6; }
</style>
