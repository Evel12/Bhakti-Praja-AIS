<script setup>
import AppBrand from "../components/brand/AppBrand.vue";
</script>
<template>
  <div class="shell exam-shell">
    <main id="main-content" class="content">
      <header class="topbar">
        <AppBrand /><RouterLink to="/student" class="btn"
          >Simpan & keluar</RouterLink
        >
      </header>
      <slot />
    </main>
  </div>
</template>
