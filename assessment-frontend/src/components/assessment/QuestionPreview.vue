<script setup>
defineProps({
  questions: Array,
  answers: Object,
  showKey: { type: Boolean, default: true },
});
</script>
<template>
  <div class="preview-list">
    <article v-for="(q, i) in questions" :key="q.id" class="preview-question">
      <h3>{{ i + 1 }}. {{ q.text }}</h3>
      <p>{{ q.points }} poin</p>
      <div
        v-for="(option, n) in q.options"
        :key="n"
        class="preview-option"
        :class="{ correct: showKey && n === q.correct }"
      >
        {{ String.fromCharCode(65 + n) }}. {{ option }}
        <span v-if="showKey && n === q.correct">✓ Kunci</span
        ><strong v-if="answers && answers[q.id] === n">
          · Jawaban peserta</strong
        >
      </div>
      <p v-if="answers && answers[q.id] === undefined">Tidak dijawab</p>
      <p v-if="showKey && q.explanation">{{ q.explanation }}</p>
    </article>
  </div>
</template>
