import { assessmentIssues } from "./assessmentValidation.js";

export const STORAGE_KEY = "kulon-assessment-v1";
export const STUDENT_ID = "student-demo";
export const COURSES = [
  "Jaringan Komputer",
  "Basis Data",
  "Sistem Operasi",
  "Pemrograman Dasar",
];
export const CLASSES = ["Kelas A", "Kelas B", "Kelas C"];
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const clone = (value) => JSON.parse(JSON.stringify(value));
export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function statusOf(a, now = Date.now()) {
  if (a.state === "draft") return "Draft";
  if (a.state === "archived") return "Arsip";
  if (a.state === "closed" || new Date(a.closeAt).getTime() <= now)
    return "Ditutup";
  if (new Date(a.openAt).getTime() > now) return "Terjadwal";
  return "Aktif";
}
export function newQuestion() {
  return {
    id: uid(),
    text: "",
    options: ["", "", "", ""],
    correct: 0,
    points: 1,
    explanation: "",
    source: "manual",
    reviewed: true,
  };
}
export function newAssessment(now = Date.now()) {
  return {
    id: uid(),
    title: "",
    type: "Kuis",
    course: COURSES[0],
    className: CLASSES[0],
    description: "",
    instructions:
      "Pilih satu jawaban yang paling tepat. Periksa jawaban sebelum mengirim.",
    state: "draft",
    openAt: new Date(now).toISOString(),
    closeAt: new Date(now + 7 * 864e5).toISOString(),
    duration: 30,
    releaseMode: "manual",
    released: false,
    questions: [newQuestion()],
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
}
export function validateAssessment(a) {
  return assessmentIssues(a).map((issue) => issue.message);
}
export function saveAssessment(db, a) {
  const next = clone(a);
  next.updatedAt = new Date().toISOString();
  const index = db.assessments.findIndex((x) => x.id === next.id);
  if (index < 0) db.assessments.unshift(next);
  else db.assessments[index] = next;
  return next;
}
export function duplicateAssessment(a) {
  const next = clone(a);
  next.id = uid();
  next.title = `${a.title} (salinan)`;
  next.state = "draft";
  next.released = false;
  next.questions = next.questions.map((q) => ({ ...q, id: uid() }));
  next.createdAt = next.updatedAt = new Date().toISOString();
  return next;
}
export function canStart(
  a,
  attempts,
  now = Date.now(),
  studentId = STUDENT_ID,
) {
  const prior = attempts.find(
    (x) => x.assessmentId === a.id && x.studentId === studentId,
  );
  if (prior?.status === "submitted")
    return {
      allowed: false,
      reason: "Assessment ini sudah dikirim.",
      attempt: prior,
    };
  const status = statusOf(a, now);
  if (status !== "Aktif")
    return {
      allowed: false,
      reason:
        status === "Terjadwal"
          ? "Assessment belum dibuka."
          : "Assessment tidak dapat dikerjakan.",
      attempt: prior,
    };
  if (prior && Date.parse(prior.expiresAt) <= now)
    return {
      allowed: false,
      reason: "Waktu pengerjaan sudah habis.",
      attempt: prior,
    };
  return { allowed: true, attempt: prior };
}
export function startAttempt(a, attempts, now = Date.now()) {
  const permission = canStart(a, attempts, now);
  if (!permission.allowed) throw new Error(permission.reason);
  if (permission.attempt) return permission.attempt;
  const expires = Math.min(
    Date.parse(a.closeAt),
    a.type === "Tugas"
      ? Date.parse(a.closeAt)
      : now + Number(a.duration) * 60e3,
  );
  return {
    id: uid(),
    assessmentId: a.id,
    studentId: STUDENT_ID,
    studentName: "Rani Ayu",
    className: a.className,
    status: "in_progress",
    startedAt: new Date(now).toISOString(),
    expiresAt: new Date(expires).toISOString(),
    answers: {},
    flags: [],
    submittedAt: null,
    score: null,
    feedback: "",
    graded: false,
    attachment: null,
  };
}
export function scoreAttempt(a, attempt) {
  const max = a.questions.reduce((n, q) => n + Number(q.points), 0);
  const earned = a.questions.reduce(
    (n, q) => n + (attempt.answers[q.id] === q.correct ? Number(q.points) : 0),
    0,
  );
  return max ? Math.round((earned / max) * 100) : 0;
}
export function finishAttempt(a, attempt, now = Date.now()) {
  if (attempt.status === "submitted") return attempt;
  if (a.type === "Tugas" && !attempt.attachment)
    throw new Error("Unggah berkas tugas terlebih dahulu.");
  attempt.status = "submitted";
  attempt.submittedAt = new Date(now).toISOString();
  if (a.type !== "Tugas") {
    attempt.score = scoreAttempt(a, attempt);
    attempt.graded = true;
  }
  return attempt;
}
export function visibleScore(a, attempt) {
  return attempt.status === "submitted" &&
    attempt.graded &&
    (a.released || a.releaseMode === "immediate")
    ? attempt.score
    : null;
}
export function csvValue(value) {
  const v = String(value ?? "");
  return (
    '"' + (/^[=+\-@\t\r]/.test(v) ? "'" + v : v).replaceAll('"', '""') + '"'
  );
}
export function exportResults(a, attempts) {
  const rows = [["Nama", "Kelas", "Assessment", "Status", "Nilai", "Dikirim"]];
  attempts
    .filter((x) => x.assessmentId === a.id)
    .forEach((x) =>
      rows.push([
        x.studentName,
        x.className,
        a.title,
        x.status === "submitted" ? "Terkirim" : "Mengerjakan",
        x.graded ? x.score : "Belum dinilai",
        x.submittedAt || "",
      ]),
    );
  return "\uFEFF" + rows.map((row) => row.map(csvValue).join(",")).join("\r\n");
}
