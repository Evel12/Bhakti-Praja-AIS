<script setup>
import { computed, onMounted, watch } from "vue";
import MotionField from "../../components/motion/MotionField.vue";
import FieldError from "../ui/FieldError.vue";
import { useAssessmentFields } from "../../composables/useAssessmentFields.js";
import { useAssessmentStore } from "../../stores/assessmentStore.js";
import { useLmsStore } from "../../stores/lmsStore.js";
import { useAuthStore } from "../../stores/authStore.js";
import {
  buildClassFieldOptions,
  findMatchingLmsClass,
  parseLmsClassName,
} from "../../domain/classSync.js";

const props = defineProps({ draft: Object, issues: { type: Array, default: () => [] } });
const { field, issue } = useAssessmentFields(() => props.issues);
const assessmentStore = useAssessmentStore();
const lmsStore = useLmsStore();
const authStore = useAuthStore();

onMounted(() => {
  if (authStore.apiConnected && !lmsStore.classes.length) {
    lmsStore.loadClasses({ selectFirst: false }).catch(() => {});
  }
});

const fieldOptions = computed(() =>
  buildClassFieldOptions({
    assessments: assessmentStore.db.assessments,
    lmsClasses: lmsStore.classes,
    draft: props.draft,
  }),
);

const selectedLmsClassId = computed({
  get: () => {
    const matched = findMatchingLmsClass(lmsStore.classes, props.draft || {});
    return matched ? String(matched.id) : "";
  },
  set: (val) => {
    if (!props.draft) return;
    const chosen = lmsStore.classes.find((c) => String(c.id) === String(val));
    if (!chosen) {
      props.draft.backendClassId = null;
      return;
    }
    const parsed = parseLmsClassName(chosen.name, props.draft);
    props.draft.backendClassId = Number(chosen.id);
    props.draft.course = parsed.course;
    props.draft.className = parsed.className;
  },
});

watch(
  [() => props.draft?.course, () => props.draft?.className, () => lmsStore.classes.length],
  () => {
    if (!props.draft) return;
    const matched = findMatchingLmsClass(lmsStore.classes, {
      course: props.draft.course,
      className: props.draft.className,
    });
    if (matched) {
      props.draft.backendClassId = Number(matched.id);
    }
  },
);
</script>
<template>
  <h2>Identitas assessment</h2>
  <p class="section-caption mt">Isi detailnya dan pilih kelas yang akan mengerjakan.</p>
  <div class="form-grid">
    <label class="field full"
      ><span class="field-label">Judul assessment *</span
      ><MotionField
        ><input
          v-model="draft.title"
          v-bind="field('title')"
          class="input"
          maxlength="150"
          placeholder="Contoh: Kuis Arsitektur Jaringan"
          required /></MotionField><FieldError :issue="issue('title')" /></label
    ><label class="field"
      ><span class="field-label">Jenis assessment</span
      ><MotionField
        ><select v-model="draft.type" class="input">
          <option v-for="v in ['Kuis', 'Tugas', 'Ujian']" :key="v">
            {{ v }}
          </option>
        </select></MotionField
      ></label
    ><label v-if="fieldOptions.lmsClassOptions.length" class="field full"
      ><span class="field-label">Kelas LMS (sinkron otomatis dengan halaman Kelas)</span
      ><MotionField
        ><select v-model="selectedLmsClassId" class="input" aria-label="Kelas LMS">
          <option value="">Pilih manual di bawah</option>
          <option v-for="c in fieldOptions.lmsClassOptions" :key="c.id" :value="String(c.id)">
            {{ c.name }} ({{ c.class_code }})
          </option>
        </select></MotionField
      ></label
    ><label class="field"
      ><span class="field-label">Mata pelajaran</span
      ><MotionField
        ><select v-model="draft.course" v-bind="field('course')" class="input">
          <option v-for="v in fieldOptions.courses" :key="v">{{ v }}</option>
        </select></MotionField><FieldError :issue="issue('course')" /></label
    ><label class="field"
      ><span class="field-label">Kelas</span
      ><MotionField
        ><select v-model="draft.className" v-bind="field('className')" class="input">
          <option v-for="v in fieldOptions.classes" :key="v">{{ v }}</option>
        </select></MotionField><FieldError :issue="issue('className')" /></label
    ><label class="field full"
      ><span class="field-label">Deskripsi</span
      ><MotionField>
        <textarea
          v-model="draft.description"
          class="input"
          maxlength="2000"
          placeholder="Assessment ini membahas apa?"
        />
      </MotionField>
    </label>
  </div>
</template>
