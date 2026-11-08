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
import { useAuthStore } from "../../stores/authStore.js";
import AppBrand from "../brand/AppBrand.vue";
import SidebarItem from "./SidebarItem.vue";
import Icon from "../ui/Icon.vue";
import { createOverlayMotion } from "../../motion/overlays.js";
import { motionEngine } from "../../motion/engine.js";
import { safeTokens } from "../../motion/policy.js";
const emit = defineEmits(["logout"]);
const route = useRoute(),
  ui = useUiStore(),
  authStore = useAuthStore(),
  panel = ref(),
  mobile = ref(false);
const compact = computed(() => ui.collapsed && !mobile.value);
const profileName = computed(() => {
  if (authStore.isAuthenticated && authStore.user?.name) {
    return authStore.user.name;
  }
  return route.meta.student ? "Rani Ayu" : "Aditya Pratama";
});
const profileInitials = computed(() => {
  const parts = String(profileName.value || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (parts[0]?.slice(0, 2) || "EX").toUpperCase();
});
const profileRole = computed(() => {
  if (authStore.isAuthenticated && authStore.user?.email) {
    const roleLabel = authStore.user.role === "student" ? "Peserta" : "Pengajar";
    return `${roleLabel} · ${authStore.user.email}`;
  }
  return route.meta.student ? "Peserta · Kelas A" : "Pengajar";
});
let media,
  overlay,
  drawer,
  revision = 0,
  disposed = false;
function resize() {
  mobile.value = media.matches;
  if (!media.matches) ui.mobileOpen = false;
}
function close(restore = true) {
  ui.mobileOpen = false;
  if (restore) nextTick(() => document.getElementById("menu-trigger")?.focus());
}
function keydown(e) {
  drawer?.cancel();
  if (e.key === "Escape") {
    if (ui.mobileOpen) close();
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
function cancelDrawer() {
  drawer?.cancel();
}
watch(
  () => ui.mobileOpen,
  async (open) => {
    const ticket = ++revision;
    drawer?.cancel();
    motionEngine.reset(panel.value);
    if (!open && mobile.value) overlay?.exit(panel.value);
    document.body.style.overflow = open ? "hidden" : "";
    if (open) {
      await nextTick();
      if (disposed || ticket !== revision || !ui.mobileOpen) return;
      panel.value?.querySelector(".sidebar-close")?.focus();
      const tokens = safeTokens(panel.value);
      if (tokens && !document.hidden)
        drawer = motionEngine.animate(
          panel.value,
          { x: 0, opacity: 1 },
          {
            from: { x: -panel.value.getBoundingClientRect().width, opacity: 0 },
            tokens,
            preset: "smooth",
          },
        );
    }
  },
);
watch(
  () => route.path,
  () => close(false),
);
onMounted(() => {
  overlay = createOverlayMotion(panel.value);
  media = matchMedia("(max-width: 1023px)");
  resize();
  media.addEventListener("change", resize);
  document.addEventListener("keydown", keydown);
  document.addEventListener("pointerdown", cancelDrawer);
});
onBeforeUnmount(() => {
  disposed = true;
  revision++;
  drawer?.cancel();
  overlay?.dispose();
  media?.removeEventListener("change", resize);
  document.removeEventListener("keydown", keydown);
  document.removeEventListener("pointerdown", cancelDrawer);
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
      <AppBrand :compact="compact" />
      <button
        v-if="mobile"
        type="button"
        class="icon-btn sidebar-close"
        aria-label="Tutup navigasi"
        @click="close()"
      >
        <Icon name="x" />
      </button>
      <button
        v-if="!mobile"
        type="button"
        class="collapse-control tip-parent"
        :aria-expanded="!ui.collapsed"
        aria-controls="sidebar-navigation"
        :aria-label="ui.collapsed ? 'Lebarkan navigasi' : 'Tutup navigasi'"
        @click="ui.toggle()"
      >
        <Icon :name="ui.collapsed ? 'panelOpen' : 'panelClose'" />
        <span v-if="compact" class="rail-tooltip" role="tooltip"
          >Lebarkan navigasi</span
        >
      </button>
    </div>
    <nav id="sidebar-navigation" class="nav-list">
      <p v-if="!compact" class="nav-label sidebar-copy">Workspace</p>
      <template v-if="!route.meta.student">
        <SidebarItem
          to="/dashboard"
          label="Ringkasan"
          icon="grid"
          :compact="compact"
          :active="route.path === '/dashboard'"
        />
        <SidebarItem
          to="/assessments/all"
          label="Assessment"
          icon="briefcase"
          :compact="compact"
          :active="/assessments|builder/.test(route.path)"
        />
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
      <div class="profile">
        <span class="avatar">{{ profileInitials }}</span>
        <div v-if="!compact" class="profile-copy sidebar-copy">
          <strong>{{ profileName }}</strong>
          <p>{{ profileRole }}</p>
        </div>
      </div>
      <button
        v-if="authStore.isAuthenticated"
        type="button"
        class="btn sidebar-logout-btn tip-parent"
        aria-label="Keluar dari akun"
        @click="
          close(false);
          emit('logout');
        "
      >
        <Icon name="logout" class="sm" />
        <span v-if="!compact" class="sidebar-btn-label sidebar-copy"
          >Keluar dari akun</span
        >
        <span v-if="compact" class="rail-tooltip" role="tooltip"
          >Keluar dari akun</span
        >
      </button>
    </div>
  </aside>
</template>
