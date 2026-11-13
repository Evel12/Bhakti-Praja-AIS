<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount, useId } from "vue";
import Icon from "./Icon.vue";
import { animateSheet } from "../../motion/presence.js";

const props = defineProps({
  modelValue: {
    type: Object,
    default: null,
  },
  options: {
    type: Array,
    default: () => [],
  },
  placeholder: {
    type: String,
    default: "Pilih Kelas",
  },
});

const emit = defineEmits(["update:modelValue", "change"]);

const treeId = `cascade-tree-${useId()}`;
const isOpen = ref(false);
const isSheet = ref(false);
const activeCourse = ref(null);
const containerRef = ref(null);
const triggerRef = ref(null);
const popoverRef = ref(null);

function detectSheet() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 768px)").matches;
}

const displayLabel = computed(() => {
  if (!props.modelValue || props.modelValue.code === "all") {
    return props.modelValue?.code === "all" ? "Semua Kelas" : "";
  }
  if (props.modelValue.className === "all") {
    return `${props.modelValue.course} (Semua)`;
  }
  if (props.modelValue.course && props.modelValue.className) {
    return `${props.modelValue.course} · ${props.modelValue.className}`;
  }
  return props.modelValue.name || "";
});

function getTopButtons() {
  return Array.from(popoverRef.value?.querySelectorAll('[data-cascade-level="top"]') || []);
}

async function openAndFocus(atEnd = false) {
  isSheet.value = detectSheet();
  isOpen.value = true;
  if (props.modelValue?.course && props.modelValue.course !== "all") {
    activeCourse.value = props.modelValue.course;
  }
  await nextTick();
  if (isSheet.value && popoverRef.value) {
    animateSheet(popoverRef.value, { direction: "enter", preset: "smooth" });
  }
  const btns = getTopButtons();
  if (!btns.length) return;
  const target = atEnd ? btns[btns.length - 1] : btns[0];
  target?.focus({ preventScroll: true });
}

async function toggleDropdown() {
  isSheet.value = detectSheet();
  isOpen.value = !isOpen.value;
  if (!isOpen.value) {
    activeCourse.value = null;
  } else {
    if (props.modelValue?.course && props.modelValue.course !== "all") {
      activeCourse.value = props.modelValue.course;
    }
    await nextTick();
    if (isSheet.value && popoverRef.value) {
      animateSheet(popoverRef.value, { direction: "enter", preset: "smooth" });
    }
  }
}

function closeDropdown(restoreFocus = false) {
  isOpen.value = false;
  activeCourse.value = null;
  if (restoreFocus && triggerRef.value?.isConnected) {
    triggerRef.value.focus({ preventScroll: true });
  }
}

function selectLeaf(option) {
  emit("update:modelValue", option);
  emit("change", option);
  closeDropdown(true);
}

function clearSelection(e) {
  e?.stopPropagation();
  emit("update:modelValue", null);
  emit("change", null);
  closeDropdown(true);
}

function setActiveCourse(courseName) {
  activeCourse.value = courseName;
}

function handleParentMouseEnter(courseName) {
  if (!isSheet.value) setActiveCourse(courseName);
}

function handleParentClick(courseName) {
  if (isSheet.value && activeCourse.value === courseName) {
    activeCourse.value = null;
  } else {
    activeCourse.value = courseName;
  }
}

function handleTriggerKeyDown(e) {
  if (e.key === "ArrowDown" || e.key === "Home") {
    e.preventDefault();
    openAndFocus(false);
  } else if (e.key === "ArrowUp" || e.key === "End") {
    e.preventDefault();
    openAndFocus(true);
  } else if (e.key === "Escape" && isOpen.value) {
    e.preventDefault();
    e.stopPropagation();
    closeDropdown(true);
  }
}

async function handleTopItemKeyDown(e, courseName = null) {
  const btns = getTopButtons();
  const idx = btns.indexOf(e.currentTarget);
  if (idx < 0) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    btns[(idx + 1) % btns.length]?.focus({ preventScroll: true });
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    btns[(idx - 1 + btns.length) % btns.length]?.focus({ preventScroll: true });
  } else if (e.key === "Home") {
    e.preventDefault();
    btns[0]?.focus({ preventScroll: true });
  } else if (e.key === "End") {
    e.preventDefault();
    btns[btns.length - 1]?.focus({ preventScroll: true });
  } else if (e.key === "ArrowRight" && courseName) {
    e.preventDefault();
    const parentItem = e.currentTarget?.closest?.(".cascade-parent-item");
    activeCourse.value = courseName;
    await nextTick();
    const flyout = parentItem?.querySelector(".cascade-sub-flyout");
    flyout?.querySelector('[role="treeitem"]')?.focus({ preventScroll: true });
  } else if (e.key === "ArrowLeft" && courseName && activeCourse.value === courseName) {
    e.preventDefault();
    activeCourse.value = null;
  } else if (e.key === "Tab") {
    closeDropdown(false);
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    closeDropdown(true);
  }
}

async function handleSubItemKeyDown(e, courseName) {
  const flyout = e.currentTarget.closest(".cascade-sub-flyout");
  const subBtns = Array.from(flyout?.querySelectorAll('[role="treeitem"]') || []);
  const idx = subBtns.indexOf(e.currentTarget);
  if (idx < 0) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    subBtns[(idx + 1) % subBtns.length]?.focus({ preventScroll: true });
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    subBtns[(idx - 1 + subBtns.length) % subBtns.length]?.focus({ preventScroll: true });
  } else if (e.key === "Home") {
    e.preventDefault();
    subBtns[0]?.focus({ preventScroll: true });
  } else if (e.key === "End") {
    e.preventDefault();
    subBtns[subBtns.length - 1]?.focus({ preventScroll: true });
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    const parentBtn = flyout?.closest(".cascade-parent-item")?.querySelector('[data-cascade-level="top"]');
    if (!isSheet.value) activeCourse.value = null;
    else if (activeCourse.value === courseName) activeCourse.value = null;
    await nextTick();
    parentBtn?.focus({ preventScroll: true });
  } else if (e.key === "Tab") {
    closeDropdown(false);
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    closeDropdown(true);
  }
}

