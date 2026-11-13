import { defineStore } from "pinia";
import { ref } from "vue";
import { repository } from "../repositories/assessmentRepository.js";
import { validateDatabase } from "../repositories/localAssessmentRepository.js";
import {
  clone,
  saveAssessment,
  newAssessment,
  duplicateAssessment,
  validateAssessment,
  startAttempt,
  finishAttempt,
  statusOf,
} from "../domain/assessment.js";
import { useUiStore } from "./uiStore.js";
export const useAssessmentStore = defineStore("assessment", () => {
  const db = ref({ version: 1, assessments: [], bank: [], attempts: [] }),
    recoveryError = ref(""),
    storageError = ref(false);
  function init() {
    try {
      db.value = repository.load();
      recoveryError.value = "";
      if (!repository.raw()) {
        try {
          repository.save(db.value);
        } catch {
          storageError.value = true;
        }
      }
    } catch (e) {
      recoveryError.value = e.message;
    }
  }
  function transaction(change) {
    if (recoveryError.value)
      throw new Error("Pulihkan data sebelum melanjutkan.");
    const next = clone(db.value);
    const result = change(next);
    try {
      repository.save(next);
      db.value = next;
      storageError.value = false;
      return result;
    } catch {
      storageError.value = true;
      throw new Error(
        "Penyimpanan gagal. Perubahan belum tersimpan; periksa ruang penyimpanan browser.",
      );
    }
  }
  function run(action, success) {
    try {
      const value = action();
      if (success) useUiStore().toast(success);
      return value;
    } catch (e) {
      useUiStore().toast(e.message, true);
      return null;
    }
  }
  function create(question) {
    return transaction((data) => {
      const a = newAssessment();
      if (question) {
        a.title = "Assessment baru — " + question.topic;
        a.course = question.topic;
        a.questions = [{ ...clone(question), id: crypto.randomUUID() }];
      }
      saveAssessment(data, a);
      return a.id;
    });
  }
  function saveDraft(draft) {
    return transaction((data) => saveAssessment(data, draft));
  }
  function duplicate(a) {
    return transaction((data) => {
      const copy = duplicateAssessment(a);
      saveAssessment(data, copy);
      return copy.id;
    });
  }
  function publish(draft) {
    const errors = validateAssessment(draft);
    if (Date.parse(draft.closeAt) <= Date.now())
      errors.push("Waktu tutup sudah lewat.");
    if (errors.length) throw new Error(errors.join(" "));
    return transaction((data) =>
      saveAssessment(data, { ...draft, state: "published" }),
    );
  }
  function start(a) {
    return transaction((data) => {
      const attempt = startAttempt(a, data.attempts);
      if (!data.attempts.some((x) => x.id === attempt.id))
        data.attempts.push(attempt);
      return attempt.id;
    });
  }
  function changeAttempt(id, mutate) {
    return transaction((data) => {
      const at = data.attempts.find((x) => x.id === id);
      if (!at || at.status !== "in_progress")
        throw new Error("Sesi tidak dapat diubah.");
      const a = data.assessments.find((x) => x.id === at.assessmentId);
      if (Date.now() >= Date.parse(at.expiresAt) || statusOf(a) === "Ditutup")
        throw new Error("Waktu pengerjaan sudah habis.");
      mutate(at);
    });
  }
  function submit(id) {
    return transaction((data) => {
      const at = data.attempts.find((x) => x.id === id),
        a = data.assessments.find((x) => x.id === at.assessmentId);
      if (a.type === "Tugas" && Date.now() > Date.parse(at.expiresAt))
        throw new Error("Tenggat tugas sudah lewat.");
      finishAttempt(a, at);
      return at.id;
    });
  }
  function restore(raw) {
    const parsed = validateDatabase(JSON.parse(raw));
    repository.save(parsed);
    db.value = parsed;
    recoveryError.value = "";
    storageError.value = false;
  }
  init();
  return {
    db,
    recoveryError,
    storageError,
    transaction,
    run,
    create,
    saveDraft,
    duplicate,
    publish,
    start,
    changeAttempt,
    submit,
    restore,
  };
});
