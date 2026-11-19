<script setup>
import MotionField from "../../components/motion/MotionField.vue";
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAssessmentStore } from "../../stores/assessmentStore.js";
import { useLmsStore } from "../../stores/lmsStore.js";
import { useAuthStore } from "../../stores/authStore.js";
import { statusOf } from "../../domain/assessment.js";
import {
  buildClassFilterHierarchy,
  findMatchingLmsClass,
  matchesSelectedClass,
  parseLmsClassName,
} from "../../domain/classSync.js";
import {
  ASSESSMENT_SORT_OPTIONS,
  formatSortValue,
  nextColumnSort,
  sortAssessments,
} from "../../domain/assessmentSort.js";
import PageTitle from "../../components/ui/PageTitle.vue";
import AssessmentTable from "../../components/assessment/AssessmentTable.vue";
import Icon from "../../components/ui/Icon.vue";
import { motionEngine } from "../../motion/engine.js";
import { safeTokens, observeMotionPolicy } from "../../motion/policy.js";
import StatusFilterDropdown from "../../components/ui/StatusFilterDropdown.vue";
import ClassCascadeSelect from "../../components/ui/ClassCascadeSelect.vue";

const store = useAssessmentStore(),
  lms = useLmsStore(),
  auth = useAuthStore(),
  route = useRoute(),
  router = useRouter(),
  search = ref(""),
  selectedClass = ref(null),
  sortKey = ref("default"),
  sortDir = ref("asc");

const filter = computed(() => route.params.status || "all");

const selectedStatus = computed({
  get: () => route.params.status || "all",
  set: (val) => {
    if (val === "all") {
      router.push("/assessments/all");
    } else {
      router.push("/assessments/" + val);
    }
  },
});

const statusOptions = computed(() => {
  const baseAssessments = store.db.assessments.filter((a) => {
    if (a.state === "archived") return false;
    return matchesSelectedClass(a, selectedClass.value);
  });

  const counts = {
    all: baseAssessments.length,
    Draft: baseAssessments.filter((a) => statusOf(a) === "Draft").length,
    Aktif: baseAssessments.filter((a) => statusOf(a) === "Aktif").length,
    Terjadwal: baseAssessments.filter((a) => statusOf(a) === "Terjadwal").length,
    Ditutup: baseAssessments.filter((a) => statusOf(a) === "Ditutup").length,
  };

  return [
    { label: "Semua Status", value: "all", count: counts.all },
    { label: "Draft", value: "Draft", count: counts.Draft },
    { label: "Aktif", value: "Aktif", count: counts.Aktif },
    { label: "Terjadwal", value: "Terjadwal", count: counts.Terjadwal },
    { label: "Ditutup", value: "Ditutup", count: counts.Ditutup },
  ];
});

const classHierarchy = computed(() =>
  buildClassFilterHierarchy({
    assessments: store.db.assessments,
    lmsClasses: lms.classes,
  }),
);

const activeSortLabel = computed(() => {
  if (sortKey.value === "default") return "";
  const current = formatSortValue(sortKey.value, sortDir.value);
  return ASSESSMENT_SORT_OPTIONS.find((opt) => opt.value === current)?.label || "";
});

function handleColumnSort(colKey) {
  const next = nextColumnSort(sortKey.value, sortDir.value, colKey);
  sortKey.value = next.key;
  sortDir.value = next.dir;
}

function clearSort() {
  sortKey.value = "default";
  sortDir.value = "asc";
}

function formatSelectedClass(val) {
  if (!val || val.code === "all") return "Semua Kelas";
  if (val.className === "all") return `${val.course} (Semua)`;
  if (val.course && val.className) return `${val.course} · ${val.className}`;
  return val.name || "Pilih Kelas";
}

function getStatusLabel(val) {
  const opt = statusOptions.value.find((o) => o.value === val);
  return opt ? opt.label : val === "all" ? "Semua Status" : val;
}

const hasActiveFilters = computed(() => {
  return (
    filter.value !== "all" ||
    (selectedClass.value && selectedClass.value.code !== "all") ||
    sortKey.value !== "default" ||
    Boolean(search.value.trim())
  );
});

function resetFilters() {
  search.value = "";
  selectedClass.value = null;
  clearSort();
  if (filter.value !== "all") {
    selectedStatus.value = "all";
  }
}

const results = ref();
let fade, stopPolicy;
function stopFade() {
  fade?.cancel();
  if (results.value) motionEngine.reset(results.value);
}
onMounted(() => {
  stopPolicy = observeMotionPolicy(results.value, stopFade);
  if (auth.apiConnected) {
    lms.loadClasses({ selectFirst: false }).catch(() => {});
    store.syncFromApi().catch(() => {});
  }
});
onBeforeUnmount(() => {
  stopPolicy?.();
  stopFade();
});

watch(filter, (nextFilter) => {
  if (nextFilter !== "all" && sortKey.value === "status") {
    clearSort();
  }
});

watch([filter, selectedClass, sortKey, sortDir], () => {
  stopFade();
  const tokens = safeTokens(results.value);
  if (!tokens || tokens.mode === "off" || document.hidden) return;
  // Fade the updated results only; keep the panel, filters and page stationary.
  fade = motionEngine.animate(results.value, { opacity: 1 }, {
    from: { opacity: 0 },
    preset: "gentle",
    tokens,
  });
}, { flush: "post" });

