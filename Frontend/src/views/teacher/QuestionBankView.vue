<script setup>
import MotionList from "../../components/motion/MotionList.vue";
import MotionField from "../../components/motion/MotionField.vue";
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useAssessmentStore } from "../../stores/assessmentStore.js";
import {
  newQuestion,
  COURSES,
  clone,
  newAssessment,
  validateAssessment,
} from "../../domain/assessment.js";
import PageTitle from "../../components/ui/PageTitle.vue";
import AppDialog from "../../components/ui/AppDialog.vue";
import QuestionEditor from "../../components/assessment/QuestionEditor.vue";
import QuestionPreview from "../../components/assessment/QuestionPreview.vue";
const store = useAssessmentStore(),
  router = useRouter(),
  search = ref(""),
  editing = ref(null),
  detail = ref(null),
  errors = ref([]);
const questions = computed(() =>
  store.db.bank.filter((q) =>
    `${q.text} ${q.topic}`.toLowerCase().includes(search.value.toLowerCase()),
  ),
);
function create() {
  editing.value = { ...newQuestion(), topic: COURSES[0] };
  errors.value = [];
}
function save() {
  const a = newAssessment();
  a.title = "Bank";
  a.questions = [editing.value];
  errors.value = validateAssessment(a);
  if (errors.value.length) return;
  const ok = store.run(
    () =>
      store.transaction((db) => {
        db.bank.unshift(clone(editing.value));
        return true;
      }),
    "Soal tersimpan.",
  );
  if (ok) editing.value = null;
}
function use(q) {
  const id = store.run(() => store.create(q));
  if (id) router.push("/builder/" + id);
}
</script>
<template>
  <PageTitle
    title="Bank soal"
    description="Simpan ide yang baik. Gunakan kembali untuk assessment berikutnya."
    ><button class="btn primary" @click="create">
      + Tambah soal
    </button></PageTitle
  >
  <div class="filters">
    <label class="search"
      ><MotionField
        ><input
          v-model="search"
          class="input"
          aria-label="Cari bank soal"
          placeholder="Cari pertanyaan atau mata kuliah..." /></MotionField></label
    ><span class="section-caption">{{ questions.length }} soal tersedia</span>
  </div>
  <MotionList class="bank-grid" :item-keys="questions.map((q) => q.id)">
    <article
      v-for="q in questions"
      :key="q.id"
      :data-motion-key="q.id"
      class="bank-card"
    >
      <span class="bank-topic">{{ q.topic }}</span>
      <h3>{{ q.text }}</h3>
      <p>Pilihan ganda · {{ q.points }} poin</p>
      <div class="action-row">
        <button class="btn small" @click="detail = q">Lihat soal</button
        ><button class="btn small soft" @click="use(q)">Gunakan soal</button>
      </div>
    </article>
    <p v-if="!questions.length" class="empty">Tidak ada soal yang sesuai.</p>
  </MotionList>
  <AppDialog
    :open="!!editing"
    title="Tambahkan soal ke bank"
    @close="editing = null"
    ><template v-if="editing"
      ><label class="field mb"
        ><span class="field-label">Mata kuliah</span
        ><MotionField
          ><select v-model="editing.topic" class="input">
            <option v-for="c in COURSES" :key="c">{{ c }}</option>
          </select></MotionField
        ></label
      ><QuestionEditor :question="editing" />
      <ul v-if="errors.length" class="error-box" role="alert">
        <li v-for="e in errors" :key="e">{{ e }}</li>
      </ul></template
    ><template #footer
      ><button class="btn" @click="editing = null">Batal</button
      ><button class="btn primary" @click="save">Simpan soal</button></template
    ></AppDialog
  ><AppDialog :open="!!detail" title="Detail soal" @close="detail = null"
    ><QuestionPreview v-if="detail" :questions="[detail]"
  /></AppDialog>
</template>
