<script setup>
import { computed } from "vue";
import AppBrand from "../../components/brand/AppBrand.vue";
import { useAuthStore } from "../../stores/authStore.js";

const authStore = useAuthStore();

const homeDestination = computed(() => {
  if (!authStore.isAuthenticated) return "/login";
  return authStore.currentRole === "student" ? "/student" : "/dashboard";
});

const homeLabel = computed(() =>
  authStore.isAuthenticated ? "Kembali ke Beranda" : "Kembali ke Halaman Masuk",
);
</script>

<template>
  <div class="notfound-page-shell">
    <section class="notfound-card panel" aria-labelledby="notfound-heading">
      <AppBrand />
      <div class="notfound-body">
        <span class="eyebrow">404 &bull; Halaman Tidak Ditemukan</span>
        <h1 id="notfound-heading">Halaman tidak tersedia</h1>
        <p>
          Tautan yang Anda buka tidak ditemukan atau sudah dipindahkan. Gunakan tombol di bawah untuk kembali ke ruang kerja Anda.
        </p>
      </div>
      <div class="notfound-actions">
        <RouterLink :to="homeDestination" class="btn primary notfound-btn">
          {{ homeLabel }}
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.notfound-page-shell {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding:
    max(1.25rem, env(safe-area-inset-top))
    1rem
    max(1.5rem, env(safe-area-inset-bottom));
}

.notfound-card {
  width: 100%;
  max-width: 480px;
  padding: clamp(1.25rem, 5vw, 2rem);
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.notfound-body h1 {
  font-size: clamp(1.35rem, 1.15rem + 1vw, 1.55rem);
  margin: 0.3rem 0 0.4rem;
}

.notfound-body p {
  margin: 0;
  font-family: var(--font-content);
  font-size: 0.9rem;
  color: var(--muted);
  line-height: 1.5;
}

.notfound-actions {
  display: flex;
}

.notfound-btn {
  width: 100%;
  min-height: 48px;
  justify-content: center;
}
</style>