function handlePointerDown(e) {
  if (containerRef.value && !containerRef.value.contains(e.target)) {
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
    <!-- Trigger Button (clear button kept as sibling so no nested interactive <button>) -->
    <div class="cascade-trigger-wrap">
      <button
        id="class-cascade"
        ref="triggerRef"
        type="button"
        class="custom-select-trigger cascade-dropdown-trigger"
        :class="{ 'is-open': isOpen, 'has-clear': modelValue && modelValue.code !== 'all' }"
        aria-haspopup="tree"
        :aria-expanded="isOpen"
        :aria-controls="isOpen ? treeId : undefined"
        aria-label="Sortir berbasis kelas"
        @click="toggleDropdown"
        @keydown="handleTriggerKeyDown"
      >
        <div class="trigger-content">
          <Icon name="briefcase" class="trigger-chevron" />
          <span v-if="displayLabel" class="trigger-label">{{ displayLabel }}</span>
          <span v-else class="trigger-placeholder">{{ placeholder }}</span>
        </div>
        <div class="trigger-actions">
          <Icon :name="isOpen ? 'up' : 'down'" class="trigger-chevron" />
        </div>
      </button>
      <button
        v-if="modelValue && modelValue.code !== 'all'"
        type="button"
        class="trigger-clear-btn"
        title="Hapus pilihan kelas"
        aria-label="Hapus pilihan kelas"
        @click="clearSelection"
      >
        <Icon name="x" />
      </button>
    </div>

    <div
      v-if="isOpen && isSheet"
      class="sheet-backdrop"
      aria-hidden="true"
      @click="closeDropdown(true)"
    ></div>

    <!-- Floating Popover (Inspired by Image 2 - Model Picker Cascading Menu) -->
    <div
      v-if="isOpen"
      :id="treeId"
      ref="popoverRef"
      class="custom-dropdown-popover"
      :class="{ 'is-sheet': isSheet }"
      role="tree"
      aria-label="Pilihan kelas dan mata pelajaran"
    >
      <!-- Option: Semua Kelas -->
      <ul class="popover-list" role="none">
        <li role="none">
          <button
            type="button"
            role="treeitem"
            data-cascade-level="top"
            :aria-selected="!modelValue || modelValue.code === 'all'"
            class="custom-dropdown-item"
            :class="{ 'is-active': !modelValue || modelValue.code === 'all' }"
            @click="selectLeaf({ name: 'Semua Kelas', code: 'all', course: 'all', className: 'all' })"
            @keydown="handleTopItemKeyDown($event)"
          >
            <div class="item-left">
              <span class="item-label">Semua Kelas</span>
            </div>
            <div class="item-right">
              <Icon v-if="!modelValue || modelValue.code === 'all'" name="check" class="item-check" />
            </div>
          </button>
        </li>
      </ul>

      <div class="popover-divider"></div>
      <div class="popover-header">Mata Pelajaran / Kelas</div>

      <!-- Level 1 Items (Courses / Nama Kelas) with Cascading Submenus without book logo -->
      <ul class="popover-list" role="none">
        <template v-for="item in options" :key="item.code">
          <li
            v-if="item.classes && item.classes.length"
            class="cascade-parent-item"
            role="none"
            @mouseenter="handleParentMouseEnter(item.name)"
          >
            <button
              type="button"
              role="treeitem"
              data-cascade-level="top"
              class="custom-dropdown-item"
              :aria-expanded="activeCourse === item.name"
              :aria-selected="modelValue?.course === item.name"
              :class="{
                'has-sub-open': activeCourse === item.name,
                'is-active': modelValue?.course === item.name,
              }"
              @click="handleParentClick(item.name)"
              @keydown="handleTopItemKeyDown($event, item.name)"
            >
              <div class="item-left">
                <span class="item-label">{{ item.name }}</span>
              </div>
              <div class="item-right">
                <Icon :name="isSheet && activeCourse === item.name ? 'down' : 'chevron'" class="item-chevron-right" />
              </div>
            </button>

            <!-- Level 2 Cascading Flyout Submenu (Inspired by Image 2) -->
            <div
              v-if="activeCourse === item.name"
              class="cascade-sub-flyout"
              role="group"
              :aria-label="'Sub-kelas untuk ' + item.name"
            >
              <div class="popover-header">{{ item.name }}</div>
              <ul class="popover-list" role="none">
                <li v-for="sub in item.classes" :key="sub.code" role="none">
                  <button
                    type="button"
                    role="treeitem"
                    :aria-selected="modelValue?.code === sub.code"
                    class="custom-dropdown-item"
                    :class="{ 'is-active': modelValue?.code === sub.code }"
                    @click.stop="selectLeaf(sub)"
                    @keydown="handleSubItemKeyDown($event, item.name)"
                  >
                    <div class="item-left">
                      <span class="item-label">{{ sub.name }}</span>
                    </div>
                    <div class="item-right">
                      <Icon v-if="modelValue?.code === sub.code" name="check" class="item-check" />
                    </div>
                  </button>
                </li>
              </ul>
            </div>
          </li>
        </template>
      </ul>
    </div>
  </div>
</template>
