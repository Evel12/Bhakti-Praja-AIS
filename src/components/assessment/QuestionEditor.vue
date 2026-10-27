<script setup>
import MotionField from "../../components/motion/MotionField.vue";
const props = defineProps({
  question: Object,
  index: { type: Number, default: 0 },
});
function invalidate() {
  if (props.question.source === "ai") props.question.reviewed = false;
}
</script>
<template>
  <div class="question-editor">
    <label class="field"
      ><span class="field-label">Pertanyaan {{ index + 1 }}</span
      ><MotionField>
        <textarea
          v-model="question.text"
          class="input"
          maxlength="2000"
          @input="invalidate"
        />
      </MotionField>
    </label>
    <fieldset>
      <legend class="field-label">
        Pilihan jawaban · tandai kunci yang benar
      </legend>
      <label v-for="(_, i) in question.options" :key="i" class="option-editor"
        ><input
          v-model="question.correct"
          type="radio"
          :value="i"
          :name="'correct-' + question.id"
          :aria-label="'Kunci jawaban ' + String.fromCharCode(65 + i)"
          @change="invalidate" /><span class="option-letter">{{
          String.fromCharCode(65 + i)
        }}</span
        ><MotionField
          ><input
            v-model="question.options[i]"
            class="input"
            :aria-label="'Pilihan ' + String.fromCharCode(65 + i)"
            maxlength="1000"
            @input="invalidate" /></MotionField
      ></label>
    </fieldset>
    <div class="form-grid">
      <label class="field"
        ><span class="field-label">Poin soal</span
        ><MotionField
          ><input
            v-model.number="question.points"
            type="number"
            min="1"
            max="100"
            class="input" /></MotionField></label
      ><label class="field"
        ><span class="field-label">Pembahasan</span
        ><MotionField>
          <textarea
            v-model="question.explanation"
            class="input"
            maxlength="2000"
          />
        </MotionField>
      </label>
    </div>
    <label v-if="question.source === 'ai'" class="check-label notice warning"
      ><input v-model="question.reviewed" type="checkbox" />Saya telah meninjau
      isi dan kunci jawaban soal AI ini.</label
    >
  </div>
</template>
