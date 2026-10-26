<script setup>
import Icon from "../ui/Icon.vue";
defineProps({
  to: String,
  label: String,
  icon: String,
  compact: Boolean,
  active: Boolean,
});
</script>
<template>
  <RouterLink
    :to="to"
    class="nav-item tip-parent"
    :class="{ active }"
    :aria-label="label"
    :aria-current="active ? 'page' : undefined"
    ><Icon :name="icon" /><span v-if="!compact">{{ label }}</span
    ><span v-else class="rail-tooltip" role="tooltip">{{
      label
    }}</span></RouterLink
  >
</template>
