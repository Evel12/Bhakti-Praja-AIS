<script setup>
defineProps({ status: String });
const styles = {
  Aktif: "active",
  Draft: "draft",
  Terjadwal: "scheduled",
  Ditutup: "closed",
  Terkirim: "submitted",
  "Waktu habis": "expired",
};
</script>
<template>
  <span class="status-label" :class="styles[status]">{{ status }}</span>
</template>
