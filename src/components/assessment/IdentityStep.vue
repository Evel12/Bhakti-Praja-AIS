<script setup>
import MotionField from "../../components/motion/MotionField.vue";
import { COURSES, CLASSES } from "../../domain/assessment.js";
defineProps({ draft: Object });
</script>
<template>
  <h2>Identitas assessment</h2>
  <p class="section-caption mt">Tentukan tujuan dan peserta assessment Anda.</p>
  <div class="form-grid">
    <label class="field full"
      ><span class="field-label">Judul assessment *</span
      ><MotionField
        ><input
          v-model="draft.title"
          class="input"
          maxlength="150"
          placeholder="Contoh: Kuis Arsitektur Jaringan"
          required /></MotionField></label
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
        ><select v-model="draft.course" class="input">
          <option v-for="v in COURSES" :key="v">{{ v }}</option>
        </select></MotionField
      ></label
    ><label class="field"
      ><span class="field-label">Kelas</span
      ><MotionField
        ><select v-model="draft.className" class="input">
          <option v-for="v in CLASSES" :key="v">{{ v }}</option>
        </select></MotionField
      ></label
    ><label class="field full"
      ><span class="field-label">Deskripsi</span
      ><MotionField>
        <textarea
          v-model="draft.description"
          class="input"
          maxlength="2000"
          placeholder="Apa yang akan dipelajari atau dievaluasi?"
        />
      </MotionField>
    </label>
  </div>
</template>
