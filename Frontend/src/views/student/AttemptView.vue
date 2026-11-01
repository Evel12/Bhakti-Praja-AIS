<script setup>
import { ref, computed, onMounted, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAssessmentStore } from "../../stores/assessmentStore.js";
import { useAttemptStore } from "../../stores/attemptStore.js";
import { useUiStore } from "../../stores/uiStore.js";
import { STUDENT_ID, statusOf } from "../../domain/assessment.js";
import { useCountdown } from "../../composables/useCountdown.js";
import { date, time } from "../../utils/format.js";
import PageTitle from "../../components/ui/PageTitle.vue";
import AppDialog from "../../components/ui/AppDialog.vue";
import Icon from "../../components/ui/Icon.vue";
import AppLoading from "../../components/ui/AppLoading.vue";
const store = useAssessmentStore(),
  attemptStore = useAttemptStore(),
  ui = useUiStore(),
  route = useRoute(),
  router = useRouter();
const index = ref(0),
  questionTitle = ref(),
  confirm = ref(false),
  uploading = ref(false),
  submissionError = ref(false);
const at = computed(() =>
    store.db.attempts.find(
      (x) => x.id === route.params.id && x.studentId === STUDENT_ID,
    ),
  ),
  a = computed(() =>
    store.db.assessments.find((x) => x.id === at.value?.assessmentId),
  ),
  q = computed(() => a.value?.questions[index.value]);
const expires = computed(() => at.value?.expiresAt || new Date().toISOString());
const { remaining, display } = useCountdown(expires, () => {
  if (at.value?.status === "in_progress" && a.value?.type !== "Tugas")
    submit(true);
});
const locked = computed(
  () =>
    remaining.value <= 0 ||
    at.value?.status !== "in_progress" ||
    statusOf(a.value || {}) === "Ditutup",
);
const answeredCount = computed(() => a.value?.questions.filter((question) => at.value?.answers[question.id] !== undefined).length ?? 0);
const unansweredCount = computed(() => (a.value?.questions.length ?? 0) - answeredCount.value);
const flaggedCount = computed(() => a.value?.questions.filter((question) => at.value?.flags.includes(question.id)).length ?? 0);
const timeWarning = computed(() => remaining.value > 0 && remaining.value <= 60000
  ? "Sisa waktu kurang dari satu menit. Cek jawaban sebelum waktu habis."
  : remaining.value > 0 && remaining.value <= 300000
    ? "Sisa waktu lima menit atau kurang. Jawaban akan dikirim saat waktu habis."
    : "");
