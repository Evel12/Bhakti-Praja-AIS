<script setup>
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAssessmentStore } from "../../stores/assessmentStore.js";
import { canStart, STUDENT_ID } from "../../domain/assessment.js";
import { date, time } from "../../utils/format.js";
import PageTitle from "../../components/ui/PageTitle.vue";
const store = useAssessmentStore(),
  route = useRoute(),
  router = useRouter(),
  accepted = ref(false);
const a = computed(() =>
  store.db.assessments.find(
    (x) =>
      x.id === route.params.id &&
      x.className === "Kelas A" &&
      !["draft", "archived"].includes(x.state),
  ),
);
const permission = computed(() =>
  a.value ? canStart(a.value, store.db.attempts) : { allowed: false },
);
const prior = computed(() =>
  store.db.attempts.find(
    (x) => x.assessmentId === a.value?.id && x.studentId === STUDENT_ID,
  ),
);
function start() {
  const id = store.run(() => store.start(a.value));
  if (id) router.push("/attempt/" + id);
}
</script>
<template>
  <template v-if="a"
    ><PageTitle
      :title="a.title"
      :description="a.course + ' · ' + a.className"
    />
    <section class="panel">
      <h2>Petunjuk pengerjaan</h2>
      <p class="body-copy mt">{{ a.instructions }}</p>
      <dl class="detail-grid">
        <div>
          <dt>Jenis</dt>
          <dd>{{ a.type }}</dd>
        </div>
        <div>
          <dt>Durasi</dt>
          <dd>
            {{ a.type === "Tugas" ? "Sampai tenggat" : a.duration + " menit" }}
          </dd>
        </div>
        <div>
          <dt>Waktu tutup</dt>
          <dd>{{ date(a.closeAt) }} · {{ time(a.closeAt) }} WIB</dd>
        </div>
      </dl>
      <p class="notice">
        Jawaban tersimpan pada browser ini. Waktu berjalan sejak sesi dimulai
        dan tidak diulang saat keluar atau memuat ulang halaman.
      </p>
      <template v-if="permission.allowed"
        ><label class="check-label"
          ><input v-model="accepted" type="checkbox" />Saya memahami petunjuk
          dan siap mengerjakan secara mandiri.</label
        ><button class="btn primary mt" :disabled="!accepted" @click="start">
          {{ prior ? "Lanjutkan pengerjaan" : "Mulai assessment" }}
        </button></template
      ><template v-else
        ><p class="notice warning">{{ permission.reason }}</p>
        <RouterLink
          v-if="prior"
          class="btn"
          :to="
            (prior.status === 'submitted' ? '/review/' : '/attempt/') + prior.id
          "
          >{{
            prior.status === "submitted"
              ? "Lihat pengumpulan"
              : "Buka sesi tersimpan"
          }}</RouterLink
        ></template
      ><RouterLink to="/student" class="btn mt">Kembali</RouterLink>
    </section></template
  >
  <div v-else class="empty">
    Assessment tidak ditemukan atau belum tersedia.
  </div>
</template>
