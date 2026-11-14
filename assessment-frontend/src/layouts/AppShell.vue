<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import { createSidebarMotion } from "../motion/navigation.js";
import { useRoute, useRouter } from "vue-router";
import { useUiStore } from "../stores/uiStore.js";
import { useAuthStore } from "../stores/authStore.js";
import { useAssessmentStore } from "../stores/assessmentStore.js";
import { useLmsStore } from "../stores/lmsStore.js";
import { gradingQueue } from "../domain/teacherWork.js";
import AppSidebar from "../components/navigation/AppSidebar.vue";
import MotionActiveIndicator from "../components/motion/MotionActiveIndicator.vue";
import Icon from "../components/ui/Icon.vue";
import AppDialog from "../components/ui/AppDialog.vue";
const route = useRoute(),
  router = useRouter(),
  ui = useUiStore(),
  authStore = useAuthStore(),
  assessmentStore = useAssessmentStore(),
  lmsStore = useLmsStore(),
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
    <AppSidebar @logout="logoutConfirm = true" @help="help = true" />
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
          <RouterLink
            :to="route.meta.student ? '/student/notifications' : '/notifications'"
            class="icon-btn lms-bell-btn"
            aria-label="Notifikasi"
          >
            <Icon name="bell" />
            <span
              v-if="lmsStore.unreadCount > 0"
              class="lms-bell-badge"
              :aria-label="`${lmsStore.unreadCount} notifikasi belum dibaca`"
            >
              {{ lmsStore.unreadCount }}
            </span>
          </RouterLink>
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
            class="icon-btn topbar-help-btn"
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
          :class="{ active: route.path === '/dashboard' || route.path === '/home' }"
          :aria-current="route.path === '/dashboard' || route.path === '/home' ? 'page' : undefined"
        >
          <MotionActiveIndicator axis="horizontal" keep-visible v-if="route.path === '/dashboard' || route.path === '/home'" />
          <span class="mobile-nav-icon">
            <Icon name="grid" />
          </span>
          <span class="mobile-nav-label">Home</span>
        </RouterLink>
        <RouterLink
          to="/assessments/all"
          class="mobile-bottom-link"
          :class="{ active: /assessments|builder/.test(route.path) }"
          :aria-current="/assessments|builder/.test(route.path) ? 'page' : undefined"
        >
          <MotionActiveIndicator axis="horizontal" keep-visible v-if="/assessments|builder/.test(route.path)" />
          <span class="mobile-nav-icon">
            <Icon name="briefcase" />
          </span>
          <span class="mobile-nav-label">Assessment</span>
        </RouterLink>
        <RouterLink
          to="/classes"
          class="mobile-bottom-link"
          :class="{ active: /^\/classes/.test(route.path) }"
          :aria-current="/^\/classes/.test(route.path) ? 'page' : undefined"
        >
          <MotionActiveIndicator axis="horizontal" keep-visible v-if="/^\/classes/.test(route.path)" />
          <span class="mobile-nav-icon">
            <Icon name="people" />
          </span>
          <span class="mobile-nav-label">Kelas</span>
        </RouterLink>
        <RouterLink
          to="/bank"
          class="mobile-bottom-link"
          :class="{ active: route.path === '/bank' }"
          :aria-current="route.path === '/bank' ? 'page' : undefined"
        >
          <MotionActiveIndicator axis="horizontal" keep-visible v-if="route.path === '/bank'" />
          <span class="mobile-nav-icon">
            <Icon name="book" />
          </span>
          <span class="mobile-nav-label">Bank</span>
        </RouterLink>
        <RouterLink
          to="/results"
          class="mobile-bottom-link"
          :class="{ active: /results|grade/.test(route.path) }"
          :aria-current="/results|grade/.test(route.path) ? 'page' : undefined"
        >
          <MotionActiveIndicator axis="horizontal" keep-visible v-if="/results|grade/.test(route.path)" />
          <span class="mobile-nav-icon">
            <Icon name="chart" />
          </span>
          <span class="mobile-nav-label">Hasil</span>
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
          :class="{ active: !/^\/(my-results|student\/classes|student\/notifications)/.test(route.path) }"
          :aria-current="!/^\/(my-results|student\/classes|student\/notifications)/.test(route.path) ? 'page' : undefined"
        >
          <MotionActiveIndicator axis="horizontal" keep-visible v-if="!/^\/(my-results|student\/classes|student\/notifications)/.test(route.path)" />
          <span class="mobile-nav-icon">
            <Icon name="book" />
          </span>
          <span class="mobile-nav-label">Assessment</span>
        </RouterLink>
        <RouterLink
          to="/student/classes"
          class="mobile-bottom-link"
          :class="{ active: /^\/student\/classes/.test(route.path) }"
          :aria-current="/^\/student\/classes/.test(route.path) ? 'page' : undefined"
        >
          <MotionActiveIndicator axis="horizontal" keep-visible v-if="/^\/student\/classes/.test(route.path)" />
          <span class="mobile-nav-icon">
            <Icon name="people" />
          </span>
          <span class="mobile-nav-label">Kelas</span>
        </RouterLink>
        <RouterLink
          to="/my-results"
          class="mobile-bottom-link"
          :class="{ active: route.path === '/my-results' }"
          :aria-current="route.path === '/my-results' ? 'page' : undefined"
        >
          <MotionActiveIndicator axis="horizontal" keep-visible v-if="route.path === '/my-results'" />
          <span class="mobile-nav-icon">
            <Icon name="chart" />
          </span>
          <span class="mobile-nav-label">Hasil</span>
        </RouterLink>
        <RouterLink
          to="/student/notifications"
          class="mobile-bottom-link"
          :class="{ active: /^\/student\/notifications/.test(route.path) }"
          :aria-current="/^\/student\/notifications/.test(route.path) ? 'page' : undefined"
        >
          <MotionActiveIndicator axis="horizontal" keep-visible v-if="/^\/student\/notifications/.test(route.path)" />
          <span class="mobile-nav-icon">
            <Icon name="bell" />
          </span>
          <span class="mobile-nav-label">Notif</span>
          <em
            v-if="lmsStore.unreadCount > 0"
            class="mobile-nav-badge"
            :aria-label="`${lmsStore.unreadCount} notifikasi belum dibaca`"
            >{{ lmsStore.unreadCount }}</em
          >
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
