<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount, useId } from "vue";
import Icon from "./Icon.vue";
import { useBottomSheetMotion } from "../../composables/useBottomSheetMotion.js";

const props = defineProps({
  modelValue: {
    type: String,
    default: "all",
  },
  options: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["update:modelValue", "change"]);

const listboxId = `status-listbox-${useId()}`;
const isOpen = ref(false);
const isSheet = ref(false);
const containerRef = ref(null);
const triggerRef = ref(null);
const popoverRef = ref(null);
const backdropRef = ref(null);
const { enterSheet, exitSheet } = useBottomSheetMotion(containerRef);

const selectedOption = computed(() => {
  return props.options.find((o) => o.value === props.modelValue) || {
    label: "Semua Status",
    value: "all",
  };
});

function detectSheet() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 768px)").matches;
}

function getOptionButtons() {
  return Array.from(popoverRef.value?.querySelectorAll('[role="option"]') || []);
}

function playSheetEnter() {
  if (isSheet.value && popoverRef.value) {
    enterSheet(popoverRef.value, backdropRef.value);
  }
}

async function openAndFocus(pickIndex) {
  isSheet.value = detectSheet();
  isOpen.value = true;
  await nextTick();
  playSheetEnter();
  const btns = getOptionButtons();
  if (!btns.length) return;
  const idx = typeof pickIndex === "function" ? pickIndex(btns) : pickIndex;
  btns[Math.max(0, Math.min(idx, btns.length - 1))]?.focus({ preventScroll: true });
}

async function toggleDropdown() {
  isSheet.value = detectSheet();
  if (isOpen.value) {
    closeDropdown(false);
    return;
  }
  isOpen.value = true;
  await nextTick();
  playSheetEnter();
}

function closeDropdown(restoreFocus = false) {
  if (isOpen.value && isSheet.value && popoverRef.value) {
    exitSheet(popoverRef.value);
  }
  isOpen.value = false;
  if (restoreFocus && triggerRef.value?.isConnected) {
    triggerRef.value.focus({ preventScroll: true });
  }
}

function selectOption(option) {
  emit("update:modelValue", option.value);
  emit("change", option.value);
  closeDropdown(true);
}

function handleTriggerKeyDown(e) {
  const selectedIndex = Math.max(
    0,
    props.options.findIndex((o) => o.value === props.modelValue),
  );
  if (e.key === "ArrowDown") {
    e.preventDefault();
    openAndFocus(isOpen.value ? 0 : selectedIndex);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    openAndFocus((btns) => (isOpen.value ? btns.length - 1 : selectedIndex));
  } else if (e.key === "Home" && isOpen.value) {
    e.preventDefault();
    getOptionButtons()[0]?.focus({ preventScroll: true });
  } else if (e.key === "End" && isOpen.value) {
    e.preventDefault();
    const btns = getOptionButtons();
    btns[btns.length - 1]?.focus({ preventScroll: true });
  } else if (e.key === "Escape" && isOpen.value) {
    e.preventDefault();
    e.stopPropagation();
    closeDropdown(true);
  }
}

function handleOptionKeyDown(e, index) {
  const btns = getOptionButtons();
  if (!btns.length) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    btns[(index + 1) % btns.length]?.focus({ preventScroll: true });
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    btns[(index - 1 + btns.length) % btns.length]?.focus({ preventScroll: true });
  } else if (e.key === "Home") {
    e.preventDefault();
    btns[0]?.focus({ preventScroll: true });
  } else if (e.key === "End") {
    e.preventDefault();
    btns[btns.length - 1]?.focus({ preventScroll: true });
  } else if (e.key === "Tab") {
    closeDropdown(false);
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    closeDropdown(true);
  }
}

function handlePointerDown(e) {
  const inside =
    containerRef.value?.contains(e.target) ||
    popoverRef.value?.contains(e.target) ||
    backdropRef.value?.contains(e.target);
  if (isOpen.value && !inside) {
    closeDropdown(false);
  }
}

function handleKeyDown(e) {
  if (e.key === "Escape" && isOpen.value) {
    closeDropdown(true);
  }
}

onMounted(() => {
  window.addEventListener("pointerdown", handlePointerDown);
  window.addEventListener("keydown", handleKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", handlePointerDown);
  window.removeEventListener("keydown", handleKeyDown);
});
</script>

<template>
  <div ref="containerRef" class="custom-select-container">
    <!-- Trigger Button -->
    <button
      id="status-filter"
      ref="triggerRef"
      type="button"
      class="custom-select-trigger status-dropdown-trigger"
      :class="{ 'is-open': isOpen }"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      :aria-controls="isOpen ? listboxId : undefined"
      aria-label="Filter status assessment"
      @click="toggleDropdown"
      @keydown="handleTriggerKeyDown"
    >
      <div class="trigger-content">
        <span class="trigger-label">{{ selectedOption.label }}</span>
      </div>
      <div class="trigger-actions">
        <Icon :name="isOpen ? 'up' : 'down'" class="trigger-chevron" />
      </div>
    </button>

    <Teleport to="body" :disabled="!isSheet">
      <div
        v-if="isOpen && isSheet"
        ref="backdropRef"
        class="sheet-backdrop"
        aria-hidden="true"
        @click="closeDropdown(true)"
      ></div>

      <!-- Floating Popover (Inspired by Image 1 & 2) -->
      <div
        v-if="isOpen"
        :id="listboxId"
        ref="popoverRef"
        class="custom-dropdown-popover"
        :class="{ 'is-sheet': isSheet }"
        role="listbox"
        aria-label="Daftar status assessment"
      >
        <div class="popover-header">Status Assessment</div>
        <ul class="popover-list" role="none">
          <li v-for="(opt, idx) in options" :key="opt.value" role="none">
            <button
              type="button"
              role="option"
              :aria-selected="opt.value === modelValue"
              class="custom-dropdown-item"
              :class="{ 'is-active': opt.value === modelValue }"
              @click="selectOption(opt)"
              @keydown="handleOptionKeyDown($event, idx)"
            >
              <div class="item-left">
                <span class="item-label">{{ opt.label }}</span>
              </div>
              <div class="item-right">
                <span v-if="opt.count !== undefined" class="item-badge">{{ opt.count }}</span>
                <Icon v-if="opt.value === modelValue" name="check" class="item-check" />
              </div>
            </button>
          </li>
        </ul>
      </div>
    </Teleport>
  </div>
</template>
