<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import { createNavigationLayout } from "../motion/navigation.js";
import { useRoute, useRouter } from "vue-router";
import { useUiStore } from "../stores/uiStore.js";
import AppSidebar from "../components/navigation/AppSidebar.vue";
import RoleSwitcher from "../components/navigation/RoleSwitcher.vue";
import Icon from "../components/ui/Icon.vue";
import AppDialog from "../components/ui/AppDialog.vue";
import PageAtmosphere from "../components/motion/PageAtmosphere.vue";
import { embedded, sessionUser } from '../integration/session.js';
const route = useRoute(),
  router = useRouter(),
  ui = useUiStore(),
  help = ref(false);
const shell = ref();
let layout,
  revision = 0;
onMounted(() => {
  layout = createNavigationLayout(shell.value);
});
onBeforeUnmount(() => {
  revision++;
  layout?.dispose();
});
watch(
  () => ui.collapsed,
  async () => {
    const ticket = ++revision;
    const content = document.getElementById("main-content");
    if (!content || matchMedia("(max-width: 1023px)").matches) return;
    layout?.capture([content]);
    await nextTick();
    if (ticket === revision) layout?.play([content]);
  },
);
watch(
  () => route.path,
  async (path, previousPath) => {
    if (
      route.meta.assessmentList &&
      router.resolve(previousPath).meta.assessmentList
    ) return;
    await nextTick();
    document.getElementById("main-content")?.focus({ preventScroll: true });
  },
);
</script>
<template>
  <section v-if="embedded" class="embedded-assessment">
    <nav aria-label="Navigasi assessment" class="embedded-tabs">
      <template v-if="sessionUser?.role !== 'murid'">
        <RouterLink to="/dashboard">Ringkasan</RouterLink>
        <RouterLink to="/assessments/all">Assessment</RouterLink>
        <RouterLink to="/bank">Bank soal</RouterLink>
        <RouterLink to="/results">Hasil dan penilaian</RouterLink>
      </template>
      <template v-else>
        <RouterLink to="/student">Assessment saya</RouterLink>
        <RouterLink to="/my-results">Hasil saya</RouterLink>
      </template>
    </nav>
    <p class="notice warning">Ruang assessment lokal: data contoh dan perubahan disimpan pada browser untuk akun ini. Nilai belum tersinkron ke sekolah atau portal wali.</p>
    <main id="main-content" tabindex="-1"><div id="route-scene" class="route-scene"><slot /></div></main>
  </section>
  <template v-else>
  <a
    class="skip-link"
    href="#main-content"
    @click.prevent="
      () => {
        $refs.main.focus();
      }
    "
    >Lewati ke konten</a
  >
  <div ref="shell" class="shell" :class="{ 'sidebar-collapsed': ui.collapsed }">
    <AppSidebar />
    <main
      id="main-content"
      ref="main"
      class="content"
      tabindex="-1"
      :inert="ui.mobileOpen"
    >
      <header class="topbar">
        <div class="breadcrumb">
          <button
            id="menu-trigger"
            class="icon-btn mobile-menu"
            aria-label="Buka navigasi"
            :aria-expanded="ui.mobileOpen"
            aria-controls="sidebar"
            @click="ui.mobileOpen = true"
          >
            <Icon name="menu" /></button
          ><strong>EXAMNIA</strong><span>/</span
          ><span>{{
            route.meta.student ? "Ruang peserta" : "Ruang pengajar"
          }}</span>
        </div>
        <div class="topbar-actions">
          <RoleSwitcher />
          <button
            class="icon-btn"
            aria-label="Panduan penggunaan"
            @click="help = true"
          >
            <Icon name="help" />
          </button>
        </div>
      </header>
      <div class="page-stage">
        <PageAtmosphere
          v-if="['/dashboard', '/student'].includes(route.path)"
        />
        <div id="route-scene" class="route-scene"><slot /></div>
      </div>
      <footer class="footer-note">
        EXAMNIA · Ruang yang lebih tenang untuk belajar.
      </footer>
    </main>
  </div>
  <AppDialog :open="help" title="Dari soal sampai hasil" @close="help = false"
    ><ol class="help-steps">
      <li>Buat assessment dan tentukan kelas.</li>
      <li>Susun soal atau pilih dari bank soal.</li>
      <li>Atur jadwal, periksa, dan terbitkan.</li>
      <li>Ganti tampilan menjadi Peserta untuk mengerjakan.</li>
      <li>Kembali sebagai Pengajar untuk menilai dan merilis hasil.</li>
    </ol>
    <p class="notice">
      Versi UI dengan penyimpanan lokal browser. Pilihan peran adalah simulasi;
      autentikasi, API Laravel, dan layanan AI belum terhubung.
    </p></AppDialog
  >
  </template>
</template>
<style scoped>
.embedded-assessment { padding: 16px; min-width: 0; }
.embedded-assessment main { outline: none; }
.embedded-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.embedded-tabs a { padding: 10px 14px; border: 1px solid #dbe5e9; border-radius: 10px; background: white; }
.embedded-tabs a.router-link-active { background: #e6f4f1; color: #176754; }
</style>
