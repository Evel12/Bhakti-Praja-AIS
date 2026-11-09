<script setup>
defineProps({
  compact: Boolean,
  interactive: { type: Boolean, default: true },
});
const logo = "/brand/smk-bhakti-praja-batang.png";
</script>
<template>
  <component
    :is="interactive ? 'RouterLink' : 'div'"
    v-bind="
      interactive
        ? { to: '/dashboard', 'aria-label': 'SMK Bhakti Praja Batang Home' }
        : {}
    "
    class="brand"
    ><img
      :src="logo"
      alt="Logo SMK Bhakti Praja Batang"
      :width="compact ? 40 : 48"
      :height="compact ? 40 : 48"
    />
    <div v-if="!compact" class="brand-copy sidebar-copy">
      <div class="brand-copy-inner">
        <div class="brand-name">SMK Bhakti Praja Batang</div>
        <div class="brand-sub">Assessment space</div>
      </div>
    </div></component
  >
</template>
