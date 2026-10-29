<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import Icon from "../ui/Icon.vue";
import { motionEngine } from "../../motion/engine.js";
import { observeMotionPolicy, safeTokens } from "../../motion/policy.js";

const route = useRoute(), router = useRouter();
const id = useId();
const root = ref(), trigger = ref(), menu = ref();
const open = ref(false), activeIndex = ref(0);
const roles = [
  { label: "Pengajar", description: "Kelola assessment dan penilaian", to: "/dashboard" },
  { label: "Peserta", description: "Kerjakan assessment dan lihat hasil", to: "/student" },
];
const selectedIndex = computed(() => route.meta.student ? 1 : 0);
let fade, stopPolicy;

function stopFade() {
  fade?.cancel();
  if (menu.value) motionEngine.reset(menu.value);
}
function close(restoreFocus = false) {
  stopFade();
  open.value = false;
  if (restoreFocus) trigger.value?.focus();
}
async function focusOption(index) {
  activeIndex.value = index;
  await nextTick();
  if (open.value) menu.value?.querySelectorAll('[role="menuitemradio"]')[activeIndex.value]?.focus();
}
async function show(index = selectedIndex.value) {
  open.value = true;
  await focusOption(index);
}
function toggle() {
  if (open.value) close(true);
  else show();
}
function choose(index) {
  close(true);
  if (index !== selectedIndex.value) router.push(roles[index].to);
}
function keydown(event) {
  const { key } = event;
  if (key === "ArrowDown" || key === "ArrowUp") {
    event.preventDefault();
    if (!open.value) show();
    else focusOption((activeIndex.value + (key === "ArrowDown" ? 1 : -1) + roles.length) % roles.length);
  } else if (open.value && (key === "Home" || key === "End")) {
    event.preventDefault();
    focusOption(key === "Home" ? 0 : roles.length - 1);
  } else if (open.value && key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    close(true);
  } else if (key === "Tab") close();
}
function outside(event) {
  if (!root.value?.contains(event.target)) close();
}
function focusout(event) {
  if (!root.value?.contains(event.relatedTarget)) close();
}
watch(() => route.fullPath, () => close());
watch(open, () => {
  stopFade();
  if (!open.value || !menu.value || document.hidden) return;
  const tokens = safeTokens(menu.value);
  if (!tokens || tokens.mode === "off") return;
  fade = motionEngine.animate(menu.value, { opacity: 1 }, {
    from: { opacity: 0 }, preset: "gentle", tokens,
  });
}, { flush: "post" });
onMounted(() => {
  document.addEventListener("pointerdown", outside);
  stopPolicy = observeMotionPolicy(root.value, stopFade);
});
onBeforeUnmount(() => {
  stopPolicy?.();
  stopFade();
  document.removeEventListener("pointerdown", outside);
});
</script>

<template>
  <div ref="root" class="role-picker" data-liquid-scope="local" @keydown="keydown" @focusout="focusout">
    <button
      :id="`${id}-trigger`"
      ref="trigger"
      class="role-picker-trigger"
      :class="{ 'is-open': open }"
      type="button"
      :aria-label="`Tampilan peran: ${roles[selectedIndex].label}`"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="open ? `${id}-menu` : undefined"
      @click="toggle"
    >
      <Icon name="user" />
      <span>{{ roles[selectedIndex].label }}</span>
      <Icon :name="open ? 'up' : 'down'" class="role-picker-chevron" />
    </button>
    <div
      v-if="open"
      :id="`${id}-menu`"
      ref="menu"
      class="role-picker-menu"
      role="menu"
      :aria-labelledby="`${id}-heading`"
    >
      <p :id="`${id}-heading`" class="role-picker-heading">Tampilan peran</p>
      <button
        v-for="(role, index) in roles"
        :key="role.to"
        class="role-picker-option"
        :class="{ 'is-selected': selectedIndex === index }"
        type="button"
        role="menuitemradio"
        :aria-label="role.label"
        :aria-describedby="`${id}-description-${index}`"
        :aria-checked="selectedIndex === index"
        :tabindex="activeIndex === index ? 0 : -1"
        @focus="activeIndex = index"
        @click="choose(index)"
      >
        <span class="role-picker-copy">
          <strong>{{ role.label }}</strong>
          <span :id="`${id}-description-${index}`">{{ role.description }}</span>
        </span>
        <Icon v-if="selectedIndex === index" name="check" class="role-picker-check" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.role-picker {
  position: relative;
  z-index: 20;
  flex-shrink: 0;
}
.role-picker-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 44px;
  padding: 9px 12px;
  border: 1px solid #dce2d5;
  border-radius: 12px;
  background: #fcfcf8;
  color: #4f5e47;
  font-size: 12px;
  font-weight: 500;
}
.role-picker-trigger:hover,
.role-picker-trigger.is-open {
  background: #eef2e9;
  border-color: #a9bba2;
}
.role-picker-trigger:focus-visible,
.role-picker-option:focus-visible {
  outline: 2px solid #719581;
  outline-offset: 3px;
}
.role-picker-chevron.icon {
  width: 14px;
  height: 14px;
}
.role-picker-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: min(224px, calc(100vw - 32px));
  max-height: calc(100dvh - 100px);
  overflow-y: auto;
  padding: 8px;
  border: 1px solid #e0e5d9;
  border-radius: 16px;
  background: #fffefa;
  box-shadow: 0 6px 16px #2633200a, 0 18px 40px #26332014;
}
.role-picker-heading {
  padding: 7px 9px 9px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.6px;
  text-transform: uppercase;
}
.role-picker-option {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 18px;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 11px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--ink);
  text-align: left;
}
.role-picker-option + .role-picker-option {
  margin-top: 4px;
}
.role-picker-option:hover {
  background: #f1f2eb;
}
.role-picker-option.is-selected {
  background: #eaf2e6;
  color: #36573d;
}
.role-picker-copy {
  display: grid;
  gap: 3px;
}
.role-picker-copy strong {
  font-size: 12px;
  font-weight: 600;
}
.role-picker-copy > span {
  color: #68745f;
  font-size: 11px;
  line-height: 1.5;
}
.role-picker-check.icon {
  width: 17px;
  height: 17px;
  stroke-width: 2;
}
@media (max-width: 480px) {
  .role-picker-trigger {
    gap: 6px;
    padding-inline: 8px;
  }
}
</style>
