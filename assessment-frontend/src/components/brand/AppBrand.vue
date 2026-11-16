<script setup>
import { ref } from "vue";

defineProps({
  compact: Boolean,
  interactive: { type: Boolean, default: true },
});
const logo = "/brand/smk-bhakti-praja-batang.png";
const logoAvailable = ref(true);
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
    ><span
      class="brand-logo-slot"
      :class="{ 'is-compact': compact }"
      role="img"
      :aria-label="logoAvailable ? 'Logo SMK Bhakti Praja Batang' : 'Placeholder logo sekolah'"
    >
      <img
        v-if="logoAvailable"
        :src="logo"
        alt=""
        @error="logoAvailable = false"
      />
      <span v-else class="brand-logo-fallback" aria-hidden="true">LOGO</span>
    </span>
    <div v-if="!compact" class="brand-copy sidebar-copy">
      <div class="brand-copy-inner">
        <div class="brand-name">SMK Bhakti Praja Batang</div>
        <div class="brand-sub">Assessment space</div>
      </div>
    </div></component
  >
</template>
