<script setup>
import { COURSES, CLASSES } from "../../domain/assessment.js";
defineProps({ draft: Object });
</script>
<template>
  <h2>Identitas assessment</h2>
  <p class="section-caption mt">Tentukan tujuan dan peserta assessment Anda.</p>
  <div class="form-grid">
    <label class="field full"
      ><span class="field-label">Judul assessment *</span
      ><input
        v-model="draft.title"
        class="input"
        maxlength="150"
        placeholder="Contoh: Kuis Arsitektur Jaringan"
        required /></label
    ><label class="field"
      ><span class="field-label">Jenis assessment</span
      ><select v-model="draft.type" class="input">
        <option v-for="v in ['Kuis', 'Tugas', 'Ujian']" :key="v">
          {{ v }}
        </option>
      </select></label
    ><label class="field"
      ><span class="field-label">Mata kuliah</span
      ><select v-model="draft.course" class="input">
        <option v-for="v in COURSES" :key="v">{{ v }}</option>
      </select></label
    ><label class="field"
      ><span class="field-label">Kelas</span
      ><select v-model="draft.className" class="input">
        <option v-for="v in CLASSES" :key="v">{{ v }}</option>
      </select></label
    ><label class="field full"
      ><span class="field-label">Deskripsi</span
      ><textarea
        v-model="draft.description"
        class="input"
        maxlength="2000"
        placeholder="Apa yang akan dipelajari atau dievaluasi?"
      />
    </label>
  </div>
</template>
