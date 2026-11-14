import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { apiClient, setStoredSession, setStoredToken } from "../../src/services/apiClient.js";
import { useAssessmentStore } from "../../src/stores/assessmentStore.js";
import { useAttemptStore } from "../../src/stores/attemptStore.js";

describe("Backend & Frontend Assessment Full Parity Workflows", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("syncs teacher lifecycle actions (duplicate, close, archive, releaseResults, saveBankQuestion, gradeAttempt) to backend API", async () => {
    setStoredToken("live-teacher-token");
    setStoredSession({
      user: { id: 10, name: "Guru", email: "guru@test.id", role: "teacher" },
      apiConnected: true,
    });

    const store = useAssessmentStore();
    store.setRole("teacher");

    const duplicateSpy = vi.spyOn(apiClient, "duplicateQuiz").mockResolvedValue({ id: 502 });
    const closeSpy = vi.spyOn(apiClient, "closeQuiz").mockResolvedValue({ id: 501, status: "closed" });
    const archiveSpy = vi.spyOn(apiClient, "archiveQuiz").mockResolvedValue({ id: 501, status: "archived" });
    const releaseSpy = vi.spyOn(apiClient, "releaseQuizResults").mockResolvedValue({ id: 501, results_released: true });
    const bankSpy = vi.spyOn(apiClient, "createBankQuestion").mockResolvedValue({ id: 777 });
    const gradeSpy = vi.spyOn(apiClient, "gradeAttempt").mockResolvedValue({ attempt_id: 901, final_grade: 92 });

    const assessmentId = store.create(null, {
      course: "Informatika",
      className: "X-A",
      backendClassId: 3,
    });
    store.transaction((db) => {
      const target = db.assessments.find((a) => a.id === assessmentId);
      target.backendQuizId = 501;
      target.title = "Ujian Tengah Semester";
      target.state = "published";
      target.releaseMode = "manual";
      target.released = false;
      db.attempts.push({
        id: "at-1",
        backendAttemptId: 901,
        assessmentId,
        studentId: "student-1",
        studentName: "Budi",
        status: "submitted",
        submittedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        score: 0,
        graded: false,
        answers: {},
        flags: [],
      });
    });

    const sourceAssessment = store.db.assessments.find((a) => a.id === assessmentId);
    const copyId = store.duplicate(sourceAssessment);
    await Promise.resolve();
    expect(duplicateSpy).toHaveBeenCalledWith(501);
    const copied = store.db.assessments.find((a) => a.id === copyId);
    expect(copied.backendQuizId).toBe(502);

    store.gradeAttempt("at-1", 92, "Analisis algoritma sangat tepat.");
    expect(gradeSpy).toHaveBeenCalledWith(901, {
      final_grade: 92,
      teacher_feedback: "Analisis algoritma sangat tepat.",
    });
    expect(store.db.attempts.find((x) => x.id === "at-1").score).toBe(92);

    store.releaseResults(assessmentId);
    expect(releaseSpy).toHaveBeenCalledWith(501);
    expect(store.db.assessments.find((a) => a.id === assessmentId).released).toBe(true);

    store.closeAssessment(assessmentId);
    expect(closeSpy).toHaveBeenCalledWith(501);
    expect(store.db.assessments.find((a) => a.id === assessmentId).state).toBe("closed");

    store.archiveAssessment(assessmentId);
    expect(archiveSpy).toHaveBeenCalledWith(501);
    expect(store.db.assessments.find((a) => a.id === assessmentId).state).toBe("archived");

    store.saveBankQuestion({
      id: "bank-new-1",
      topic: "Basis Data",
      text: "Perintah SQL untuk mengambil data adalah...",
      points: 15,
      explanation: "SELECT digunakan untuk mengambil baris dari tabel.",
      options: ["SELECT", "UPDATE", "DELETE", "INSERT"],
      correct: 0,
    });
    expect(bankSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        question_text: "Perintah SQL untuk mengambil data adalah...",
        points: 15,
        explanation: "SELECT digunakan untuk mengambil baris dari tabel.",
        topic: "Basis Data",
      }),
    );
  });

  it("syncs student attempt start, resume saved answers, answer/flag upsert, finish, and review", async () => {
    setStoredToken("live-student-token");
    setStoredSession({
      user: { id: 25, name: "Siti", email: "siti@test.id", role: "student" },
      apiConnected: true,
    });

    const store = useAssessmentStore();
    const attemptStore = useAttemptStore();
    store.setRole("student");

    vi.spyOn(apiClient, "startAttempt").mockResolvedValue({
      id: 3001,
      quiz_id: 88,
      status: "ongoing",
      expires_at: new Date(Date.now() + 1800000).toISOString(),
    });
    vi.spyOn(apiClient, "getAttemptQuestions").mockResolvedValue({
      attempt_id: 3001,
      quiz_id: 88,
      questions: [
        {
          id: 701,
          question_text: "Kompleksitas binary search adalah...",
          question_type: "mcq",
          options: [
            { id: 11, option_label: "A", option_text: "O(1)" },
            { id: 12, option_label: "B", option_text: "O(log n)" },
            { id: 13, option_label: "C", option_text: "O(n)" },
            { id: 14, option_label: "D", option_text: "O(n^2)" },
          ],
        },
      ],
      saved_answers: [
        {
          question_id: 701,
          chosen_option_id: 12,
          is_flagged: true,
        },
      ],
    });
    const submitAnswerSpy = vi.spyOn(apiClient, "submitAnswer").mockResolvedValue({});
    const finishSpy = vi.spyOn(apiClient, "finishAttempt").mockResolvedValue({
      id: 3001,
      final_grade: 100,
    });
    vi.spyOn(apiClient, "getStudentAttemptReview").mockResolvedValue({
      attempt_id: 3001,
      quiz_id: 88,
      final_grade: 100,
      teacher_feedback: "Kerja bagus!",
      release_mode: "immediate",
      results_released: true,
      questions: [
        {
          question_id: 701,
          points: 20,
          explanation: "Binary search membagi ruang pencarian menjadi dua di setiap langkah.",
          options: [
            { id: 11, option_label: "A", option_text: "O(1)", is_correct: false },
            { id: 12, option_label: "B", option_text: "O(log n)", is_correct: true },
            { id: 13, option_label: "C", option_text: "O(n)", is_correct: false },
            { id: 14, option_label: "D", option_text: "O(n^2)", is_correct: false },
          ],
        },
      ],
    });

    let assessment;
    store.transaction((db) => {
      assessment = db.assessments[0];
      assessment.backendQuizId = 88;
      assessment.state = "published";
      assessment.openAt = new Date(Date.now() - 60000).toISOString();
      assessment.closeAt = new Date(Date.now() + 3600000).toISOString();
    });

    const attemptId = store.start(assessment);
    await store.syncAttemptSession(attemptId);

    const updatedAssessment = store.db.assessments.find((a) => a.id === assessment.id);
    const updatedAttempt = store.db.attempts.find((at) => at.id === attemptId);
    const qId = updatedAssessment.questions[0].id;

    expect(updatedAttempt.backendAttemptId).toBe(3001);
    expect(updatedAttempt.answers[qId]).toBe(1);
    expect(updatedAttempt.flags).toContain(qId);

    attemptStore.answer(attemptId, qId, 2);
    expect(submitAnswerSpy).toHaveBeenCalledWith(
      3001,
      expect.objectContaining({
        question_id: 701,
        chosen_option_id: 13,
        replace: true,
        is_flagged: true,
      }),
    );

    attemptStore.flag(attemptId, qId);
    expect(submitAnswerSpy).toHaveBeenCalledWith(
      3001,
      expect.objectContaining({
        question_id: 701,
        chosen_option_id: 13,
        replace: true,
        is_flagged: false,
      }),
    );

    store.submit(attemptId);
    await Promise.resolve();
    expect(finishSpy).toHaveBeenCalledWith(3001);

    await store.syncAttemptReview(attemptId);
    const reviewedAt = store.db.attempts.find((at) => at.id === attemptId);
    const reviewedA = store.db.assessments.find((a) => a.id === assessment.id);
    expect(reviewedAt.feedback).toBe("Kerja bagus!");
    expect(reviewedA.questions[0].explanation).toBe(
      "Binary search membagi ruang pencarian menjadi dua di setiap langkah.",
    );
  });
});
