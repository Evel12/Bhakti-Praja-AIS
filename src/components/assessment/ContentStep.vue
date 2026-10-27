<script setup>
import MotionField from "../../components/motion/MotionField.vue";
import { computed } from "vue";
import Icon from "../ui/Icon.vue";
import QuestionEditor from "./QuestionEditor.vue";
const props = defineProps({ draft: Object, index: Number });
defineEmits(["add", "bank", "ai", "remove", "select"]);
const question = computed(() => props.draft.questions[props.index]);
</script>
<template>
  <div class="panel-header">
    <h2>
      {{ draft.type === "Tugas" ? "Instruksi tugas" : "Susun konten soal" }}
    </h2>
    <span class="section-caption" v-if="draft.type !== 'Tugas'"
      >{{ draft.questions.length }} soal</span
    >
  </div>
  <label class="field"
    ><span class="field-label"
      >Instruksi {{ draft.type === "Tugas" ? "tugas" : "pengerjaan" }}</span
    ><MotionField>
      <textarea
        v-model="draft.instructions"
        class="input"
        maxlength="5000"
      /></MotionField></label
  ><template v-if="draft.type !== 'Tugas'"
    ><div class="source-actions">
      <button class="btn small" type="button" @click="$emit('add')">
        <Icon name="plus" />Soal manual</button
      ><button class="btn small" type="button" @click="$emit('bank')">
        <Icon name="book" />Dari bank soal</button
      ><button class="btn small" type="button" @click="$emit('ai')">
        <Icon name="sparkles" />Bantu dengan AI
      </button>
    </div>
    <div class="question-layout">
      <nav class="question-nav" aria-label="Daftar soal">
        <button
          v-for="(q, i) in draft.questions"
          :key="q.id"
          type="button"
          :class="{ active: index === i }"
          @click="$emit('select', i)"
        >
          Soal {{ i + 1 }}
          <span v-if="q.source === 'ai' && !q.reviewed">!</span>
        </button>
      </nav>
      <div v-if="question">
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h3>Soal {{ index + 1 }}</h3>
          <button
            class="btn small danger"
            type="button"
            @click="$emit('remove')"
          >
            Hapus soal
          </button>
        </div>
        <QuestionEditor :question="question" :index="index" />
      </div>
      <p v-else class="empty">Tambahkan soal untuk memulai.</p>
    </div></template
  >
  <p v-else class="notice">
    Peserta dapat mengunggah PDF, DOCX, JPG, atau PNG hingga 2 MB. Tugas dinilai
    secara manual.
  </p>
</template>
