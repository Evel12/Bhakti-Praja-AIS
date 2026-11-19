import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

// This namespace belongs to the existing local teacher demo, not a shared account.
const keyFor = (attempt) => `examnia.grading-draft.v1:teacher-demo:${attempt.assessmentId}:${attempt.id}`;
const valuesOf = (attempt) => ({ score: attempt?.score ?? "", feedback: attempt?.feedback || "" });

export function useGradingDraft(attempt) {
  const score = ref(""), feedback = ref(""), baseline = ref(""), error = ref(""), restored = ref(false);
  let current, loading = false, hasDraft = false;
  const snapshot = () => JSON.stringify({ score: score.value, feedback: feedback.value });
  const dirty = computed(() => Boolean(current) && snapshot() !== baseline.value);

  function persist() {
    if (!current || (!dirty.value && !hasDraft)) return true;
    hasDraft = true;
    try {
      localStorage.setItem(keyFor(current), JSON.stringify({
        version: 1,
        studentId: current.studentId,
        baseline: baseline.value,
        score: score.value,
        feedback: feedback.value,
      }));
      error.value = "";
      return true;
    } catch {
      error.value = "Draft penilaian belum tersimpan. Perubahan kamu masih ada di halaman ini. Coba simpan draft sebelum meninggalkan halaman.";
      return false;
    }
  }
  function load() {
    loading = true;
    current = attempt.value?.status === "submitted" ? attempt.value : undefined;
    const values = valuesOf(current);
    baseline.value = JSON.stringify(values);
    score.value = values.score;
    feedback.value = values.feedback;
    restored.value = false;
    error.value = "";
    hasDraft = false;
    if (current) {
      try {
        const raw = localStorage.getItem(keyFor(current));
        hasDraft = Boolean(raw);
        const draft = raw ? JSON.parse(raw) : null;
        if (draft?.version === 1 && draft.studentId === current.studentId && draft.baseline === baseline.value
          && (typeof draft.score === "number" || typeof draft.score === "string") && Number.isFinite(Number(draft.score))
          && typeof draft.feedback === "string" && draft.feedback.length <= 4000) {
          score.value = draft.score;
          feedback.value = draft.feedback;
          restored.value = snapshot() !== baseline.value;
        }
      } catch {
        hasDraft = true;
        error.value = "Draft lokal tidak bisa dibaca. Nilai tersimpan tetap tersedia; pastikan penyimpanan browser dapat digunakan sebelum mengedit.";
      }
    }
    loading = false;
  }
  function markCommitted() {
    loading = true;
    const values = valuesOf(attempt.value);
    baseline.value = JSON.stringify(values);
    score.value = values.score;
    feedback.value = values.feedback;
    restored.value = false;
    error.value = "";
    hasDraft = false;
    try { localStorage.removeItem(keyFor(current)); } catch { /* A stale baseline will not override a newer grade. */ }
    loading = false;
  }
  const stopAttempt = watch(() => attempt.value?.id, load, { immediate: true, flush: "sync" });
  const stopEdits = watch([score, feedback], () => {
    if (loading) return;
    restored.value = false;
    // Also acknowledge reverting to the saved value, so a previous draft cannot return.
    persist();
  }, { flush: "sync" });
  function beforeUnload(event) {
    if (!persist()) { event.preventDefault(); event.returnValue = ""; }
  }
  function hidden() { if (document.visibilityState === "hidden") persist(); }
  onMounted(() => {
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", hidden);
  });
  onBeforeUnmount(() => {
    persist();
    stopAttempt(); stopEdits();
    window.removeEventListener("beforeunload", beforeUnload);
    window.removeEventListener("pagehide", persist);
    document.removeEventListener("visibilitychange", hidden);
  });
  return { score, feedback, dirty, error, restored, persist, markCommitted };
}
