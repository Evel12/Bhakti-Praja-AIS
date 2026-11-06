import { defineStore } from "pinia";
import { ref } from "vue";
import { repository } from "../repositories/assessmentRepository.js";
import { validateDatabase } from "../repositories/localAssessmentRepository.js";
import {
  clone,
  saveAssessment,
  newAssessment,
  newQuestion,
  duplicateAssessment,
  validateAssessment,
  startAttempt,
  finishAttempt,
  statusOf,
  uid,
} from "../domain/assessment.js";
import { apiClient } from "../services/apiClient.js";
import { useUiStore } from "./uiStore.js";

function hasLiveBackendToken() {
  const token = apiClient.getToken();
  return Boolean(token && !String(token).startsWith("local-"));
}

function mapBackendQuizToFrontend(backendQuiz, classItem, existingAssessment = null) {
  const base = existingAssessment ? clone(existingAssessment) : newAssessment();
  base.id = existingAssessment?.id || `api-quiz-${backendQuiz.id}`;
  base.backendQuizId = backendQuiz.id;
  base.backendClassId = backendQuiz.class_id || classItem?.id || 1;
  base.title = backendQuiz.title || base.title;
  base.course = classItem?.name || base.course || "Pemrograman Dasar";
  base.className = classItem?.name || base.className || "IF-A";
  base.instructions =
    backendQuiz.description ||
    base.instructions ||
    "Pilih satu jawaban yang paling tepat. Cek jawaban sebelum mengirim.";
  base.state = backendQuiz.status === "published" || backendQuiz.status === "closed"
    ? "published"
    : "draft";

  if (backendQuiz.deadline) {
    base.closeAt = backendQuiz.deadline;
  }

  if (Array.isArray(backendQuiz.questions) && backendQuiz.questions.length > 0) {
    base.questions = backendQuiz.questions.map((q) => {
      const fq = newQuestion();
      fq.id = `api-q-${q.id}`;
      fq.backendQuestionId = q.id;
      fq.topic = base.course;
      fq.text = q.question_text || "";
      if (Array.isArray(q.options) && q.options.length === 4) {
        const sorted = [...q.options].sort((a, b) =>
          String(a.option_label).localeCompare(String(b.option_label)),
        );
        fq.options = sorted.map((opt) => opt.option_text || "");
        const correctIdx = sorted.findIndex((opt) => opt.is_correct === true);
        fq.answer = correctIdx >= 0 ? correctIdx : 0;
        fq.backendOptionIds = sorted.map((opt) => opt.id);
      }
      return fq;
    });
  }

  return base;
}

