<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref, useId, watch } from "vue";
import Icon from "./Icon.vue";

const props = defineProps({
  label: { type: String, required: true },
  modelValue: { type: String, default: "" },
  options: { type: Array, required: true },
  disabled: Boolean,
});
const emit = defineEmits(["update:modelValue"]);
const id = `soft-field-${useId()}`;
const root = ref(), trigger = ref(), popup = ref();
const open = ref(false), activeIndex = ref(-1), position = ref({});
const selected = computed(() => props.options.find(option => option.value === props.modelValue));
const optionId = index => `${id}-option-${index}`;
let search = "", searchedAt = 0;

function close(restoreFocus = false) {
  open.value = false;
  search = "";
  if (restoreFocus && trigger.value?.isConnected) trigger.value.focus({ preventScroll: true });
}
function place() {
  if (!trigger.value) return;
  const rect = trigger.value.getBoundingClientRect();
  const gap = 8, margin = 12;
  const desired = Math.min(320, props.options.length * 44 + 12);
  const below = window.innerHeight - rect.bottom - gap - margin;
  const above = rect.top - gap - margin;
  const up = below < desired && above > below;
  const width = Math.min(rect.width, Math.max(0, window.innerWidth - margin * 2));
  position.value = {
    width: `${width}px`,
    left: `${Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin))}px`,
    maxHeight: `${Math.max(44, Math.min(320, up ? above : below))}px`,
    ...(up ? { bottom: `${window.innerHeight - rect.top + gap}px` } : { top: `${rect.bottom + gap}px` }),
  };
}
async function show(index) {
  if (props.disabled || !props.options.some(option => !option.disabled)) return;
  document.dispatchEvent(new CustomEvent("examnia:soft-field-open", { detail: id }));
  const selectedIndex = props.options.findIndex(option => option.value === props.modelValue && !option.disabled);
  activeIndex.value = index ?? (selectedIndex >= 0 ? selectedIndex : props.options.findIndex(option => !option.disabled));
  place();
  open.value = true;
  await nextTick();
  revealActive();
}
function revealActive() {
  if (open.value) document.getElementById(optionId(activeIndex.value))?.scrollIntoView?.({ block: "nearest" });
}
function activate(index) {
  activeIndex.value = index;
  nextTick(revealActive);
}
function choose(index) {
  const option = props.options[index];
  if (!option || option.disabled) return;
  close(true);
  if (option.value !== props.modelValue) emit("update:modelValue", option.value);
}
function keydown(event) {
  if (props.disabled) return;
  const enabled = props.options.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0);
  if (event.key === "Tab") { close(); return; }
  if (event.key === "Escape" && open.value) {
    event.preventDefault(); event.stopPropagation(); close(true); return;
  }
  if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    if (!enabled.length) return;
    const index = event.key === "Home" ? enabled[0] : event.key === "End" ? enabled.at(-1) : undefined;
    if (!open.value) show(index);
    else if (index !== undefined) activate(index);
    else {
      const current = enabled.indexOf(activeIndex.value), step = event.key === "ArrowDown" ? 1 : -1;
      activate(enabled[(current + step + enabled.length) % enabled.length]);
    }
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    if (open.value) choose(activeIndex.value); else show();
    return;
  }
  if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    const now = Date.now();
    search = now - searchedAt > 700 ? event.key : search + event.key;
    searchedAt = now;
    const text = [...search].every(char => char === search[0]) ? search[0] : search;
    const start = open.value ? activeIndex.value : props.options.indexOf(selected.value);
    const order = [...enabled.filter(index => index > start), ...enabled.filter(index => index <= start)];
    const match = order.find(index => props.options[index].label.toLocaleLowerCase("id").startsWith(text.toLocaleLowerCase("id")));
    if (match !== undefined) { if (open.value) activate(match); else show(match); }
  }
}
const contains = target => root.value?.contains(target) || popup.value?.contains(target);
function outside(event) { if (open.value && !contains(event.target)) close(); }
function scroll(event) { if (open.value && !popup.value?.contains(event.target)) close(); }
function otherOpened(event) { if (event.detail !== id) close(); }
function dismiss() { close(); }
watch(() => props.modelValue, () => close());
watch(() => props.disabled, value => { if (value) close(); });
watch(() => props.options, () => {
  if (open.value) {
    if (!props.options.some(option => !option.disabled)) close();
    else { activeIndex.value = props.options.findIndex(option => option.value === props.modelValue && !option.disabled); if (activeIndex.value < 0) activeIndex.value = props.options.findIndex(option => !option.disabled); nextTick(() => { if (open.value) { place(); revealActive(); } }); }
  }
});
onMounted(() => {
  document.addEventListener("pointerdown", outside, true);
  document.addEventListener("focusin", outside);
  document.addEventListener("examnia:soft-field-open", otherOpened);
  window.addEventListener("resize", dismiss);
  window.addEventListener("scroll", scroll, true);
  window.addEventListener("blur", dismiss);
});
onBeforeUnmount(() => {
  open.value = false;
  document.removeEventListener("pointerdown", outside, true);
  document.removeEventListener("focusin", outside);
  document.removeEventListener("examnia:soft-field-open", otherOpened);
  window.removeEventListener("resize", dismiss);
  window.removeEventListener("scroll", scroll, true);
  window.removeEventListener("blur", dismiss);
});
</script>
<template>
  <div ref="root" class="soft-field" data-liquid-scope="local">
    <label :id="`${id}-label`" :for="`${id}-trigger`" class="field-label">{{ label }}</label>
    <button
      :id="`${id}-trigger`" ref="trigger" type="button" class="soft-field-trigger"
      role="combobox" aria-haspopup="listbox" :aria-expanded="open"
      :aria-controls="open ? `${id}-list` : undefined" :aria-labelledby="`${id}-label ${id}-value`"
      :aria-activedescendant="open && activeIndex >= 0 ? optionId(activeIndex) : undefined"
      :disabled="disabled || !options.some(option => !option.disabled)"
      @click="open ? close() : show()" @keydown="keydown"
    >
      <span :id="`${id}-value`" class="soft-field-value">{{ selected?.label ?? (modelValue || 'Pilih opsi') }}</span>
      <Icon name="down" />
    </button>
    <Teleport to="body">
      <div v-if="open" :id="`${id}-list`" ref="popup" class="soft-field-popup" :style="position"
        role="listbox" :aria-labelledby="`${id}-label`" data-liquid-scope="local">
        <div v-for="(option, index) in options" :id="optionId(index)" :key="option.value"
          role="option" class="soft-field-option" :class="{ 'is-active': index === activeIndex }"
          :aria-selected="option.value === modelValue" :aria-disabled="option.disabled || undefined"
          :data-value="option.value" @pointerdown.prevent @pointermove="!option.disabled && (activeIndex = index)"
          @click="choose(index)">
          <span>{{ option.label }}</span><Icon v-if="option.value === modelValue" name="check" />
        </div>
      </div>
    </Teleport>
  </div>
</template>
