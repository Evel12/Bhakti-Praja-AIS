<script setup>
import MotionField from "../../components/motion/MotionField.vue";
import { localInput, fromInput } from "../../utils/format.js";
import FieldError from "../ui/FieldError.vue";
import { useAssessmentFields } from "../../composables/useAssessmentFields.js";
const props = defineProps({ draft: Object, issues: { type: Array, default: () => [] } });
const { field, issue } = useAssessmentFields(() => props.issues);
</script>
<template>
  <h2>Jadwal & pengaturan</h2>
  <p class="section-caption mt">Semua waktu menggunakan WIB (UTC+7).</p>
  <div class="form-grid">
    <label class="field"
      ><span class="field-label">Waktu buka (WIB)</span
      ><MotionField
        ><input
          class="input date-field"
          type="datetime-local"
          :value="localInput(draft.openAt)"
          v-bind="field('openAt')"
          @input="
            draft.openAt = fromInput($event.target.value)
          " /></MotionField><FieldError :issue="issue('openAt')" /></label
    ><label class="field"
      ><span class="field-label">Waktu tutup (WIB)</span
      ><MotionField
        ><input
          class="input date-field"
          type="datetime-local"
          :value="localInput(draft.closeAt)"
          v-bind="field('closeAt')"
          @input="
            draft.closeAt = fromInput($event.target.value)
          " /></MotionField><FieldError :issue="issue('closeAt')" /></label
    ><label v-if="draft.type !== 'Tugas'" class="field"
      ><span class="field-label">Durasi (menit)</span
      ><MotionField
        ><input
          v-model.number="draft.duration"
            v-bind="field('duration')"
          type="number"
          min="1"
          max="240"
          class="input" /></MotionField
      ><FieldError :issue="issue('duration')" /><small class="field-hint"
        >1–240 menit. Pengerjaan berhenti saat waktu tutup.</small
      ></label
    ><label class="field"
      ><span class="field-label">Rilis nilai</span
      ><MotionField
        ><select v-model="draft.releaseMode" class="input">
          <option value="manual">Manual oleh pengajar</option>
          <option v-if="draft.type !== 'Tugas'" value="immediate">
            Langsung setelah dikirim
          </option>
        </select></MotionField
      ></label
    >
  </div>
</template>
