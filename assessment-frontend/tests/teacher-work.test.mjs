import test from "node:test";
import assert from "node:assert/strict";
import { makeSeed } from "../src/fixtures/seed.js";
import { clone } from "../src/domain/assessment.js";
import { dashboardWork, gradingQueue } from "../src/domain/teacherWork.js";

const now = Date.UTC(2026, 9, 29, 5);
test("grading queue sorts oldest outstanding work first and excludes completed, in-progress and archived work", () => {
  const db = makeSeed(now);
  const assignment = db.assessments.find((a) => a.type === "Tugas");
  db.assessments.push({ ...clone(assignment), id: "older", title: "Tugas lama" });
  db.attempts.push({ ...clone(db.attempts.find((at) => at.assessmentId === assignment.id)), id: "older-attempt", assessmentId: "older", submittedAt: new Date(now - 10 * 864e5).toISOString() });
  db.attempts.find((at) => at.id === "task-seed-0").graded = true;
  db.attempts.find((at) => at.id === "task-seed-1").status = "in_progress";
  const before = JSON.stringify(db);
  const queue = gradingQueue(db);
  assert.deepEqual(queue.map((entry) => entry.assessment.id), ["older", assignment.id]);
  assert.deepEqual(queue[1].attempts.map((at) => at.id), ["task-seed-2"]);
  assert.equal(JSON.stringify(db), before, "sorting must not mutate stored order");
  db.assessments.find((a) => a.id === "older").state = "archived";
  assert.deepEqual(gradingQueue(db).map((entry) => entry.assessment.id), [assignment.id]);
});

test("dashboard ranks pending grading, then deadlines, then recently edited drafts", () => {
  const db = makeSeed(now);
  const existingDraft = db.assessments.find((a) => a.state === "draft");
  existingDraft.updatedAt = new Date(now - 864e5).toISOString();
  db.assessments.unshift({ ...clone(existingDraft), id: "recent-draft", updatedAt: new Date(now).toISOString() });
  const work = dashboardWork(db, now);
  assert.equal(work[0].kind, "grading");
  assert.equal(work[0].to, "/grade/task-seed-0?queue=pending");
  assert.deepEqual(work.filter((entry) => entry.kind === "deadline").map((entry) => entry.assessment.id), ["as-network", "as-programming", "as-midterm"]);
  assert.deepEqual(work.filter((entry) => entry.kind === "draft").map((entry) => entry.assessment.id), ["recent-draft", existingDraft.id]);
  assert.equal(new Set(work.map((entry) => entry.assessment.id)).size, work.length);
  assert.equal(work.some((entry) => entry.assessment.id === "as-security"), false);
});
