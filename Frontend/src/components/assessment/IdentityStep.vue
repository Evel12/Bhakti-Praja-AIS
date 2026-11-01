<script setup>
import MotionField from "../../components/motion/MotionField.vue";
import { COURSES, CLASSES } from "../../domain/assessment.js";
import FieldError from "../ui/FieldError.vue";
import { useAssessmentFields } from "../../composables/useAssessmentFields.js";
const props = defineProps({ draft: Object, issues: { type: Array, default: () => [] } });
const { field, issue } = useAssessmentFields(() => props.issues);
</script>
<template>
  <h2>Identitas assessment</h2>
  <p class="section-caption mt">Isi detailnya dan pilih kelas yang akan mengerjakan.</p>
  <div class="form-grid">
    <label class="field full"
      ><span class="field-label">Judul assessment *</span
      ><MotionField
        ><input
          v-model="draft.title"
          v-bind="field('title')"
          class="input"
          maxlength="150"
          placeholder="Contoh: Kuis Arsitektur Jaringan"
          required /></MotionField><FieldError :issue="issue('title')" /></label
    ><label class="field"
      ><span class="field-label">Jenis assessment</span
      ><MotionField
        ><select v-model="draft.type" class="input">
          <option v-for="v in ['Kuis', 'Tugas', 'Ujian']" :key="v">
            {{ v }}
          </option>
        </select></MotionField
      ></label
    ><label class="field"
      ><span class="field-label">Mata kuliah</span
      ><MotionField
        ><select v-model="draft.course" v-bind="field('course')" class="input">
          <option v-for="v in COURSES" :key="v">{{ v }}</option>
        </select></MotionField><FieldError :issue="issue('course')" /></label
    ><label class="field"
      ><span class="field-label">Kelas</span
      ><MotionField
        ><select v-model="draft.className" v-bind="field('className')" class="input">
          <option v-for="v in CLASSES" :key="v">{{ v }}</option>
        </select></MotionField><FieldError :issue="issue('className')" /></label
    ><label class="field full"
      ><span class="field-label">Deskripsi</span
      ><MotionField>
        <textarea
          v-model="draft.description"
          class="input"
          maxlength="2000"
          placeholder="Assessment ini membahas apa?"
        />
      </MotionField>
    </label>
  </div>
</template>
