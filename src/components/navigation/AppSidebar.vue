<script setup>
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
} from "vue";
import { useRoute } from "vue-router";
import { useUiStore } from "../../stores/uiStore.js";
import AppBrand from "../brand/AppBrand.vue";
import SidebarItem from "./SidebarItem.vue";
import Icon from "../ui/Icon.vue";
const route = useRoute(),
  ui = useUiStore(),
  panel = ref(),
  trigger = ref(),
  expanded = ref(true),
  popover = ref(false),
  mobile = ref(false);
const compact = computed(() => ui.collapsed && !mobile.value);
let media;
function resize() {
  mobile.value = media.matches;
  if (!media.matches) ui.mobileOpen = false;
  popover.value = false;
}
function close(restore = true) {
  ui.mobileOpen = false;
  popover.value = false;
  if (restore) nextTick(() => document.getElementById("menu-trigger")?.focus());
}
function keydown(e) {
  if (e.key === "Escape") {
    if (popover.value) {
      popover.value = false;
      trigger.value?.focus();
    } else if (ui.mobileOpen) close();
  }
  if (e.key === "Tab" && ui.mobileOpen) {
    const els = [...panel.value.querySelectorAll("a,button")].filter(
        (x) => x.getClientRects().length,
      ),
      first = els[0],
      last = els.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
function outside(e) {
  if (!panel.value?.contains(e.target)) popover.value = false;
}
watch(
  () => ui.mobileOpen,
  async (open) => {
    document.body.style.overflow = open ? "hidden" : "";
    if (open) {
      await nextTick();
      panel.value?.querySelector(".sidebar-close")?.focus();
    }
  },
);
watch(
  () => route.path,
  () => close(false),
);
onMounted(() => {
  media = matchMedia("(max-width: 1023px)");
  resize();
  media.addEventListener("change", resize);
  document.addEventListener("keydown", keydown);
  document.addEventListener("pointerdown", outside);
});
onBeforeUnmount(() => {
  media?.removeEventListener("change", resize);
  document.removeEventListener("keydown", keydown);
  document.removeEventListener("pointerdown", outside);
  document.body.style.overflow = "";
});
</script>
<template>
  <button
    v-if="mobile && ui.mobileOpen"
    class="drawer-overlay"
    aria-label="Tutup navigasi"
    @click="close()"
  ></button>
  <aside
    id="sidebar"
    ref="panel"
    class="sidebar"
    :class="{ 'is-compact': compact, 'is-open': ui.mobileOpen }"
    :inert="mobile && !ui.mobileOpen"
    :role="mobile && ui.mobileOpen ? 'dialog' : undefined"
    :aria-modal="mobile && ui.mobileOpen ? 'true' : undefined"
    aria-label="Navigasi utama"
  >
    <div class="brand-row">
      <AppBrand :compact="compact" /><button
        class="icon-btn sidebar-close"
        aria-label="Tutup navigasi"
        @click="close()"
      >
        <Icon name="x" />
      </button>
    </div>
    <button
      v-if="!mobile"
      class="collapse-control tip-parent"
      :aria-expanded="!ui.collapsed"
      aria-controls="sidebar-navigation"
      :aria-label="ui.collapsed ? 'Lebarkan navigasi' : 'Ciutkan navigasi'"
      @click="
        ui.toggle();
        popover = false;
      "
    >
      <Icon :name="ui.collapsed ? 'chevron' : 'back'" /><span v-if="!compact"
        >Ciutkan navigasi</span
      ><span v-else class="rail-tooltip">Lebarkan navigasi</span>
    </button>
    <nav id="sidebar-navigation" class="nav-list">
      <p v-if="!compact" class="nav-label">Workspace</p>
      <template v-if="!route.meta.student">
        <SidebarItem
          to="/dashboard"
          label="Ringkasan"
          icon="grid"
          :compact="compact"
          :active="route.path === '/dashboard'"
        />
        <div class="assessment-nav">
          <button
            ref="trigger"
            class="nav-item tip-parent"
            :class="{ active: /assessments|builder/.test(route.path) }"
            aria-label="Assessment"
            :aria-expanded="compact ? popover : expanded"
            aria-controls="assessment-submenu"
            @click="compact ? (popover = !popover) : (expanded = !expanded)"
          >
            <Icon name="briefcase" /><template v-if="!compact"
              ><span>Assessment</span
              ><Icon
                class="chevron"
                :name="expanded ? 'up' : 'down'" /></template
            ><span v-else-if="!popover" class="rail-tooltip">Assessment</span>
          </button>
          <div
            v-if="compact ? popover : expanded"
            id="assessment-submenu"
            :class="compact ? 'nav-popover' : 'nav-sub'"
          >
            <p v-if="compact" class="nav-label">Assessment</p>
            <RouterLink
              v-for="s in ['all', 'Draft', 'Aktif', 'Terjadwal', 'Ditutup']"
              :key="s"
              :to="'/assessments/' + s"
              class="nav-item"
              :class="{ active: route.params.status === s }"
              :aria-current="route.params.status === s ? 'page' : undefined"
              >{{ s === "all" ? "Semua assessment" : s }}</RouterLink
            >
          </div>
        </div>
        <SidebarItem
          to="/bank"
          label="Bank soal"
          icon="book"
          :compact="compact"
          :active="route.path === '/bank'"
        />
        <SidebarItem
          to="/results"
          label="Hasil & penilaian"
          icon="chart"
          :compact="compact"
          :active="/results|grade/.test(route.path)"
        />
      </template>
      <template v-else
        ><SidebarItem
          to="/student"
          label="Assessment saya"
          icon="book"
          :compact="compact"
          :active="route.path !== '/my-results'" /><SidebarItem
          to="/my-results"
          label="Hasil saya"
          icon="chart"
          :compact="compact"
          :active="route.path === '/my-results'"
      /></template>
    </nav>
    <div class="sidebar-bottom">
      <span v-if="!compact" class="demo-pill"
        ><span class="demo-dot"></span>Workspace lokal</span
      >
      <div class="profile">
        <span class="avatar">{{ route.meta.student ? "RA" : "AP" }}</span>
        <div v-if="!compact">
          <strong>{{
            route.meta.student ? "Rani Ayu" : "Aditya Pratama"
          }}</strong>
          <p>{{ route.meta.student ? "Peserta · Kelas A" : "Pengajar" }}</p>
        </div>
      </div>
    </div>
  </aside>
</template>
