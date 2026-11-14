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
import { motionEngine } from "../../motion/engine.js";
import { safeTokens } from "../../motion/policy.js";
const emit = defineEmits(["logout", "help"]);
const route = useRoute(),
  ui = useUiStore(),
  authStore = useAuthStore(),
  panel = ref(),
  overlayEl = ref(),
  closing = ref(false),
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
  drawer,
  overlayAnim,
  revision = 0,
  disposed = false;
function stopDrawer() {
  drawer?.cancel();
  overlayAnim?.cancel();
  drawer = undefined;
  overlayAnim = undefined;
}
function resize() {
  mobile.value = media.matches;
  if (!media.matches) {
    ui.mobileOpen = false;
    closing.value = false;
    stopDrawer();
    if (panel.value) motionEngine.reset(panel.value);
    if (overlayEl.value) motionEngine.reset(overlayEl.value);
  }
}
function close(restore = true) {
  ui.mobileOpen = false;
  if (restore) nextTick(() => document.getElementById("menu-trigger")?.focus());
}
function keydown(e) {
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
function cancelDrawer(e) {
  if (closing.value) return;
  if (e?.target?.closest?.(".drawer-overlay, .sidebar-close, #menu-trigger")) return;
  stopDrawer();
}
let swipeStartX = 0,
  swipeStartY = 0,
  swiping = false,
  swipeOffset = 0,
  swipeCloseOffset = null;
function panelWidth() {
  return panel.value?.getBoundingClientRect().width || 288;
}
function onTouchStart(e) {
  if (!mobile.value || !ui.mobileOpen || closing.value || !e.touches?.length) return;
  const touch = e.touches[0];
  swipeStartX = touch.clientX;
  swipeStartY = touch.clientY;
  swipeOffset = 0;
  swipeCloseOffset = null;
  swiping = true;
}
function onTouchMove(e) {
  if (!swiping || !panel.value || !e.touches?.length) return;
  const touch = e.touches[0];
  const dx = touch.clientX - swipeStartX;
  const dy = touch.clientY - swipeStartY;
  if (Math.abs(dy) > Math.abs(dx) * 1.2 && Math.abs(swipeOffset) < 8) {
    swiping = false;
    swipeOffset = 0;
    panel.value.style.transform = "";
    if (overlayEl.value) overlayEl.value.style.opacity = "";
    return;
  }
  if (dx < 0) {
    const width = panelWidth();
    swipeOffset = Math.max(-width, dx);
    panel.value.style.transform = `translate3d(${swipeOffset}px, 0, 0)`;
    if (overlayEl.value) {
      overlayEl.value.style.opacity = String(Math.max(0.15, 1 + swipeOffset / width));
    }
  }
}
function onTouchEnd() {
  if (!swiping || !panel.value) return;
  swiping = false;
  const width = panelWidth();
  const dragOpacity = Math.max(0.15, 1 + swipeOffset / width);
  if (swipeOffset < -56) {
    swipeCloseOffset = swipeOffset;
    panel.value.style.transform = "";
    if (overlayEl.value) overlayEl.value.style.opacity = "";
    close(false);
  } else if (swipeOffset < 0) {
    panel.value.style.transform = "";
    if (overlayEl.value) overlayEl.value.style.opacity = "";
    const tokens = safeTokens(panel.value);
    if (tokens && tokens.mode !== "off" && !document.hidden) {
      motionEngine.animate(
        panel.value,
        { x: 0 },
        { from: { x: swipeOffset }, tokens, preset: "snappy" },
      );
      if (overlayEl.value) {
        motionEngine.animate(
          overlayEl.value,
          { opacity: 1 },
          { from: { opacity: dragOpacity }, tokens, preset: "snappy" },
        );
      }
    }
  }
  swipeOffset = 0;
}
watch(
  () => ui.mobileOpen,
  async (open) => {
    const ticket = ++revision;
    stopDrawer();
    document.body.style.overflow = open ? "hidden" : "";
    if (open) {
      closing.value = false;
      if (panel.value) motionEngine.reset(panel.value);
      if (overlayEl.value) motionEngine.reset(overlayEl.value);
      await nextTick();
      if (disposed || ticket !== revision || !ui.mobileOpen) return;
      panel.value?.querySelector(".sidebar-close")?.focus();
      const tokens = safeTokens(panel.value);
      if (tokens && tokens.mode !== "off" && !document.hidden) {
        const width = panel.value?.getBoundingClientRect().width || 288;
        drawer = motionEngine.animate(
          panel.value,
          { x: 0, opacity: 1 },
          {
            from: { x: -width, opacity: 0 },
            tokens,
            preset: "smooth",
          },
        );
        if (overlayEl.value) {
          overlayAnim = motionEngine.animate(
            overlayEl.value,
            { opacity: 1 },
            {
              from: { opacity: 0 },
              tokens,
              preset: "smooth",
            },
          );
        }
      }
    } else {
      const startX = swipeCloseOffset ?? 0;
      swipeCloseOffset = null;
      if (mobile.value && panel.value) {
        const tokens = safeTokens(panel.value);
        if (tokens && tokens.mode !== "off" && !document.hidden) {
          closing.value = true;
          const width = panelWidth();
          const startOpacity = startX < 0 ? Math.max(0.15, 1 + startX / width) : 1;
          drawer = motionEngine.animate(
            panel.value,
            { opacity: 0, x: -width },
            {
              from: { opacity: startOpacity, x: startX },
              tokens,
              preset: "smooth",
            },
          );
          if (overlayEl.value) {
            overlayAnim = motionEngine.animate(
              overlayEl.value,
              { opacity: 0 },
              {
                from: { opacity: startOpacity },
                tokens,
                preset: "smooth",
              },
            );
          }
          drawer.finished.then(() => {
            if (ticket === revision && !ui.mobileOpen) {
              closing.value = false;
              if (panel.value) motionEngine.reset(panel.value);
              if (overlayEl.value) motionEngine.reset(overlayEl.value);
            }
          });
        } else {
          closing.value = false;
          if (panel.value) motionEngine.reset(panel.value);
          if (overlayEl.value) motionEngine.reset(overlayEl.value);
        }
      } else {
        closing.value = false;
        if (panel.value) motionEngine.reset(panel.value);
      }
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
  document.addEventListener("pointerdown", cancelDrawer);
});
onBeforeUnmount(() => {
  disposed = true;
  revision++;
  stopDrawer();
  closing.value = false;
  if (panel.value) motionEngine.reset(panel.value);
  if (overlayEl.value) motionEngine.reset(overlayEl.value);
  media?.removeEventListener("change", resize);
  document.removeEventListener("keydown", keydown);
  document.removeEventListener("pointerdown", cancelDrawer);
  document.body.style.overflow = "";
});
</script>
<template>
  <button
    v-if="mobile && (ui.mobileOpen || closing)"
    ref="overlayEl"
    class="drawer-overlay"
    :class="{ 'is-closing': closing }"
    aria-label="Tutup navigasi"
    @click="close()"
  ></button>
  <aside
    id="sidebar"
    ref="panel"
    class="sidebar"
    :class="{ 'is-compact': compact, 'is-open': ui.mobileOpen || closing, 'is-closing': closing }"
    :inert="mobile && !ui.mobileOpen"
    :role="mobile && ui.mobileOpen ? 'dialog' : undefined"
    :aria-modal="mobile && ui.mobileOpen ? 'true' : undefined"
    aria-label="Navigasi utama"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend.passive="onTouchEnd"
    @touchcancel.passive="onTouchEnd"
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
          label="Home"
          icon="grid"
          :compact="compact"
          :active="route.path === '/dashboard' || route.path === '/home'"
        />
        <SidebarItem
          to="/assessments/all"
          label="Assessment"
          icon="briefcase"
          :compact="compact"
          :active="/assessments|builder/.test(route.path)"
        />
        <SidebarItem
          to="/classes"
          label="Kelas"
          icon="people"
          :compact="compact"
          :active="/^\/classes/.test(route.path)"
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
          :active="!/^\/(my-results|student\/classes|student\/notifications)/.test(route.path)" /><SidebarItem
          to="/student/classes"
          label="Kelas & Materi"
          icon="people"
          :compact="compact"
          :active="/^\/student\/classes/.test(route.path)" /><SidebarItem
          to="/my-results"
          label="Hasil saya"
          icon="chart"
          :compact="compact"
          :active="route.path === '/my-results'"
      /></template>
    </nav>
    <div class="sidebar-bottom">
      <p v-if="mobile" class="nav-label sidebar-copy">Akun & bantuan</p>
      <div class="profile">
        <span class="avatar">{{ profileInitials }}</span>
        <div v-if="!compact" class="profile-copy sidebar-copy">
          <strong>{{ profileName }}</strong>
          <p>{{ profileRole }}</p>
        </div>
      </div>
      <button
        v-if="mobile"
        type="button"
        class="btn sidebar-help-btn"
        aria-label="Panduan penggunaan"
        @click="
          close(false);
          emit('help');
        "
      >
        <Icon name="help" class="sm" />
        <span class="sidebar-btn-label sidebar-copy">Panduan penggunaan</span>
      </button>
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