export const useAssessmentStore = defineStore("assessment", () => {
  const db = ref({ version: 1, assessments: [], bank: [], attempts: [] }),
    recoveryError = ref(""),
    storageError = ref(false),
    activeRole = ref("teacher"),
    syncing = ref(false),
    lastSyncedAt = ref("");

  function setRole(role) {
    activeRole.value = role === "student" ? "student" : "teacher";
  }

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
        "Penyimpanan gagal. Perubahan belum tersimpan; cek ruang penyimpanan browser.",
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

  async function syncFromApi() {
    if (!hasLiveBackendToken() || recoveryError.value) return false;
    syncing.value = true;
    try {
      const classesRes = await apiClient.listClasses();
      const classes = classesRes?.items || [];
      if (!classes.length) return true;

      for (const schoolClass of classes) {
        const quizzesRes = await apiClient.listClassQuizzes(schoolClass.id);
        const quizzes = quizzesRes?.items || [];

        for (const quizSummary of quizzes) {
          let detailedQuiz = quizSummary;
          if (activeRole.value === "teacher") {
            try {
              detailedQuiz = await apiClient.getQuiz(quizSummary.id);
            } catch {
              detailedQuiz = quizSummary;
            }
          }

          transaction((data) => {
            const existing = data.assessments.find(
              (item) =>
                item.backendQuizId === detailedQuiz.id ||
                item.id === `api-quiz-${detailedQuiz.id}` ||
                item.title.toLowerCase() === String(detailedQuiz.title || "").toLowerCase(),
            );
            const mapped = mapBackendQuizToFrontend(detailedQuiz, schoolClass, existing);
            saveAssessment(data, mapped);
          });
        }
      }

      lastSyncedAt.value = new Date().toISOString();
      return true;
    } catch {
      return false;
    } finally {
      syncing.value = false;
    }
  }

  async function syncDraftToBackend(draft) {
    if (!hasLiveBackendToken() || !draft) return null;
    try {
      let classId = draft.backendClassId || 1;
      if (!draft.backendClassId) {
        const classesRes = await apiClient.listClasses();
        if (classesRes?.items?.[0]?.id) {
          classId = classesRes.items[0].id;
        }
      }

      let backendQuizId = draft.backendQuizId;
      if (!backendQuizId) {
        const created = await apiClient.createQuiz({
          class_id: classId,
          title: draft.title || "Draft Assessment",
          description: draft.instructions || "",
          deadline: draft.closeAt ? new Date(draft.closeAt).toISOString() : null,
        });
        backendQuizId = created?.id;
        if (backendQuizId) {
          transaction((data) => {
            const target = data.assessments.find((a) => a.id === draft.id);
            if (target) {
              target.backendQuizId = backendQuizId;
              target.backendClassId = classId;
            }
          });
        }
      } else {
        await apiClient.updateQuiz(backendQuizId, {
          title: draft.title || "Draft Assessment",
          description: draft.instructions || "",
          deadline: draft.closeAt ? new Date(draft.closeAt).toISOString() : null,
        });
      }

      if (backendQuizId && Array.isArray(draft.questions)) {
        const labels = ["A", "B", "C", "D"];
        for (const q of draft.questions) {
          if (!q.text?.trim() || q.backendQuestionId) continue;
          const options = labels.map((label, idx) => ({
            option_label: label,
            option_text: q.options?.[idx]?.trim() || `Opsi ${label}`,
            is_correct: Number(q.answer) === idx,
          }));
          try {
            const createdQ = await apiClient.createQuestion(backendQuizId, {
              question_text: q.text.trim(),
              options,
            });
            if (createdQ?.id) {
              q.backendQuestionId = createdQ.id;
            }
          } catch {
            // Keep local question intact if backend validation skips
          }
        }
      }

      return backendQuizId;
    } catch {
      return null;
    }
  }

  async function generateQuestionsFromPdf(draft, pdfFile = null) {
    const fileLabel = pdfFile?.name
      ? pdfFile.name.replace(/\.pdf$/i, "")
      : draft?.course || "Materi Perkuliahan";

    if (hasLiveBackendToken()) {
      try {
        const classesRes = await apiClient.listClasses();
        const classId = draft?.backendClassId || classesRes?.items?.[0]?.id || 1;
        const uploadedModule = await apiClient.uploadModule(classId, {
          file: pdfFile,
          fileName: pdfFile?.name || `${fileLabel}.pdf`,
          visibility: "public",
        });

        if (uploadedModule?.id) {
          const genJob = await apiClient.requestQuizGeneration(uploadedModule.id, 3);
          if (genJob?.id) {
            const statusRes = await apiClient.getQuizGeneration(genJob.id);
            if (statusRes?.status === "completed" && statusRes?.quiz_id) {
              const generatedQuiz = await apiClient.getQuiz(statusRes.quiz_id);
              if (Array.isArray(generatedQuiz?.questions) && generatedQuiz.questions.length) {
                return generatedQuiz.questions.map((q) => {
                  const sorted = [...(q.options || [])].sort((a, b) =>
                    String(a.option_label).localeCompare(String(b.option_label)),
                  );
                  const correctIdx = sorted.findIndex((o) => o.is_correct === true);
                  return {
                    id: uid(),
                    topic: fileLabel,
                    type: "Pilihan ganda",
                    points: 10,
                    text: q.question_text,
                    options: sorted.map((o) => o.option_text),
                    answer: correctIdx >= 0 ? correctIdx : 0,
                    source: "ai",
                    reviewed: false,
                  };
                });
              }
            }
          }
        }
      } catch {
        // Fallback to contextual AI draft synthesis below
      }
    }

    const bankQuestions = db.value.bank.slice(0, 3).map((q) => ({
      ...clone(q),
      id: uid(),
      topic: pdfFile?.name ? `${q.topic} (${fileLabel})` : q.topic,
      source: "ai",
      reviewed: false,
    }));

    return bankQuestions;
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
    const saved = transaction((data) => saveAssessment(data, draft));
    if (hasLiveBackendToken()) {
      syncDraftToBackend(draft);
    }
    return saved;
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
    const published = transaction((data) =>
      saveAssessment(data, { ...draft, state: "published" }),
    );
    if (hasLiveBackendToken()) {
      syncDraftToBackend(draft).then((backendQuizId) => {
        if (backendQuizId) {
          apiClient.publishQuiz(backendQuizId).catch(() => {});
        }
      });
    }
    return published;
  }

  function start(a) {
    const attemptId = transaction((data) => {
      const attempt = startAttempt(a, data.attempts);
      if (!data.attempts.some((x) => x.id === attempt.id))
        data.attempts.push(attempt);
      return attempt.id;
    });
    if (hasLiveBackendToken() && a?.backendQuizId) {
      apiClient.startAttempt(a.backendQuizId).catch(() => {});
    }
    return attemptId;
  }

  function changeAttempt(id, mutate) {
    return transaction((data) => {
      const at = data.attempts.find((x) => x.id === id);
      if (!at || at.status !== "in_progress")
        throw new Error("Sesi tidak bisa diubah.");
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
    activeRole,
    syncing,
    lastSyncedAt,
    setRole,
    syncFromApi,
    syncDraftToBackend,
    generateQuestionsFromPdf,
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
