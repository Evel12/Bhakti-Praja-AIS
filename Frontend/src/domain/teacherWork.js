import { statusOf } from "./assessment.js";

const timestamp = (value, fallback = Infinity) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
export function gradingQueue(db) {
  return db.assessments
    .filter((a) => !["draft", "archived"].includes(a.state))
    .map((assessment) => ({
      assessment,
      attempts: db.attempts
        .filter((at) => at.assessmentId === assessment.id && at.status === "submitted" && !at.graded)
        .sort((a, b) => timestamp(a.submittedAt) - timestamp(b.submittedAt) || a.id.localeCompare(b.id)),
    }))
    .filter((entry) => entry.attempts.length)
    .sort((a, b) => timestamp(a.attempts[0].submittedAt) - timestamp(b.attempts[0].submittedAt)
      || timestamp(a.assessment.closeAt) - timestamp(b.assessment.closeAt)
      || a.assessment.id.localeCompare(b.assessment.id));
}
export function gradingDestination(assessment, attempt) {
  return assessment.type === "Tugas"
    ? `/grade/${attempt.id}?queue=pending`
    : `/results/${assessment.id}?filter=pending`;
}
export function dashboardWork(db, now = Date.now()) {
  const queue = gradingQueue(db);
  const pendingIds = new Set(queue.map((entry) => entry.assessment.id));
  const grading = queue.map(({ assessment, attempts }) => ({
    assessment,
    reason: `${attempts.length} pengumpulan perlu dinilai`,
    action: assessment.type === "Tugas" ? "Nilai tugas" : "Cek pengumpulan",
    to: gradingDestination(assessment, attempts[0]),
    kind: "grading",
  }));
  const deadlines = db.assessments
    .filter((a) => !pendingIds.has(a.id) && ["Aktif", "Terjadwal"].includes(statusOf(a, now)))
    .sort((a, b) => timestamp(a.closeAt) - timestamp(b.closeAt) || a.id.localeCompare(b.id))
    .map((assessment) => ({
      assessment,
      reason: "Tenggat terdekat",
      action: "Pantau assessment",
      to: `/results/${assessment.id}`,
      kind: "deadline",
    }));
  const drafts = db.assessments
    .filter((a) => a.state === "draft")
    .sort((a, b) => timestamp(b.updatedAt, 0) - timestamp(a.updatedAt, 0) || a.id.localeCompare(b.id))
    .map((assessment) => ({
      assessment,
      reason: "Draft belum diterbitkan",
      action: "Lanjutkan draft",
      to: `/builder/${assessment.id}`,
      kind: "draft",
    }));
  return [...grading, ...deadlines, ...drafts];
}
