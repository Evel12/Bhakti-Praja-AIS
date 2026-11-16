import { defineStore } from "pinia";
import { ref } from "vue";
import { repository } from "../repositories/assessmentRepository.js";
import { validateDatabase } from "../repositories/localAssessmentRepository.js";
import {
  clone,
  cloneQuestionForDraft,
  saveAssessment,
  newAssessment,
  newQuestion,
  duplicateAssessment,
  validateAssessment,
  startAttempt,
  finishAttempt,
  statusOf,
  STUDENT_ID,
  uid,
} from "../domain/assessment.js";
import {
  findMatchingLmsClass,
  parseLmsClassName,
} from "../domain/classSync.js";
import { apiClient } from "../services/apiClient.js";
import { formatQuizGenerationError } from "../utils/quizGenerationErrors.js";
import { useUiStore } from "./uiStore.js";
import { useLmsStore } from "./lmsStore.js";

function hasLiveBackendToken() {
  const token = apiClient.getToken();
  return Boolean(token && !String(token).startsWith("local-"));
}

function mapBackendQuestion(q, topic = "") {
  const fq = newQuestion();
  fq.id = q?.id != null ? `api-q-${q.id}` : uid();
  if (q?.id != null) fq.backendQuestionId = q.id;
  fq.topic = q?.topic || topic || fq.topic;
  fq.text = q?.question_text || "";
  if (q?.points != null) fq.points = Number(q.points);
  if (q?.explanation != null) fq.explanation = q.explanation;
  fq.source = q?.source === "ai" ? "ai" : "manual";
  fq.reviewed =
    typeof q?.reviewed === "boolean" ? q.reviewed : fq.source !== "ai";
  if (Array.isArray(q?.options) && q.options.length === 4) {
    const sorted = [...q.options].sort((a, b) =>
      String(a.option_label).localeCompare(String(b.option_label)),
    );
    fq.options = sorted.map((opt) => opt.option_text || "");
    const correctIdx = sorted.findIndex((opt) => opt.is_correct === true);
    fq.correct = correctIdx >= 0 ? correctIdx : 0;
    fq.backendOptionIds = sorted.map((opt) => opt.id);
  }
  return fq;
}

function mapBackendQuizToFrontend(backendQuiz, classItem, existingAssessment = null) {
  const base = existingAssessment ? clone(existingAssessment) : newAssessment();
  base.id = existingAssessment?.id || `api-quiz-${backendQuiz.id}`;
  base.backendQuizId = backendQuiz.id;
  base.backendClassId = backendQuiz.class_id || classItem?.id || 1;
  base.title = backendQuiz.title || base.title;
  base.type = backendQuiz.assessment_type === "assignment" ? "Tugas" : "Kuis";

  const mappedClass = parseLmsClassName(classItem?.name, existingAssessment || {});
  base.course = backendQuiz.course_name || mappedClass.course;
  base.className = mappedClass.className;

  base.instructions =
    backendQuiz.instructions ||
    backendQuiz.description ||
    base.instructions ||
    "Pilih satu jawaban yang paling tepat. Cek jawaban sebelum mengirim.";

  if (backendQuiz.status === "archived") {
    base.state = "archived";
  } else if (backendQuiz.status === "closed") {
    base.state = "closed";
  } else if (backendQuiz.status === "published") {
    base.state = "published";
  } else {
    base.state = "draft";
  }

  if (backendQuiz.open_at) {
    base.openAt = backendQuiz.open_at;
  }
  if (backendQuiz.deadline) {
    base.closeAt = backendQuiz.deadline;
  }
  if (backendQuiz.duration_minutes != null) {
    base.duration = Number(backendQuiz.duration_minutes);
  }
  if (backendQuiz.release_mode) {
    base.releaseMode = backendQuiz.release_mode === "manual" ? "manual" : "immediate";
  }
  if (typeof backendQuiz.results_released === "boolean") {
    base.released = backendQuiz.results_released;
  }

  if (Array.isArray(backendQuiz.questions) && backendQuiz.questions.length > 0) {
    base.questions = backendQuiz.questions.map((q) =>
      mapBackendQuestion(q, base.course),
    );
  }

  return base;
}

