import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { apiClient } from "../services/apiClient.js";
import { useAssessmentStore } from "./assessmentStore.js";

function hasLiveApiSession() {
  const token = apiClient.getToken();
  return Boolean(token && !String(token).startsWith("local-"));
}

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const useLmsStore = defineStore("lms", () => {
  const classes = ref([]);
  const activeClassId = ref(null);
  const activeClass = ref(null);
  const modules = ref([]);
  const moduleProgress = ref({
    read_count: 0,
    total_modules: 0,
    progress_percentage: 0,
  });
  const classProgress = ref({
    total_public_modules: 0,
    modules: [],
    students: [],
  });
  const assignments = ref([]);
  const announcements = ref([]);
  const quizzes = ref([]);
  const activeQuiz = ref(null);
  const activeQuizQuestions = ref([]);
  const generationJob = ref(null);
  const notifications = ref([]);
  const unreadCount = ref(0);

  const loading = ref(false);
  const detailLoading = ref(false);
  const error = ref("");

  const currentClass = computed(
    () =>
      activeClass.value ||
      classes.value.find((item) => Number(item.id) === Number(activeClassId.value)) ||
      null,
  );

  function resetError() {
    error.value = "";
  }

  function extractErrorMessage(err, fallback) {
    const fieldErrors = err?.details?.fields;
    if (fieldErrors && typeof fieldErrors === "object") {
      const firstGroup = Object.values(fieldErrors)[0];
      if (Array.isArray(firstGroup) && firstGroup.length > 0) {
        return String(firstGroup[0]);
      }
    }
    return err?.message || fallback;
  }

  async function loadClasses({ selectFirst = true } = {}) {
    if (!hasLiveApiSession()) {
      classes.value = [];
      return [];
    }
    loading.value = true;
    resetError();
    try {
      const data = await apiClient.listClasses();
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      classes.value = items;

      if (items.length > 0) {
        const exists = items.some((c) => Number(c.id) === Number(activeClassId.value));
        if (!exists && selectFirst) {
          await selectClass(items[0].id);
        }
      } else {
        activeClassId.value = null;
        activeClass.value = null;
        modules.value = [];
        assignments.value = [];
        announcements.value = [];
        quizzes.value = [];
      }
      return items;
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal memuat daftar kelas.");
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function selectClass(classId) {
    if (!classId || !hasLiveApiSession()) return null;
    activeClassId.value = Number(classId);
    detailLoading.value = true;
    resetError();
    try {
      const [classRes, modRes, assignRes, annRes, quizRes] = await Promise.all([
        apiClient.getClass(classId),
        apiClient.listModules(classId),
        apiClient.listClassAssignments(classId),
        apiClient.listClassAnnouncements(classId),
        apiClient.listClassQuizzes(classId),
      ]);

      activeClass.value = classRes || null;
      modules.value = Array.isArray(modRes?.items) ? modRes.items : [];
      if (modRes?.progress) {
        moduleProgress.value = modRes.progress;
      }
      assignments.value = Array.isArray(assignRes?.items) ? assignRes.items : [];
      announcements.value = Array.isArray(annRes?.items) ? annRes.items : [];
      quizzes.value = Array.isArray(quizRes?.data)
        ? quizRes.data
        : Array.isArray(quizRes?.items)
          ? quizRes.items
          : [];

      const progressRes = await apiClient.getClassProgress(classId);
      if (progressRes?.students) {
        classProgress.value = progressRes;
      } else if (progressRes) {
        moduleProgress.value = {
          read_count: progressRes.read_count ?? 0,
          total_modules: progressRes.total_public_modules ?? 0,
          progress_percentage: progressRes.progress_percentage ?? 0,
        };
      }

      if (activeQuiz.value && Number(activeQuiz.value.class_id) !== Number(classId)) {
        activeQuiz.value = null;
        activeQuizQuestions.value = [];
      }

      return activeClass.value;
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal memuat detail kelas.");
      throw err;
    } finally {
      detailLoading.value = false;
    }
  }

  async function createClass({ name, description = "" }) {
    resetError();
    try {
      const created = await apiClient.createClass({ name, description });
      await loadClasses({ selectFirst: false });
      if (created?.id) {
        await selectClass(created.id);
      }
      return created;
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal membuat kelas baru.");
      throw err;
    }
  }

  async function updateClass(classId, payload) {
    resetError();
    const previousName =
      activeClass.value && Number(activeClass.value.id) === Number(classId)
        ? activeClass.value.name
        : classes.value.find((item) => Number(item.id) === Number(classId))?.name || "";
    try {
      const updated = await apiClient.updateClass(classId, payload);
      activeClass.value = { ...(activeClass.value || {}), ...updated };
      classes.value = classes.value.map((item) =>
        Number(item.id) === Number(classId) ? { ...item, ...updated } : item,
      );
      useAssessmentStore().applyLmsClassUpdate({ id: classId, ...updated }, previousName);
      return updated;
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal memperbarui kelas.");
      throw err;
    }
  }

  async function joinClass(classCode) {
    resetError();
    try {
      const joined = await apiClient.joinClass(classCode);
      await loadClasses({ selectFirst: false });
      if (joined?.id) {
        await selectClass(joined.id);
      }
      return joined;
    } catch (err) {
      error.value = extractErrorMessage(err, "Kode kelas tidak valid atau sudah bergabung.");
      throw err;
    }
  }

  async function leaveClass(classId) {
    resetError();
    try {
      await apiClient.leaveClass(classId);
      if (Number(activeClassId.value) === Number(classId)) {
        activeClassId.value = null;
        activeClass.value = null;
      }
      await loadClasses({ selectFirst: true });
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal keluar dari kelas.");
      throw err;
    }
  }

  async function uploadModule(classId, { file = null, fileName = "", visibility = "public" }) {
    resetError();
    try {
      const created = await apiClient.uploadModule(classId, {
        file,
        fileName,
        visibility,
      });
      if (Number(activeClassId.value) === Number(classId)) {
        const modRes = await apiClient.listModules(classId);
        modules.value = Array.isArray(modRes?.items) ? modRes.items : [];
      }
      return created;
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal mengunggah materi PDF.");
      throw err;
    }
  }

  async function setModuleVisibility(moduleId, visibility) {
    resetError();
    try {
      const updated = await apiClient.setModuleVisibility(moduleId, visibility);
      modules.value = modules.value.map((m) =>
        Number(m.id) === Number(moduleId) ? { ...m, visibility: updated.visibility } : m,
      );
      if (activeClassId.value) {
        await loadClassProgress(activeClassId.value);
      }
      return updated;
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal mengubah visibilitas materi.");
      throw err;
    }
  }

  async function deleteModule(moduleId) {
    resetError();
    try {
      await apiClient.deleteModule(moduleId);
      modules.value = modules.value.filter((m) => Number(m.id) !== Number(moduleId));
      if (activeClassId.value) {
        await loadClassProgress(activeClassId.value);
      }
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal menghapus materi PDF.");
      throw err;
    }
  }

  async function downloadModule(moduleId) {
    resetError();
    try {
      const { blob, fileName } = await apiClient.downloadModule(moduleId);
      if (typeof window !== "undefined" && typeof document !== "undefined" && window.URL?.createObjectURL) {
        const objectUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(objectUrl);
      }
      return { blob, fileName };
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal mengunduh file PDF.");
      throw err;
    }
  }

  async function markModuleRead(moduleId) {
    resetError();
    try {
      const res = await apiClient.markModuleRead(moduleId);
      modules.value = modules.value.map((m) =>
        Number(m.id) === Number(moduleId)
          ? { ...m, is_read: true, read_at: res?.read_at || new Date().toISOString() }
          : m,
      );
      if (res?.progress) {
        moduleProgress.value = res.progress;
      }
      return res;
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal menandai materi sudah dibaca.");
      throw err;
    }
  }

  async function loadClassProgress(classId) {
    if (!classId || !hasLiveApiSession()) return null;
    const progressRes = await apiClient.getClassProgress(classId);
    if (progressRes?.students) {
      classProgress.value = progressRes;
    } else if (progressRes) {
      moduleProgress.value = {
        read_count: progressRes.read_count ?? 0,
        total_modules: progressRes.total_public_modules ?? 0,
        progress_percentage: progressRes.progress_percentage ?? 0,
      };
    }
    return progressRes;
  }

  async function createAssignment(classId, payload) {
    resetError();
    try {
      const created = await apiClient.createAssignment(classId, payload);
      assignments.value = [created, ...assignments.value];
      return created;
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal membuat tugas pembelajaran.");
      throw err;
    }
  }

  async function updateAssignment(assignmentId, payload) {
    resetError();
    try {
      const updated = await apiClient.updateAssignment(assignmentId, payload);
      assignments.value = assignments.value.map((a) =>
        Number(a.id) === Number(assignmentId) ? updated : a,
      );
      return updated;
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal memperbarui tugas pembelajaran.");
      throw err;
    }
  }

  async function publishAssignment(assignmentId, payload = {}) {
    resetError();
    try {
      const updated = await apiClient.publishAssignment(assignmentId, payload);
      assignments.value = assignments.value.map((a) =>
        Number(a.id) === Number(assignmentId) ? updated : a,
      );
      return updated;
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal mempublikasikan tugas.");
      throw err;
    }
  }

  async function deleteAssignment(assignmentId) {
    resetError();
    try {
      await apiClient.deleteAssignment(assignmentId);
      assignments.value = assignments.value.filter((a) => Number(a.id) !== Number(assignmentId));
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal menghapus tugas.");
      throw err;
    }
  }

  async function createAnnouncement(classId, payload) {
    resetError();
    try {
      const created = await apiClient.createAnnouncement(classId, payload);
      announcements.value = [created, ...announcements.value];
      return created;
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal mengirim pengumuman.");
      throw err;
    }
  }

  async function deleteAnnouncement(announcementId) {
    resetError();
    try {
      await apiClient.deleteAnnouncement(announcementId);
      announcements.value = announcements.value.filter(
        (item) => Number(item.id) !== Number(announcementId),
      );
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal menghapus pengumuman.");
      throw err;
    }
  }

  async function loadNotifications({ unreadOnly = false } = {}) {
    if (!hasLiveApiSession()) {
      notifications.value = [];
      unreadCount.value = 0;
      return [];
    }
    try {
      const data = await apiClient.listNotifications({ unread_only: unreadOnly, per_page: 50 });
      notifications.value = Array.isArray(data?.items) ? data.items : [];
      unreadCount.value = Number(data?.unread_count ?? 0);
      return notifications.value;
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal memuat notifikasi.");
      throw err;
    }
  }

  async function markNotificationRead(notificationId) {
    resetError();
    try {
      const updated = await apiClient.markNotificationRead(notificationId);
      notifications.value = notifications.value.map((n) =>
        Number(n.id) === Number(notificationId) ? { ...n, ...updated, is_read: true } : n,
      );
      unreadCount.value = Math.max(
        0,
        notifications.value.filter((n) => !n.is_read).length,
      );
      return updated;
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal menandai notifikasi dibaca.");
      throw err;
    }
  }

  async function markAllNotificationsRead() {
    resetError();
    try {
      await apiClient.markAllNotificationsRead();
      const nowIso = new Date().toISOString();
      notifications.value = notifications.value.map((n) => ({
        ...n,
        is_read: true,
        read_at: n.read_at || nowIso,
      }));
      unreadCount.value = 0;
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal menandai seluruh notifikasi.");
      throw err;
    }
  }

  async function generateQuizFromModule(moduleId, questionCount = 5, title = "") {
    resetError();
    try {
      const job = await apiClient.requestQuizGeneration(moduleId, questionCount, title);
      generationJob.value = job;
      return job;
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal memulai generate soal AI.");
      throw err;
    }
  }

  async function pollQuizGeneration(generationId, { maxAttempts = 20, pollWaitMs = 1500 } = {}) {
    resetError();
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const job = await apiClient.getQuizGeneration(generationId);
      generationJob.value = job;
      if (job?.status === "completed") {
        if (activeClassId.value) {
          const quizRes = await apiClient.listClassQuizzes(activeClassId.value);
          quizzes.value = Array.isArray(quizRes?.data)
            ? quizRes.data
            : Array.isArray(quizRes?.items)
              ? quizRes.items
              : [];
        }
        if (job.quiz_id) {
          await loadQuizDetail(job.quiz_id);
        }
        useAssessmentStore().syncFromApi().catch(() => {});
        return job;
      }
      if (job?.status === "failed") {
        throw new Error(job.error_message || "AI gagal membuat soal dari materi PDF.");
      }
      if (attempt < maxAttempts - 1) {
        await waitMs(pollWaitMs);
      }
    }
    return generationJob.value;
  }

  async function loadQuizDetail(quizId) {
    if (!quizId || !hasLiveApiSession()) return null;
    resetError();
    try {
      const [quizRes, questionsRes] = await Promise.all([
        apiClient.getQuiz(quizId),
        apiClient.listQuestions(quizId),
      ]);
      activeQuiz.value = quizRes || null;
      activeQuizQuestions.value = Array.isArray(questionsRes)
        ? questionsRes
        : Array.isArray(quizRes?.questions)
          ? quizRes.questions
          : [];
      return activeQuiz.value;
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal memuat detail kuis.");
      throw err;
    }
  }

  async function reviewQuizQuestion(quizId, questionId, reviewed = true) {
    resetError();
    try {
      const updated = await apiClient.reviewQuestion(quizId, questionId, reviewed);
      activeQuizQuestions.value = activeQuizQuestions.value.map((q) =>
        Number(q.id) === Number(questionId) ? updated : q,
      );
      return updated;
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal memperbarui status review soal.");
      throw err;
    }
  }

  async function updateQuizQuestionAndOptions(
    quizId,
    questionId,
    { question_text, options = null, reviewed },
  ) {
    resetError();
    try {
      let updated = await apiClient.updateQuestion(quizId, questionId, {
        question_text,
        reviewed,
      });
      if (Array.isArray(options) && options.length === 4) {
        const replacedOptions = await apiClient.replaceOptions(quizId, questionId, options);
        updated = { ...updated, options: replacedOptions };
      }
      activeQuizQuestions.value = activeQuizQuestions.value.map((q) =>
        Number(q.id) === Number(questionId) ? updated : q,
      );
      return updated;
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal menyimpan perubahan soal.");
      throw err;
    }
  }

  async function createManualQuestion(quizId, { question_text, options }) {
    resetError();
    try {
      const created = await apiClient.createQuestion(quizId, { question_text, options });
      activeQuizQuestions.value = [...activeQuizQuestions.value, created];
      return created;
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal menambahkan soal manual.");
      throw err;
    }
  }

  async function deleteQuizQuestion(quizId, questionId) {
    resetError();
    try {
      await apiClient.deleteQuestion(quizId, questionId);
      activeQuizQuestions.value = activeQuizQuestions.value.filter(
        (q) => Number(q.id) !== Number(questionId),
      );
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal menghapus soal.");
      throw err;
    }
  }

  async function publishClassQuiz(quizId, deadline) {
    resetError();
    try {
      const updated = await apiClient.publishQuiz(quizId, { deadline });
      activeQuiz.value = updated;
      quizzes.value = quizzes.value.map((q) =>
        Number(q.id) === Number(quizId) ? { ...q, ...updated } : q,
      );
      useAssessmentStore().syncFromApi().catch(() => {});
      return updated;
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal mempublish kuis.");
      throw err;
    }
  }

  async function closeClassQuiz(quizId) {
    resetError();
    try {
      const updated = await apiClient.closeQuiz(quizId);
      activeQuiz.value = updated;
      quizzes.value = quizzes.value.map((q) =>
        Number(q.id) === Number(quizId) ? { ...q, ...updated } : q,
      );
      useAssessmentStore().syncFromApi().catch(() => {});
      return updated;
    } catch (err) {
      error.value = extractErrorMessage(err, "Gagal menutup kuis.");
      throw err;
    }
  }

  return {
    classes,
    activeClassId,
    activeClass,
    currentClass,
    modules,
    moduleProgress,
    classProgress,
    assignments,
    announcements,
    quizzes,
    activeQuiz,
    activeQuizQuestions,
    generationJob,
    notifications,
    unreadCount,
    loading,
    detailLoading,
    error,
    loadClasses,
    selectClass,
    createClass,
    updateClass,
    joinClass,
    leaveClass,
    uploadModule,
    setModuleVisibility,
    deleteModule,
    downloadModule,
    markModuleRead,
    loadClassProgress,
    createAssignment,
    updateAssignment,
    publishAssignment,
    deleteAssignment,
    createAnnouncement,
    deleteAnnouncement,
    loadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    generateQuizFromModule,
    pollQuizGeneration,
    loadQuizDetail,
    reviewQuizQuestion,
    updateQuizQuestionAndOptions,
    createManualQuestion,
    deleteQuizQuestion,
    publishClassQuiz,
    closeClassQuiz,
  };
});
