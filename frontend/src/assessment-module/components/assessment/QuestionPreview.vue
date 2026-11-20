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
      <div class="preview-question-head">
        <h3>{{ i + 1 }}. {{ q.text }}</h3>
        <span class="preview-points">{{ q.points }} poin</span>
      </div>
      <div
        v-for="(option, n) in q.options"
        :key="n"
        class="preview-option"
        :class="{
          correct: showKey && n === q.correct,
          wrong: showKey && answers && answers[q.id] === n && n !== q.correct,
          picked: answers && answers[q.id] === n,
        }"
      >
        <span class="preview-option-letter">{{ String.fromCharCode(65 + n) }}</span>
        <span class="preview-option-text">{{ option }}</span>
        <span class="preview-option-tags">
          <span v-if="showKey && n === q.correct" class="preview-badge is-correct">✓ Kunci</span>
          <strong v-if="answers && answers[q.id] === n" class="preview-badge is-picked">Jawaban peserta</strong>
        </span>
      </div>
      <p v-if="answers && answers[q.id] === undefined" class="preview-unanswered">Tidak dijawab</p>
      <p v-if="showKey && q.explanation" class="preview-explanation">
        <strong>Pembahasan:</strong> {{ q.explanation }}
      </p>
    </article>
  </div>
</template>