function extractGradeItems(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.data?.items)) return res.data.items;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

function mapBackendGradeToAttempt(gradeRecord, assessment, existingAttempt = null, isStudentRole = false) {
  const attemptId = gradeRecord.id ?? gradeRecord.attempt_id;
  const submittedAt = gradeRecord.finished_at ?? gradeRecord.submitted_at;
  const studentName = gradeRecord.student?.name ?? gradeRecord.student_name ?? existingAttempt?.studentName ?? "Siswa";
  const status =
    gradeRecord.status === "ongoing" || gradeRecord.status === "in_progress"
      ? "in_progress"
      : "submitted";
  const isGraded =
    typeof gradeRecord.graded === "boolean"
      ? gradeRecord.graded
      : gradeRecord.graded_at != null || gradeRecord.final_grade != null;

  const base = existingAttempt ? clone(existingAttempt) : {
    id: attemptId != null ? `api-attempt-${attemptId}` : uid(),
    assessmentId: assessment.id,
    answers: {},
    flags: [],
    startedAt: gradeRecord.started_at || submittedAt || new Date().toISOString(),
    expiresAt: gradeRecord.expires_at || assessment.closeAt || new Date().toISOString(),
  };
  base.id = existingAttempt?.id || (attemptId != null ? `api-attempt-${attemptId}` : base.id);
  base.backendAttemptId = attemptId;
  base.assessmentId = assessment.id;
  base.className = assessment.className || base.className || "Kelas A";
  base.studentName = studentName;
  base.studentId = isStudentRole
    ? STUDENT_ID
    : existingAttempt?.studentId ||
      (gradeRecord.student_id != null ? String(gradeRecord.student_id) : STUDENT_ID);
  base.status = status;
  if (status === "submitted") {
    base.submittedAt = submittedAt || base.submittedAt || new Date().toISOString();
  } else {
    base.submittedAt = null;
  }
  base.score = gradeRecord.final_grade != null ? Math.round(Number(gradeRecord.final_grade)) : (base.score ?? 0);
  base.graded = isGraded;
  base.feedback = gradeRecord.teacher_feedback ?? base.feedback ?? "";
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
      const classes = Array.isArray(classesRes?.items)
        ? classesRes.items
        : Array.isArray(classesRes)
          ? classesRes
          : [];
      const lmsStore = useLmsStore();
      lmsStore.classes = classes;

      if (activeRole.value === "teacher") {
        try {
          const bankRes = await apiClient.listQuestionBank();
          const bankItems = Array.isArray(bankRes)
            ? bankRes
            : Array.isArray(bankRes?.items)
              ? bankRes.items
              : Array.isArray(bankRes?.data?.items)
                ? bankRes.data.items
                : Array.isArray(bankRes?.data)
                  ? bankRes.data
                  : [];
          if (bankItems.length) {
            transaction((data) => {
              for (const bq of bankItems) {
                const mappedQ = mapBackendQuestion(bq, bq.topic || "Informatika");
                const idx = data.bank.findIndex(
                  (item) =>
                    item.backendQuestionId === bq.id || item.id === mappedQ.id,
                );
                if (idx >= 0) data.bank[idx] = mappedQ;
                else data.bank.push(mappedQ);
              }
            });
          }
        } catch {
          // Ignore bank sync error
        }
      }

      if (!classes.length) return true;

      for (const schoolClass of classes) {
        const quizzesRes = await apiClient.listClassQuizzes(schoolClass.id);
        const quizzes = Array.isArray(quizzesRes?.data)
          ? quizzesRes.data
          : Array.isArray(quizzesRes?.items)
            ? quizzesRes.items
            : Array.isArray(quizzesRes)
              ? quizzesRes
              : [];

        for (const quizSummary of quizzes) {
          let detailedQuiz = quizSummary;
          if (activeRole.value === "teacher") {
            try {
              detailedQuiz = await apiClient.getQuiz(quizSummary.id);
              if (!Array.isArray(detailedQuiz?.questions)) {
                const qs = await apiClient.listQuestions(quizSummary.id).catch(() => null);
                if (Array.isArray(qs)) {
                  detailedQuiz = { ...detailedQuiz, questions: qs };
                }
              }
            } catch {
              detailedQuiz = quizSummary;
            }
          }

          let mappedAssessment = null;
          transaction((data) => {
            const existing = data.assessments.find(
              (item) =>
                item.backendQuizId === detailedQuiz.id ||
                item.id === `api-quiz-${detailedQuiz.id}` ||
                (!item.backendQuizId &&
                  item.title.toLowerCase() === String(detailedQuiz.title || "").toLowerCase()),
            );
            mappedAssessment = mapBackendQuizToFrontend(detailedQuiz, schoolClass, existing);
            saveAssessment(data, mappedAssessment);
          });

          if (activeRole.value === "teacher" && mappedAssessment?.backendQuizId) {
            try {
              const gradesRes = await apiClient.getQuizGrades(mappedAssessment.backendQuizId);
              const grades = extractGradeItems(gradesRes);
              if (grades.length) {
                transaction((data) => {
                  for (const gr of grades) {
                    const grId = gr.id ?? gr.attempt_id;
                    const existingAt = data.attempts.find(
                      (at) =>
                        at.backendAttemptId === grId ||
                        at.id === `api-attempt-${grId}`,
                    );
                    const mappedAt = mapBackendGradeToAttempt(gr, mappedAssessment, existingAt);
                    const idx = data.attempts.findIndex((at) => at.id === mappedAt.id);
                    if (idx >= 0) data.attempts[idx] = mappedAt;
                    else data.attempts.push(mappedAt);
                  }
                });
              }
            } catch {
              // Ignore grade sync error for draft quizzes
            }
          }
        }
      }

      if (activeRole.value === "student") {
        try {
          const personalGradesRes = await apiClient.getPersonalGrades();
          const personalGrades = extractGradeItems(personalGradesRes);
          if (personalGrades.length) {
            transaction((data) => {
              for (const gr of personalGrades) {
                const grId = gr.id ?? gr.attempt_id;
                const targetAssessment = data.assessments.find(
                  (a) =>
                    a.backendQuizId === gr.quiz_id || a.id === `api-quiz-${gr.quiz_id}`,
                );
                if (!targetAssessment) continue;
                const existingAt = data.attempts.find(
                  (at) =>
                    at.backendAttemptId === grId ||
                    at.id === `api-attempt-${grId}`,
                );
                const mappedAt = mapBackendGradeToAttempt(gr, targetAssessment, existingAt, true);
                const idx = data.attempts.findIndex((at) => at.id === mappedAt.id);
                if (idx >= 0) data.attempts[idx] = mappedAt;
                else data.attempts.push(mappedAt);
              }
            });
          }
        } catch {
          // Ignore personal grades sync error
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

  const draftSyncQueue = new Map();

  async function syncDraftToBackend(draft) {
    if (!hasLiveBackendToken() || !draft) return null;
    const key = draft.id || "__default__";
    const previous = draftSyncQueue.get(key) || Promise.resolve();
    const run = previous.catch(() => null).then(() => performSyncDraftToBackend(draft));
    draftSyncQueue.set(key, run);
    try {
      return await run;
    } finally {
      if (draftSyncQueue.get(key) === run) {
        draftSyncQueue.delete(key);
      }
    }
  }

  async function performSyncDraftToBackend(draft) {
    try {
      const lmsStore = useLmsStore();
      let availableClasses = lmsStore.classes;
      if (!availableClasses.length) {
        const classesRes = await apiClient.listClasses();
        availableClasses = Array.isArray(classesRes?.items) ? classesRes.items : [];
        if (availableClasses.length) {
          lmsStore.classes = availableClasses;
        }
      }
      const matchedClass = findMatchingLmsClass(availableClasses, draft);
      const classId = matchedClass?.id || draft.backendClassId || availableClasses?.[0]?.id || 1;
      draft.backendClassId = classId;

      const quizPayload = {
        class_id: classId,
        title: draft.title || "Draft Assessment",
        description: draft.instructions || "",
        instructions: draft.instructions || "",
        assessment_type: draft.type === "Tugas" ? "assignment" : "quiz",
        course_name: draft.course || "Informatika",
        open_at: draft.openAt ? new Date(draft.openAt).toISOString() : null,
        deadline: draft.closeAt ? new Date(draft.closeAt).toISOString() : null,
        duration_minutes: Number(draft.duration) || 30,
        release_mode: draft.releaseMode === "manual" ? "manual" : "immediate",
        results_released: Boolean(draft.released),
      };

      const storedAssessment = db.value.assessments.find((a) => a.id === draft.id);
      let backendQuizId = draft.backendQuizId || storedAssessment?.backendQuizId || null;
      if (!backendQuizId) {
        const created = await apiClient.createQuiz(quizPayload);
        backendQuizId = created?.id;
        if (backendQuizId) {
          draft.backendQuizId = backendQuizId;
          transaction((data) => {
            const target = data.assessments.find((a) => a.id === draft.id);
            if (target) {
              target.backendQuizId = backendQuizId;
              target.backendClassId = classId;
            }
          });
        }
      } else {
        draft.backendQuizId = backendQuizId;
        const { class_id: _unusedClassId, ...updatePayload } = quizPayload;
        await apiClient.updateQuiz(backendQuizId, updatePayload);
      }

      if (backendQuizId && Array.isArray(draft.questions)) {
        const labels = ["A", "B", "C", "D"];
        const storedQuestions = db.value.assessments.find((a) => a.id === draft.id)?.questions || [];
        for (const q of draft.questions) {
          if (!q.text?.trim()) continue;
          const storedQ = storedQuestions.find((item) => item.id === q.id);
          const backendQId = q.backendQuestionId || storedQ?.backendQuestionId || null;
          const options = labels.map((label, idx) => ({
            option_label: label,
            option_text: q.options?.[idx]?.trim() || `Opsi ${label}`,
            is_correct: Number(q.correct) === idx,
          }));
          try {
            if (!backendQId) {
              const createdQ = await apiClient.createQuestion(backendQuizId, {
                question_text: q.text.trim(),
                points: Number(q.points) || 10,
                explanation: q.explanation?.trim() || null,
                topic: q.topic || draft.course || "Informatika",
                options,
              });
              if (createdQ?.id) {
                q.backendQuestionId = createdQ.id;
                transaction((data) => {
                  const target = data.assessments.find((a) => a.id === draft.id);
                  const targetQ = target?.questions?.find((item) => item.id === q.id);
                  if (targetQ) {
                    targetQ.backendQuestionId = createdQ.id;
                  }
                });
              }
            } else {
              q.backendQuestionId = backendQId;
              const updateQPayload = {
                question_text: q.text.trim(),
                reviewed: Boolean(q.reviewed),
              };
              if (q.points != null && Number(q.points) > 1) {
                updateQPayload.points = Number(q.points);
              }
              if (q.explanation?.trim()) {
                updateQPayload.explanation = q.explanation.trim();
              }
              await apiClient.replaceOptions(backendQuizId, backendQId, options);
              await apiClient.updateQuestion(
                backendQuizId,
                backendQId,
                updateQPayload,
              );
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

  async function ensureQuizSynced(quizSummary, schoolClass = null) {
    if (!quizSummary?.id) return null;
    let detailedQuiz = quizSummary;
    if (
      hasLiveBackendToken() &&
      activeRole.value === "teacher" &&
      !Array.isArray(quizSummary.questions)
    ) {
      try {
        detailedQuiz = await apiClient.getQuiz(quizSummary.id);
        if (!Array.isArray(detailedQuiz?.questions)) {
          const qs = await apiClient.listQuestions(quizSummary.id).catch(() => null);
          if (Array.isArray(qs)) {
            detailedQuiz = { ...detailedQuiz, questions: qs };
          }
        }
      } catch {
        detailedQuiz = quizSummary;
      }
    }
    const existing = db.value.assessments.find(
      (item) =>
        item.backendQuizId === detailedQuiz.id ||
        item.id === `api-quiz-${detailedQuiz.id}`,
    );
    const mapped = mapBackendQuizToFrontend(detailedQuiz, schoolClass, existing);
    transaction((data) => {
      saveAssessment(data, mapped);
    });
    return mapped.id;
  }

  async function generateQuestionsFromPdf(
    draft,
    pdfFile = null,
    { moduleId = null, count = 5 } = {},
  ) {
    const fileLabel = pdfFile?.name
      ? pdfFile.name.replace(/\.pdf$/i, "")
      : draft?.course || "Materi Pelajaran";

    if (hasLiveBackendToken()) {
      const lmsStore = useLmsStore();
      let availableClasses = lmsStore.classes;
      if (!availableClasses.length) {
        const classesRes = await apiClient.listClasses();
        availableClasses = Array.isArray(classesRes?.items) ? classesRes.items : [];
        if (availableClasses.length) {
          lmsStore.classes = availableClasses;
        }
      }

      let targetModuleId = moduleId ? Number(moduleId) : null;
      if (!targetModuleId && pdfFile) {
        const matched = findMatchingLmsClass(availableClasses, draft || {});
        const classId = matched?.id || draft?.backendClassId || availableClasses?.[0]?.id || 1;
        const uploadedModule = await apiClient.uploadModule(classId, {
          file: pdfFile,
          fileName: pdfFile?.name || `${fileLabel}.pdf`,
          visibility: "public",
        });
        targetModuleId = uploadedModule?.id ? Number(uploadedModule.id) : null;
      }

      if (targetModuleId) {
        const genJob = await apiClient.requestQuizGeneration(
          targetModuleId,
          Number(count) || 5,
          draft?.title?.trim() || "",
        );
        if (genJob?.id) {
          for (let attempt = 0; attempt < 65; attempt += 1) {
            const statusRes = await apiClient.getQuizGeneration(genJob.id);
            if (statusRes?.status === "completed" && statusRes?.quiz_id) {
              const generatedQuiz = await apiClient.getQuiz(statusRes.quiz_id);
              const questions = Array.isArray(generatedQuiz?.questions)
                ? generatedQuiz.questions
                : await apiClient.listQuestions(statusRes.quiz_id);
              if (draft && !draft.backendQuizId) {
                draft.backendQuizId = statusRes.quiz_id;
                if (generatedQuiz?.class_id) {
                  draft.backendClassId = generatedQuiz.class_id;
                }
              }
              if (Array.isArray(questions) && questions.length) {
                return questions.map((q) => ({
                  ...mapBackendQuestion(q, fileLabel),
                  source: "ai",
                  reviewed: Boolean(q.reviewed),
                }));
              }
              return [];
            }
            if (statusRes?.status === "failed") {
              throw new Error(formatQuizGenerationError(statusRes));
            }
            if (attempt < 64) {
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }
          throw new Error(
            "Proses generate AI memakan waktu lebih lama dari batas tunggu. Cek kembali daftar kuis beberapa saat lagi.",
          );
        }
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

  function applyLmsClassUpdate(classItem, previousName = "") {
    if (!classItem?.id) return;
    const prevParsed = previousName ? parseLmsClassName(previousName) : null;
    transaction((data) => {
      for (const item of data.assessments) {
        const matchesId =
          item.backendClassId != null && Number(item.backendClassId) === Number(classItem.id);
        const matchesPrevName =
          prevParsed &&
          item.backendClassId == null &&
          item.course === prevParsed.course &&
          item.className === prevParsed.className;
        if (!matchesId && !matchesPrevName) continue;
        const nextMapped = parseLmsClassName(classItem.name, item);
        item.backendClassId = Number(classItem.id);
        item.course = nextMapped.course;
        item.className = nextMapped.className;
      }
    });
  }

  function create(question, defaults = {}) {
    return transaction((data) => {
      const a = newAssessment();
      if (defaults?.course) a.course = defaults.course;
      if (defaults?.className) a.className = defaults.className;
      if (defaults?.backendClassId != null) a.backendClassId = Number(defaults.backendClassId);
      if (question) {
        a.title = "Assessment baru — " + question.topic;
        a.course = question.topic;
        a.questions = [cloneQuestionForDraft(question)];
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
    const copyId = transaction((data) => {
      const copy = duplicateAssessment(a);
      saveAssessment(data, copy);
      return copy.id;
    });
    if (hasLiveBackendToken() && a?.backendQuizId) {
      apiClient
        .duplicateQuiz(a.backendQuizId)
        .then((duplicated) => {
          if (duplicated?.id) {
            transaction((data) => {
              const target = data.assessments.find((item) => item.id === copyId);
              if (target) {
                target.backendQuizId = duplicated.id;
              }
            });
          }
        })
        .catch(() => {});
    }
    return copyId;
  }

  function closeAssessment(id) {
    let backendQuizId = null;
    transaction((data) => {
      const target = data.assessments.find((x) => x.id === id);
      if (target) {
        target.state = "closed";
        target.closeAt = new Date(Date.now() - 60000).toISOString();
        backendQuizId = target.backendQuizId;
      }
    });
    if (hasLiveBackendToken() && backendQuizId) {
      apiClient.closeQuiz(backendQuizId).catch(() => {});
    }
  }

  function archiveAssessment(id) {
    let backendQuizId = null;
    transaction((data) => {
      const target = data.assessments.find((x) => x.id === id);
      if (target) {
        target.state = "archived";
        backendQuizId = target.backendQuizId;
      }
    });
    if (hasLiveBackendToken() && backendQuizId) {
      apiClient.archiveQuiz(backendQuizId).catch(() => {});
    }
  }

  function deleteAssessment(id) {
    let backendQuizId = null;
    transaction((data) => {
      const target = data.assessments.find((x) => x.id === id);
      if (target) {
        backendQuizId = target.backendQuizId;
      }
      data.assessments = data.assessments.filter((x) => x.id !== id);
    });
    if (hasLiveBackendToken() && backendQuizId) {
      apiClient.deleteQuiz(backendQuizId).catch(() => {});
    }
  }

  function releaseResults(id) {
    let backendQuizId = null;
    transaction((data) => {
      const target = data.assessments.find((x) => x.id === id);
      if (target) {
        target.released = true;
        backendQuizId = target.backendQuizId;
      }
    });
    if (hasLiveBackendToken() && backendQuizId) {
      apiClient.releaseQuizResults(backendQuizId).catch(() => {});
    }
  }

  function saveBankQuestion(question) {
    const savedQ = clone(question);
    transaction((data) => {
      const idx = data.bank.findIndex((x) => x.id === savedQ.id);
      if (idx >= 0) data.bank[idx] = savedQ;
      else data.bank.unshift(savedQ);
    });
    if (hasLiveBackendToken() && savedQ.text?.trim()) {
      const labels = ["A", "B", "C", "D"];
      const options = labels.map((label, idx) => ({
        option_label: label,
        option_text: savedQ.options?.[idx]?.trim() || `Opsi ${label}`,
        is_correct: Number(savedQ.correct) === idx,
      }));
      apiClient
        .createBankQuestion({
          question_text: savedQ.text.trim(),
          points: Number(savedQ.points) || 10,
          explanation: savedQ.explanation?.trim() || null,
          topic: savedQ.topic || "Informatika",
          options,
        })
        .then((created) => {
          if (created?.id) {
            transaction((data) => {
              const target = data.bank.find((x) => x.id === savedQ.id);
              if (target) target.backendQuestionId = created.id;
            });
          }
        })
        .catch(() => {});
    }
    return savedQ.id;
  }

  function gradeAttempt(attemptId, score, feedback = "") {
    let backendAttemptId = null;
    const numericScore = Number(score);
    transaction((data) => {
      const target = data.attempts.find((x) => x.id === attemptId);
      if (target) {
        target.score = numericScore;
        target.feedback = feedback;
        target.graded = true;
        backendAttemptId = target.backendAttemptId;
      }
    });
    if (hasLiveBackendToken() && backendAttemptId) {
      apiClient
        .gradeAttempt(backendAttemptId, {
          final_grade: numericScore,
          teacher_feedback: feedback || null,
        })
        .catch(() => {});
    }
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
          const deadline = draft.closeAt ? new Date(draft.closeAt).toISOString() : undefined;
          apiClient.publishQuiz(backendQuizId, deadline ? { deadline } : {}).catch(() => {});
        }
      });
    }
    return published;
  }

  async function syncAttemptSession(attemptId) {
    if (!hasLiveBackendToken() || !attemptId) return null;
    const at = db.value.attempts.find((x) => x.id === attemptId);
    if (!at) return null;
    const a = db.value.assessments.find((x) => x.id === at.assessmentId);
    if (!a?.backendQuizId) return null;

    try {
      let backendAttemptId = at.backendAttemptId;
      if (!backendAttemptId) {
        const started = await apiClient.startAttempt(a.backendQuizId);
        backendAttemptId = started?.id;
        if (backendAttemptId) {
          transaction((data) => {
            const targetAt = data.attempts.find((x) => x.id === attemptId);
            if (targetAt) {
              targetAt.backendAttemptId = backendAttemptId;
              if (started?.expires_at) {
                targetAt.expiresAt = started.expires_at;
              }
            }
          });
        }
      }
      if (!backendAttemptId) return null;

      const qPayload = await apiClient.getAttemptQuestions(backendAttemptId);
      const backendQuestions = Array.isArray(qPayload?.questions)
        ? qPayload.questions
        : Array.isArray(qPayload)
          ? qPayload
          : [];
      const savedAnswers = Array.isArray(qPayload?.saved_answers)
        ? qPayload.saved_answers
        : [];

      if (backendQuestions.length) {
        transaction((data) => {
          const targetAssessment = data.assessments.find((x) => x.id === a.id);
          const targetAttempt = data.attempts.find((x) => x.id === attemptId);
          if (!targetAssessment || !targetAttempt) return;

          const existingById = new Map(
            (targetAssessment.questions || []).map((q) => [q.backendQuestionId, q]),
          );
          targetAssessment.questions = backendQuestions.map((bq) => {
            const prev = existingById.get(bq.id);
            const mapped = mapBackendQuestion(bq, targetAssessment.course);
            if (prev) {
              mapped.id = prev.id;
              mapped.correct = prev.correct;
              mapped.explanation = prev.explanation;
              mapped.points = prev.points;
            }
            return mapped;
          });

          for (const sa of savedAnswers) {
            const fq = targetAssessment.questions.find(
              (q) => q.backendQuestionId === sa.question_id,
            );
            if (!fq) continue;
            if (sa.chosen_option_id != null && Array.isArray(fq.backendOptionIds)) {
              const optIdx = fq.backendOptionIds.indexOf(sa.chosen_option_id);
              if (optIdx >= 0) {
                targetAttempt.answers[fq.id] = optIdx;
              }
            }
            if (sa.is_flagged && !targetAttempt.flags.includes(fq.id)) {
              targetAttempt.flags.push(fq.id);
            }
          }
        });
      }
      return backendAttemptId;
    } catch {
      return null;
    }
  }

  async function syncAttemptReview(attemptId) {
    if (!hasLiveBackendToken() || !attemptId) return null;
    const at = db.value.attempts.find((x) => x.id === attemptId);
    if (!at?.backendAttemptId) return null;
    try {
      const review = await apiClient.getStudentAttemptReview(at.backendAttemptId);
      if (!review) return null;
      transaction((data) => {
        const targetAt = data.attempts.find((x) => x.id === attemptId);
        const targetA = data.assessments.find((x) => x.id === at.assessmentId);
        if (!targetAt || !targetA) return;
        const attemptData = review.attempt ?? review;
        const quizData = review.quiz ?? review;
        if (attemptData.final_grade != null) {
          targetAt.score = Math.round(Number(attemptData.final_grade));
          targetAt.graded = true;
        }
        if (typeof attemptData.graded === "boolean") {
          targetAt.graded = attemptData.graded;
        }
        if (attemptData.teacher_feedback != null) {
          targetAt.feedback = attemptData.teacher_feedback;
        }
        if (typeof quizData.results_released === "boolean") {
          targetA.released = quizData.results_released;
        }
        if (quizData.release_mode) {
          targetA.releaseMode = quizData.release_mode === "manual" ? "manual" : "immediate";
        }
        if (review.results_visible === true && targetA.releaseMode === "manual") {
          targetA.released = true;
        }
        if (Array.isArray(review.questions) && review.questions.length) {
          for (const rq of review.questions) {
            const backendQId = rq.id ?? rq.question_id;
            let fq = targetA.questions.find(
              (q) => q.backendQuestionId === backendQId,
            );
            if (!fq) {
              fq = mapBackendQuestion(rq, targetA.course);
              targetA.questions.push(fq);
            }
            if (rq.explanation != null) fq.explanation = rq.explanation;
            if (rq.points != null) fq.points = Number(rq.points);
            if (Array.isArray(rq.options) && rq.options.length === 4) {
              const sorted = [...rq.options].sort((a, b) =>
                String(a.option_label).localeCompare(String(b.option_label)),
              );
              fq.options = sorted.map((o) => o.option_text || "");
              fq.backendOptionIds = sorted.map((o) => o.id);
              const correctIdx = sorted.findIndex((o) => o.is_correct === true);
              if (correctIdx >= 0) fq.correct = correctIdx;
              if (rq.answer?.chosen_option_id != null) {
                const chosenIdx = sorted.findIndex(
                  (o) => o.id === rq.answer.chosen_option_id,
                );
                if (chosenIdx >= 0) {
                  targetAt.answers = targetAt.answers || {};
                  targetAt.answers[fq.id] = chosenIdx;
                }
              }
            }
          }
        }
      });
      return review;
    } catch {
      return null;
    }
  }

  function start(a) {
    const attemptId = transaction((data) => {
      const attempt = startAttempt(a, data.attempts);
      if (!data.attempts.some((x) => x.id === attempt.id))
        data.attempts.push(attempt);
      return attempt.id;
    });
    if (hasLiveBackendToken() && a?.backendQuizId) {
      syncAttemptSession(attemptId);
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
    let backendAttemptId = null;
    const finishedId = transaction((data) => {
      const at = data.attempts.find((x) => x.id === id),
        a = data.assessments.find((x) => x.id === at.assessmentId);
      if (a.type === "Tugas" && Date.now() > Date.parse(at.expiresAt))
        throw new Error("Deadline tugas sudah lewat.");
      finishAttempt(a, at);
      backendAttemptId = at.backendAttemptId;
      return at.id;
    });
    if (hasLiveBackendToken() && backendAttemptId) {
      apiClient
        .finishAttempt(backendAttemptId)
        .then((res) => {
          if (res?.final_grade != null) {
            transaction((data) => {
              const target = data.attempts.find((x) => x.id === finishedId);
              if (target) {
                target.score = Math.round(Number(res.final_grade));
              }
            });
          }
        })
        .catch(() => {});
    }
    return finishedId;
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
    ensureQuizSynced,
    applyLmsClassUpdate,
    generateQuestionsFromPdf,
    transaction,
    run,
    create,
    saveDraft,
    duplicate,
    closeAssessment,
    archiveAssessment,
    deleteAssessment,
    releaseResults,
    saveBankQuestion,
    gradeAttempt,
    publish,
    start,
    syncAttemptSession,
    syncAttemptReview,
    changeAttempt,
    submit,
    restore,
  };
});
