<script setup>
defineProps({ title: String, description: String });
</script>
<template>
  <div class="page-title">
    <div>
      <div class="eyebrow">Ruang assessment</div>
      <h1>{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
    </div>
    <div class="action-row"><slot /></div>
  </div>
</template>
