<script setup>
defineProps({ issue: Object });
</script>
<template>
  <span v-if="issue" :id="issue.target + '-error'" class="field-error">{{ issue.message }}</span>
</template>
