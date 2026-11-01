<script setup>
defineProps({ status: String });
const styles = {
  Aktif: "active",
  Draft: "draft",
  Terjadwal: "scheduled",
  Ditutup: "closed",
};
</script>
<template>
  <span class="badge" :class="styles[status]">{{ status }}</span>
</template>
