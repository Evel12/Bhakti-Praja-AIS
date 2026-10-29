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
import { assessmentFilters } from "../../utils/assessmentNavigation.js";
import { createOverlayMotion } from "../../motion/overlays.js";
import { createNavigationLayout } from "../../motion/navigation.js";
import { motionEngine } from "../../motion/engine.js";
import { safeTokens } from "../../motion/policy.js";
import MotionActiveIndicator from "../motion/MotionActiveIndicator.vue";
const route = useRoute(),
  ui = useUiStore(),
  panel = ref(),
  trigger = ref(),
  expanded = ref(true),
  popover = ref(false),
  mobile = ref(false);
const compact = computed(() => ui.collapsed && !mobile.value);
let media,
  overlay,
  layout,
  drawer,
  revision = 0,
  disposed = false;
const submenu = ref();
watch(
  () => (compact.value ? popover.value : expanded.value),
  async (open) => {
    const ticket = ++revision;
    const links = [
      ...(panel.value?.querySelectorAll(":scope > nav > .nav-item") || []),
    ];
    layout?.capture(links);
    if (!open && submenu.value) {
      if (submenu.value.contains(document.activeElement))
        trigger.value?.focus();
      overlay?.exit(submenu.value);
    }
    await nextTick();
    if (disposed || ticket !== revision) return;
    layout?.play(links);
    if (open && submenu.value) overlay?.enter(submenu.value);
  },
);
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
  drawer?.cancel();
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
  drawer?.cancel();
  if (!panel.value?.contains(e.target)) popover.value = false;
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
  layout = createNavigationLayout(panel.value);
  media = matchMedia("(max-width: 1023px)");
  resize();
  media.addEventListener("change", resize);
  document.addEventListener("keydown", keydown);
  document.addEventListener("pointerdown", outside);
});
onBeforeUnmount(() => {
  disposed = true;
  revision++;
  drawer?.cancel();
  overlay?.dispose();
  layout?.dispose();
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
      <Icon :name="ui.collapsed ? 'arrow' : 'back'" />
      <span class="rail-tooltip" role="tooltip">{{
        ui.collapsed ? "Lebarkan navigasi" : "Ciutkan navigasi"
      }}</span>
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
            <MotionActiveIndicator
              v-if="/assessments|builder/.test(route.path)"
            /><Icon name="briefcase" /><template v-if="!compact"
              ><span>Assessment</span
              ><Icon
                class="chevron"
                :name="expanded ? 'up' : 'down'" /></template
            ><span v-else-if="!popover" class="rail-tooltip">Assessment</span>
          </button>
          <div
            ref="submenu"
            v-if="compact ? popover : expanded"
            id="assessment-submenu"
            :class="compact ? 'nav-popover' : 'nav-sub'"
          >
            <p v-if="compact" class="nav-label">Assessment</p>
            <RouterLink
              v-for="s in assessmentFilters"
              :key="s"
              :to="'/assessments/' + s"
              class="nav-item"
              :class="{ active: route.params.status === s }"
              :aria-current="route.params.status === s ? 'page' : undefined"
              ><MotionActiveIndicator v-if="route.params.status === s" />{{
                s === "all" ? "Semua assessment" : s
              }}</RouterLink
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
