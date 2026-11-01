<script setup>
import MotionField from "../../components/motion/MotionField.vue";
import FieldError from "../ui/FieldError.vue";
import { useAssessmentFields } from "../../composables/useAssessmentFields.js";
const props = defineProps({
  question: Object,
  index: { type: Number, default: 0 },
  issues: { type: Array, default: () => [] },
});
const { field, issue } = useAssessmentFields(() => props.issues, () => props.question.id);
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
          v-bind="field('text')"
          class="input"
          maxlength="2000"
          @input="invalidate"
        />
      </MotionField>
      <FieldError :issue="issue('text')" />
    </label>
    <fieldset>
      <legend class="field-label">
        Pilihan jawaban · tandai kunci yang benar
      </legend>
      <label v-for="(_, i) in question.options" :key="i" class="option-editor"
        ><input
          v-model="question.correct"
          :id="i === 0 ? field('correct').id : field('correct').id + '-' + i"
          :aria-invalid="field('correct')['aria-invalid']"
          :aria-describedby="field('correct')['aria-describedby']"
          type="radio"
          :value="i"
          :name="'correct-' + question.id"
          :aria-label="'Kunci jawaban ' + String.fromCharCode(65 + i)"
          @change="invalidate" /><span class="option-letter">{{
          String.fromCharCode(65 + i)
        }}</span
        ><div class="option-content"><MotionField
          ><input
            v-model="question.options[i]"
            v-bind="field('option-' + i)"
            class="input"
            :aria-label="'Pilihan ' + String.fromCharCode(65 + i)"
            maxlength="1000"
            @input="invalidate" /></MotionField><FieldError :issue="issue('option-' + i)" /></div
      ></label>
      <FieldError :issue="issue('correct')" />
      <button v-if="question.options.length < 2" v-bind="field('options')" class="btn small" type="button" @click="question.options.push(''); invalidate()">Tambahkan pilihan</button>
      <FieldError :issue="issue('options')" />
    </fieldset>
    <div class="form-grid">
      <label class="field"
        ><span class="field-label">Poin soal</span
        ><MotionField
          ><input
            v-model.number="question.points"
            v-bind="field('points')"
            type="number"
            min="1"
            max="100"
            class="input" /></MotionField><FieldError :issue="issue('points')" /></label
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
      ><input v-model="question.reviewed" v-bind="field('reviewed')" type="checkbox" />Saya sudah mengecek
      isi dan kunci jawaban soal AI ini.</label
    >
    <FieldError :issue="issue('reviewed')" />
  </div>
</template>
