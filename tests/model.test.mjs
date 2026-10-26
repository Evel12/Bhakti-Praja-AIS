import test from "node:test";
import assert from "node:assert/strict";
import {
  newAssessment,
  newQuestion,
  validateAssessment,
  statusOf,
  startAttempt,
  finishAttempt,
  visibleScore,
  duplicateAssessment,
  exportResults,
  STUDENT_ID,
} from "../src/domain/assessment.js";
import { makeSeed } from "../src/fixtures/seed.js";
const now = Date.UTC(2026, 9, 18, 12);
test("AI questions cannot be published without review and incomplete answers are rejected", () => {
  const a = newAssessment(now);
  a.title = "Kuis";
  a.questions = [
    {
      ...newQuestion(),
      text: "Contoh?",
      options: ["A", "B", "", "D"],
      correct: 1,
      source: "ai",
      reviewed: false,
    },
  ];
  assert.ok(validateAssessment(a).some((x) => x.includes("pilihan")));
  assert.ok(validateAssessment(a).some((x) => x.includes("Tinjau")));
  a.questions[0].options[2] = "C";
  a.questions[0].reviewed = true;
  assert.deepEqual(validateAssessment(a), []);
});
test("starting again resumes the original attempt without resetting its timer", () => {
  const { assessments } = makeSeed(now),
    a = assessments[0];
  const first = startAttempt(a, [], now);
  const again = startAttempt(a, [first], now + 120000);
  assert.strictEqual(first, again);
  assert.equal(again.expiresAt, first.expiresAt);
  assert.throws(() => startAttempt(a, [first], now + 30 * 60e3), /habis/);
});
test("submission is idempotent and scores remain hidden until released", () => {
  const a = makeSeed(now).assessments[0],
    at = startAttempt(a, [], now);
  at.answers = Object.fromEntries(a.questions.map((q) => [q.id, q.correct]));
  finishAttempt(a, at, now + 1000);
  assert.equal(at.score, 100);
  assert.equal(visibleScore(a, at), null);
  const submittedAt = at.submittedAt;
  finishAttempt(a, at, now + 3000);
  assert.equal(at.submittedAt, submittedAt);
  assert.throws(() => startAttempt(a, [at], now + 4000), /sudah dikirim/);
  a.released = true;
  assert.equal(visibleScore(a, at), 100);
});
test("scheduled, closed and draft assessments cannot be started", () => {
  const seed = makeSeed(now);
  assert.equal(statusOf(seed.assessments[2], now), "Terjadwal");
  for (const i of [2, 3, 4])
    assert.throws(() => startAttempt(seed.assessments[i], [], now));
});
test("assignments require an uploaded file and wait for manual grading", () => {
  const a = makeSeed(now).assessments[1],
    at = startAttempt(a, [], now);
  assert.throws(() => finishAttempt(a, at, now), /Unggah/);
  at.attachment = { name: "tugas.pdf" };
  finishAttempt(a, at, now);
  assert.equal(at.graded, false);
  assert.equal(at.score, null);
});
test("duplicates have independent question IDs and return to draft", () => {
  const source = makeSeed(now).assessments[0],
    copy = duplicateAssessment(source);
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.state, "draft");
  assert.notEqual(copy.questions[0].id, source.questions[0].id);
  copy.questions[0].text = "Perubahan";
  assert.notEqual(source.questions[0].text, copy.questions[0].text);
});
test("CSV quotes cells and neutralizes spreadsheet formulas", () => {
  const a = makeSeed(now).assessments[0],
    at = {
      assessmentId: a.id,
      studentId: STUDENT_ID,
      studentName: '=HYPERLINK("x")',
      className: "A",
      status: "submitted",
      graded: true,
      score: 100,
    };
  const csv = exportResults(a, [at]);
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));
  assert.ok(csv.startsWith("\uFEFF"));
});