async function goToQuestion(position) {
  index.value = position;
  confirm.value = false;
  await nextTick();
  questionTitle.value?.focus({ preventScroll: true });
  questionTitle.value?.scrollIntoView?.({ block: "start" });
}
onMounted(() => {
  if (at.value?.status === "submitted")
    router.replace("/review/" + at.value.id);
  else if (a.value?.state === "closed" && a.value.type !== "Tugas")
    submit(true);
});
function answer(value) {
  if (locked.value) return;
  store.run(() => attemptStore.answer(at.value.id, q.value.id, value));
}
function submit(automatic = false) {
  if (!at.value) return;
  const id = store.run(
    () => store.submit(at.value.id),
    automatic
      ? "Waktu habis. Jawaban tersimpan sudah dikirim."
      : "Assessment berhasil dikirim.",
  );
  if (id) {
    confirm.value = false;
    submissionError.value = false;
    router.replace("/review/" + id);
  } else submissionError.value = true;
}
async function upload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (
    !/\.(pdf|docx|jpe?g|png)$/i.test(file.name) ||
    file.size > 2 * 1024 * 1024
  ) {
    ui.toast("Gunakan PDF, DOCX, JPG, atau PNG maksimal 2 MB.", true);
    e.target.value = "";
    return;
  }
  uploading.value = true;
  try {
    const dataURL = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    store.run(
      () =>
        store.changeAttempt(at.value.id, (item) => {
          item.attachment = {
            name: file.name,
            size: file.size,
            type: file.type,
            dataURL,
          };
        }),
      "File tersimpan. Klik Kirim tugas untuk mengumpulkan.",
    );
  } catch {
    ui.toast("File tidak bisa dibaca.", true);
  } finally {
    uploading.value = false;
    e.target.value = "";
  }
}
</script>
<template>
  <template v-if="at && a"
    ><PageTitle
      :title="a.title"
      :description="a.course + ' · ' + a.className"
    />
    <div v-if="submissionError" class="error-box" role="alert">
      Pengiriman belum tersimpan. Jawaban kamu tetap tersedia.<button
        class="btn danger"
        @click="submit()"
      >
        Coba kirim lagi
      </button>
    </div>
    <p v-if="store.storageError" class="notice warning" role="alert">
      Perubahan terakhir gagal disimpan. Cek penyimpanan browser sebelum
      melanjutkan.
    </p>
    <template v-if="a.type === 'Tugas'"
      ><section class="panel">
        <h2>Pengumpulan tugas</h2>
        <p class="body-copy mt">{{ a.instructions }}</p>
        <p class="notice">
          Tenggat: {{ date(at.expiresAt) }} · {{ time(at.expiresAt) }} WIB
        </p>
        <p v-if="locked" class="notice warning">
          Pengumpulan tugas sudah ditutup. File tersimpan tetap tersedia.
        </p>
        <label v-else class="upload" :aria-busy="uploading"
          ><Icon name="upload" /><strong>{{
            uploading ? "Menyimpan file..." : "Pilih atau ganti file tugas"
          }}</strong
          ><small>PDF, DOCX, JPG, PNG · maksimal 2 MB</small
          ><input
            type="file"
            accept=".pdf,.docx,.jpg,.jpeg,.png"
            aria-label="File tugas"
            :disabled="uploading"
            @change="upload"
        /></label>
        <AppLoading v-if="uploading" label="Menyimpan file…" />
        <div v-if="at.attachment" class="file-card">
          <Icon name="file" />
          <div>
            <strong>{{ at.attachment.name }}</strong
            ><small
              >{{ Math.ceil(at.attachment.size / 1024) }} KB · Tersimpan</small
            >
          </div>
        </div>
        <button
          class="btn primary mt"
          :disabled="locked || uploading || !at.attachment"
          @click="confirm = true"
        >
          Kirim tugas
        </button>
      </section></template
    >
    <div v-else class="exam-grid">
      <div class="exam-status-bar" role="region" aria-label="Status pengerjaan">
        <div class="exam-progress-copy">
          <span class="question-count"
            >Soal {{ index + 1 }} dari {{ a.questions.length }}</span
          ><span class="save-status" role="status" :class="{ error: store.storageError }">{{
            store.storageError ? "Belum tersimpan" : "Jawaban tersimpan"
          }}</span>
        </div>
        <div class="exam-clock">
          <span class="timer-label">Sisa waktu</span>
          <p class="timer" :class="{ warning: remaining <= 300000 }" aria-label="Sisa waktu pengerjaan">{{ display }}</p>
        </div>
        <p class="sr-only exam-time-warning" role="status" aria-live="polite" aria-atomic="true">{{ timeWarning }}</p>
      </div>
      <section class="panel exam-question-panel">
        <template v-if="q"
          ><h2 ref="questionTitle" class="exam-question" tabindex="-1">{{ q.text }}</h2>
          <fieldset :disabled="locked">
            <legend class="sr-only">Pilih jawaban soal {{ index + 1 }}</legend>
            <label
              v-for="(option, n) in q.options"
              :key="q.id + '-' + n"
              class="answer-option"
              ><input
                :checked="at.answers[q.id] === n"
                type="radio"
                :name="'answer-' + q.id"
                :value="n"
                @change="answer(n)"
              /><span>{{ String.fromCharCode(65 + n) }}.</span
              ><span>{{ option }}</span></label
            >
          </fieldset>
          <div class="exam-bottom">
            <button
              class="btn"
              :disabled="locked"
              :aria-pressed="at.flags.includes(q.id)"
              @click="store.run(() => attemptStore.flag(at.id, q.id))"
            >
              <Icon name="flag" />{{
                at.flags.includes(q.id) ? "Hapus tanda ragu" : "Tandai ragu"
              }}
            </button>
            <div class="action-row">
              <button class="btn" :disabled="index === 0" @click="goToQuestion(index - 1)">
                Sebelumnya</button
              ><button
                class="btn primary"
                :disabled="index === a.questions.length - 1"
                @click="goToQuestion(index + 1)"
              >
                Berikutnya
              </button>
            </div>
          </div></template
        >
      </section>
      <aside class="panel exam-navigation" aria-label="Navigasi soal">
        <h2>Daftar soal</h2>
        <div class="number-grid">
          <button
            v-for="(question, n) in a.questions"
            :key="question.id"
            :class="{
              current: index === n,
              answered: at.answers[question.id] !== undefined,
            }"
            :aria-current="index === n ? 'step' : undefined"
            :aria-label="
              'Soal ' +
              (n + 1) +
              (at.answers[question.id] !== undefined ? ', terjawab' : ', belum dijawab') +
              (at.flags.includes(question.id) ? ', ragu' : '')
            "
            @click="goToQuestion(n)"
          >
            {{ n + 1
            }}<span v-if="at.flags.includes(question.id)" class="flag-dot"
              >●</span
            >
          </button>
        </div>
        <p class="number-legend">
          {{ answeredCount }} /
          {{ a.questions.length }} terjawab<br />Hijau: terjawab · Titik: ragu
        </p>
        <button
          class="btn primary block"
          :disabled="locked"
          @click="confirm = true"
        >
          Cek & kirim
        </button>
      </aside>
    </div>
    <AppDialog
      :open="confirm"
      :title="a.type === 'Tugas' ? 'Kirim tugas?' : 'Cek jawaban kamu'"
      @close="confirm = false"
      ><p class="dialog-copy" v-if="a.type === 'Tugas'">
        {{ at.attachment?.name }} akan dikumpulkan. File tidak bisa diganti
        setelah dikirim.
      </p>
      <template v-else
        ><p class="dialog-copy">
          {{ answeredCount }} dari
          {{ a.questions.length }} soal sudah dijawab. Setelah dikirim, jawaban
          tidak bisa diubah.
        </p>
        <p class="notice review-summary">
          {{ unansweredCount ? unansweredCount + ' soal belum dijawab.' : 'Semua soal sudah dijawab.' }}
          {{ flaggedCount ? flaggedCount + ' soal ditandai ragu.' : 'Tidak ada soal ditandai ragu.' }}
          Pilih nomor soal untuk memeriksa kembali.
        </p>
        <ul class="review-numbers" aria-label="Status setiap jawaban">
          <li
            v-for="(question, n) in a.questions"
            :key="question.id"
          >
            <button
              type="button"
              :class="{ blank: at.answers[question.id] === undefined }"
              :aria-label="'Soal ' + (n + 1) + (at.answers[question.id] === undefined ? ', belum dijawab' : ', terjawab') + (at.flags.includes(question.id) ? ', ditandai ragu' : '')"
              @click="goToQuestion(n)"
            >
              <span class="review-question-number">{{ n + 1 }}</span>
              <span>{{ at.answers[question.id] === undefined ? 'Belum dijawab' : 'Terjawab' }}</span>
              <Icon v-if="at.flags.includes(question.id)" name="flag" class="sm" />
            </button>
          </li>
        </ul></template
      ><template #footer
        ><button class="btn" @click="confirm = false">Cek kembali</button
        ><button class="btn primary" :disabled="locked" @click="submit()">
          {{ a.type === "Tugas" ? "Ya, kirim tugas" : "Kirim jawaban" }}
        </button></template
      ></AppDialog
    ></template
  >
  <div v-else class="empty">
    <h2>Sesi tidak ditemukan</h2>
    <RouterLink class="btn mt" to="/student">Kembali ke assessment</RouterLink>
  </div>
</template>