const filteredItems = computed(() =>
  store.db.assessments.filter((a) => {
    if (a.state === "archived") return false;

    // Filter status assessment
    if (filter.value !== "all" && statusOf(a) !== filter.value) {
      return false;
    }

    // Filter CascadeSelect kelas
    if (!matchesSelectedClass(a, selectedClass.value)) {
      return false;
    }

    // Pencarian
    if (search.value.trim()) {
      const q = search.value.trim().toLowerCase();
      const match = `${a.title} ${a.course} ${a.className}`
        .toLowerCase()
        .includes(q);
      if (!match) return false;
    }

    return true;
  }),
);

const items = computed(() =>
  sortAssessments(filteredItems.value, store.db.attempts, {
    key: sortKey.value,
    dir: sortDir.value,
  }),
);

function create() {
  const defaults = {};
  if (selectedClass.value && selectedClass.value.code !== "all") {
    if (selectedClass.value.course && selectedClass.value.course !== "all") {
      defaults.course = selectedClass.value.course;
    }
    if (selectedClass.value.className && selectedClass.value.className !== "all") {
      defaults.className = selectedClass.value.className;
    }
    if (selectedClass.value.classId != null) {
      defaults.backendClassId = selectedClass.value.classId;
    } else {
      const matched = findMatchingLmsClass(lms.classes, defaults);
      if (matched) defaults.backendClassId = matched.id;
    }
  } else if (lms.currentClass) {
    const parsed = parseLmsClassName(lms.currentClass.name);
    defaults.course = parsed.course;
    defaults.className = parsed.className;
    defaults.backendClassId = lms.currentClass.id;
  }
  const id = store.run(() => store.create(undefined, defaults));
  if (id) router.push("/builder/" + id);
}
</script>
<template>
  <PageTitle title="Assessment">
    <button class="btn primary" @click="create">
      <Icon name="plus" />Buat assessment
    </button>
  </PageTitle>
  <section class="panel">
    <!-- Toolbar Navigasi, Filter & Sortir -->
    <div class="assessment-toolbar" role="toolbar" aria-label="Filter dan pencarian assessment">
      <div class="toolbar-filters">
        <!-- Dropdown Status Assessment -->
        <StatusFilterDropdown
          v-model="selectedStatus"
          :options="statusOptions"
        />

        <!-- Cascading Select Kelas (Alur: Nama Kelas -> Kelas A, B, C, dst) -->
        <ClassCascadeSelect
          v-model="selectedClass"
          :options="classHierarchy"
          placeholder="Pilih Kelas"
        />

        <!-- Tombol Reset Filter Cepat -->
        <button
          v-if="hasActiveFilters"
          type="button"
          class="btn-reset-filters"
          title="Reset semua filter"
          @click="resetFilters"
        >
          <Icon name="x" class="reset-icon" />
          <span>Reset Filter</span>
        </button>
      </div>

      <!-- Search Input -->
      <label class="toolbar-search">
        <Icon name="search" />
        <MotionField>
          <input
            v-model="search"
            class="input"
            placeholder="Cari assessment..."
            aria-label="Cari assessment"
          />
        </MotionField>
        <button
          v-if="search"
          type="button"
          class="clear-search-btn"
          title="Hapus pencarian"
          aria-label="Hapus kata kunci pencarian"
          @click="search = ''"
        >
          <Icon name="x" />
        </button>
      </label>
    </div>

    <!-- Active Filters Summary Chips -->
    <div v-if="hasActiveFilters" class="toolbar-summary">
      <div class="summary-count">
        Menampilkan <strong>{{ items.length }}</strong> assessment
      </div>
      <div class="summary-chips">
        <span v-if="filter !== 'all'" class="filter-chip">
          Status: <em>{{ getStatusLabel(filter) }}</em>
          <button
            type="button"
            class="chip-close-btn"
            title="Hapus filter status"
            aria-label="Hapus filter status"
            @click="selectedStatus = 'all'"
          >
            <Icon name="x" />
          </button>
        </span>
        <span v-if="selectedClass && selectedClass.code !== 'all'" class="filter-chip">
          Kelas: <em>{{ formatSelectedClass(selectedClass) }}</em>
          <button
            type="button"
            class="chip-close-btn"
            title="Hapus filter kelas"
            aria-label="Hapus filter kelas"
            @click="selectedClass = null"
          >
            <Icon name="x" />
          </button>
        </span>
        <span v-if="activeSortLabel" class="filter-chip">
          Urut: <em>{{ activeSortLabel }}</em>
          <button
            type="button"
            class="chip-close-btn"
            title="Reset urutan"
            aria-label="Hapus urutan"
            @click="clearSort"
          >
            <Icon name="x" />
          </button>
        </span>
        <span v-if="search" class="filter-chip">
          Kata kunci: "<em>{{ search }}</em>"
          <button
            type="button"
            class="chip-close-btn"
            title="Hapus pencarian"
            aria-label="Hapus filter pencarian"
            @click="search = ''"
          >
            <Icon name="x" />
          </button>
        </span>
      </div>
    </div>

    <!-- Hasil Tabel Assessment -->
    <div
      ref="results"
      class="assessment-results"
      @focusin="stopFade"
      @pointerdown="stopFade"
    >
      <AssessmentTable
        :items="items"
        :motion="false"
        :show-status="filter === 'all'"
        :sortable="true"
        :sort-key="sortKey"
        :sort-dir="sortDir"
        @sort="handleColumnSort"
      />
    </div>
  </section>
</template>
