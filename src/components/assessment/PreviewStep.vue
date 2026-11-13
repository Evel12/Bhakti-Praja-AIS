<script setup>
import { date, time } from "../../utils/format.js";
import QuestionPreview from "./QuestionPreview.vue";
defineProps({ draft: Object });
</script>
<template>
  <h2>Periksa sebelum terbit</h2>
  <dl class="detail-grid">
    <div>
      <dt>Jenis / Kelas</dt>
      <dd>{{ draft.type }} · {{ draft.className }}</dd>
    </div>
    <div>
      <dt>Waktu buka</dt>
      <dd>{{ date(draft.openAt) }} · {{ time(draft.openAt) }}</dd>
    </div>
    <div>
      <dt>Waktu tutup</dt>
      <dd>{{ date(draft.closeAt) }} · {{ time(draft.closeAt) }}</dd>
    </div>
  </dl>
  <p class="body-copy mb">{{ draft.instructions }}</p>
  <QuestionPreview v-if="draft.type !== 'Tugas'" :questions="draft.questions" />
  <p class="notice">
    Konten dikunci setelah terbit. Nilai dirilis
    {{
      draft.releaseMode === "manual"
        ? "secara manual oleh pengajar."
        : "langsung setelah peserta mengirim jawaban."
    }}
  </p>
</template>
