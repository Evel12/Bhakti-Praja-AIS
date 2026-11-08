<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import { createSidebarMotion } from "../motion/navigation.js";
import { useRoute, useRouter } from "vue-router";
import { useUiStore } from "../stores/uiStore.js";
import { useAuthStore } from "../stores/authStore.js";
import { useAssessmentStore } from "../stores/assessmentStore.js";
import { gradingQueue } from "../domain/teacherWork.js";
import AppSidebar from "../components/navigation/AppSidebar.vue";
import Icon from "../components/ui/Icon.vue";
import AppDialog from "../components/ui/AppDialog.vue";
const route = useRoute(),
  router = useRouter(),
  ui = useUiStore(),
  authStore = useAuthStore(),
  assessmentStore = useAssessmentStore(),
  help = ref(false),
  logoutConfirm = ref(false);
const shell = ref();
let sidebarMotion,
  revision = 0;

const pendingGradingCount = computed(() =>
  gradingQueue(assessmentStore.db).reduce(
    (sum, entry) => sum + entry.attempts.length,
    0,
  ),
);

async function handleLogout() {
  logoutConfirm.value = false;
  await authStore.logout();
  router.push("/login");
}

onMounted(() => {
  sidebarMotion = createSidebarMotion(shell.value);
  authStore.restoreSession();
});
onBeforeUnmount(() => {
  revision++;
  sidebarMotion?.dispose();
});
watch(
  () => ui.collapsed,
  async (collapsed) => {
    const ticket = ++revision;
    if (matchMedia("(max-width: 1023px)").matches) return;
    sidebarMotion?.capture();
    await nextTick();
    if (ticket === revision) sidebarMotion?.play(collapsed);
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
    <AppSidebar @logout="logoutConfirm = true" />
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
          ><span>{{
            route.meta.student ? "Ruang peserta" : "Ruang pengajar"
          }}</span>
        </div>
        <div class="topbar-actions">
          <button
            type="button"
            class="btn auth-header-pill"
            aria-label="Akun dan keluar"
            @click="logoutConfirm = true"
          >
            <Icon name="user" />
            <span class="auth-header-email">{{
              authStore.user?.email || "Akun"
            }}</span>
            <Icon name="logout" class="sm" />
          </button>
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
        <div id="route-scene" class="route-scene"><slot /></div>
      </div>
      <footer class="footer-note">
        SMK Bhakti Praja Batang · Ruang yang lebih tenang untuk belajar.
      </footer>
    </main>
    <nav
      class="mobile-bottom-nav"
      aria-label="Navigasi cepat"
      :inert="ui.mobileOpen"
    >
      <template v-if="!route.meta.student">
        <RouterLink
          to="/dashboard"
          class="mobile-bottom-link"
          :class="{ active: route.path === '/dashboard' }"
          :aria-current="route.path === '/dashboard' ? 'page' : undefined"
        >
          <Icon name="grid" class="sm" />
          <span>Ringkasan</span>
        </RouterLink>
        <RouterLink
          to="/assessments/all"
          class="mobile-bottom-link"
          :class="{ active: /assessments|builder/.test(route.path) }"
          :aria-current="/assessments|builder/.test(route.path) ? 'page' : undefined"
        >
          <Icon name="briefcase" class="sm" />
          <span>Assessment</span>
        </RouterLink>
        <RouterLink
          to="/bank"
          class="mobile-bottom-link"
          :class="{ active: route.path === '/bank' }"
          :aria-current="route.path === '/bank' ? 'page' : undefined"
        >
          <Icon name="book" class="sm" />
          <span>Bank soal</span>
        </RouterLink>
        <RouterLink
          to="/results"
          class="mobile-bottom-link"
          :class="{ active: /results|grade/.test(route.path) }"
          :aria-current="/results|grade/.test(route.path) ? 'page' : undefined"
        >
          <Icon name="chart" class="sm" />
          <span>Hasil</span>
          <em
            v-if="pendingGradingCount"
            class="mobile-nav-badge"
            :aria-label="pendingGradingCount + ' perlu dinilai'"
            >{{ pendingGradingCount }}</em
          >
        </RouterLink>
      </template>
      <template v-else>
        <RouterLink
          to="/student"
          class="mobile-bottom-link"
          :class="{ active: route.path !== '/my-results' }"
          :aria-current="route.path !== '/my-results' ? 'page' : undefined"
        >
          <Icon name="book" class="sm" />
          <span>Assessment</span>
        </RouterLink>
        <RouterLink
          to="/my-results"
          class="mobile-bottom-link"
          :class="{ active: route.path === '/my-results' }"
          :aria-current="route.path === '/my-results' ? 'page' : undefined"
        >
          <Icon name="chart" class="sm" />
          <span>Hasil saya</span>
        </RouterLink>
      </template>
    </nav>
  </div>
  <AppDialog
    :open="logoutConfirm"
    title="Keluar dari akun?"
    @close="logoutConfirm = false"
  >
    <p class="dialog-copy">
      Sesi
      <strong>{{ authStore.user?.email || "akun aktif" }}</strong>
      akan diakhiri di perangkat ini. Draft dan progres yang sudah tersimpan
      tetap aman.
    </p>
    <template #footer>
      <button class="btn" @click="logoutConfirm = false">Batal</button>
      <button class="btn danger" @click="handleLogout">Ya, keluar</button>
    </template>
  </AppDialog>
  <AppDialog :open="help" title="Dari soal sampai hasil" @close="help = false"
    ><ol class="help-steps">
      <li>Buat assessment dan tentukan kelas.</li>
      <li>Susun soal atau pilih dari bank soal.</li>
      <li>Atur jadwal, cek, dan terbitkan.</li>
      <li>Keluar lalu masuk sebagai Peserta untuk mengerjakan.</li>
      <li>Masuk kembali sebagai Pengajar untuk menilai dan merilis hasil.</li>
    </ol>
    <p class="notice">
      Gunakan halaman Login untuk masuk sebagai Pengajar (`teacher@example.test`)
      atau Peserta (`student1@example.test`).
    </p></AppDialog
  >
</template>
