<script setup>
defineProps({ compact: Boolean });
const logo = "/brand/tut-wuri-handayani.png";
</script>
<template>
  <RouterLink to="/dashboard" class="brand" aria-label="EXAMNIA beranda"
    ><img
      :src="logo"
      alt="Tut Wuri Handayani"
      :width="compact ? 40 : 48"
      :height="compact ? 40 : 48"
    />
    <div v-if="!compact">
      <div class="brand-name">EXAMNIA</div>
      <div class="brand-sub">Assessment space</div>
    </div></RouterLink
  >
</template>
