<script setup>
import { localInput, fromInput } from "../../utils/format.js";
defineProps({ draft: Object });
</script>
<template>
  <h2>Jadwal & pengaturan</h2>
  <p class="section-caption mt">Semua waktu menggunakan WIB (UTC+7).</p>
  <div class="form-grid">
    <label class="field"
      ><span class="field-label">Waktu buka (WIB)</span
      ><input
        class="input date-field"
        type="datetime-local"
        :value="localInput(draft.openAt)"
        @input="draft.openAt = fromInput($event.target.value)" /></label
    ><label class="field"
      ><span class="field-label">Waktu tutup (WIB)</span
      ><input
        class="input date-field"
        type="datetime-local"
        :value="localInput(draft.closeAt)"
        @input="draft.closeAt = fromInput($event.target.value)" /></label
    ><label v-if="draft.type !== 'Tugas'" class="field"
      ><span class="field-label">Durasi (menit)</span
      ><input
        v-model.number="draft.duration"
        type="number"
        min="1"
        max="240"
        class="input"
      /><small class="field-hint"
        >1–240 menit. Pengerjaan berhenti saat waktu tutup.</small
      ></label
    ><label class="field"
      ><span class="field-label">Rilis nilai</span
      ><select v-model="draft.releaseMode" class="input">
        <option value="manual">Manual oleh pengajar</option>
        <option v-if="draft.type !== 'Tugas'" value="immediate">
          Langsung setelah dikirim
        </option>
      </select></label
    >
  </div>
</template>
