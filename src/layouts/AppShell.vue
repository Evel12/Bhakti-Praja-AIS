<script setup>
import MotionField from "../components/motion/MotionField.vue";
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import { createNavigationLayout } from "../motion/navigation.js";
import { useRoute, useRouter } from "vue-router";
import { useUiStore } from "../stores/uiStore.js";
import AppSidebar from "../components/navigation/AppSidebar.vue";
import Icon from "../components/ui/Icon.vue";
import AppDialog from "../components/ui/AppDialog.vue";
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
  async () => {
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
          <label class="role-switch"
            ><Icon name="user" /><MotionField
              ><select
                aria-label="Tampilan peran"
                :value="route.meta.student ? 'student' : 'teacher'"
                @change="
                  router.push(
                    $event.target.value === 'student'
                      ? '/student'
                      : '/dashboard',
                  )
                "
              >
                <option value="teacher">Pengajar</option>
                <option value="student">Peserta</option>
              </select></MotionField
            ></label
          ><button
            class="icon-btn"
            aria-label="Panduan penggunaan"
            @click="help = true"
          >
            <Icon name="help" />
          </button>
        </div>
      </header>
      <slot />
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
