import test from "node:test";
import assert from "node:assert/strict";
import { assessmentResultRows, classGradeRows } from "../src/domain/resultSummary.js";
import { resultContext } from "../src/utils/resultNavigation.js";

const assessment = (id, course = "Jaringan", className = "Kelas A", state = "published") => ({ id, course, className, state });
const attempt = (assessmentId, score, change = {}) => ({ assessmentId, score, status: "submitted", graded: true, ...change });

test("class averages weight actual submissions and keep identical class names in different courses separate", () => {
  const db = {
    assessments: [assessment("small"), assessment("large"), assessment("b", "Jaringan", "Kelas B"), assessment("other", "Basis Data")],
    attempts: [attempt("small", 0), ...[100, 100, 100].map((score) => attempt("large", score)), attempt("b", 90), attempt("other", 50), attempt("small", null, { graded: false }), attempt("small", 100, { status: "in_progress" })],
  };
  const before = JSON.stringify(db);
  const rows = assessmentResultRows(db);
  const classes = classGradeRows(rows, "Jaringan");
  assert.deepEqual(classes.map(({ className, average, graded, pending }) => ({ className, average, graded, pending })), [
    { className: "Kelas A", average: 75, graded: 4, pending: 1 },
    { className: "Kelas B", average: 90, graded: 1, pending: 0 },
  ]);
  assert.equal(classGradeRows(rows, "Basis Data")[0].average, 50);
  assert.equal(JSON.stringify(db), before);
});

test("draft, archived, orphan and in-progress work cannot inflate result totals", () => {
  const db = {
    assessments: [assessment("live"), assessment("draft", "Jaringan", "Kelas C", "draft"), assessment("archived", "Jaringan", "Kelas D", "archived")],
    attempts: [attempt("live", null, { graded: false }), attempt("live", 100, { status: "in_progress" }), attempt("draft", 100), attempt("archived", 100), attempt("missing", 100)],
  };
  const rows = assessmentResultRows(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].submitted, 1);
  assert.equal(rows[0].graded, 0);
  assert.equal(rows[0].pending, 1);
  assert.equal(rows[0].average, null);
  assert.equal(classGradeRows(rows, "Jaringan").length, 1);
});

test("empty and invalid scores stay missing while a real zero grade remains zero", () => {
  const db = { assessments: [assessment("zero"), assessment("empty", "Jaringan", "Kelas B"), assessment("bad", "Jaringan", "Kelas C")], attempts: [attempt("zero", 0), attempt("bad", null), attempt("bad", NaN), attempt("bad", 101)] };
  const rows = assessmentResultRows(db);
  assert.equal(rows[0].average, 0);
  assert.equal(rows[1].average, null);
  assert.equal(rows[2].average, null);
  assert.deepEqual(classGradeRows(rows, "Nonexistent"), []);
});

test("navigation preserves only scalar class/course context", () => {
  assert.deepEqual(resultContext({ class: "Kelas A", course: "Basis Data", filter: "pending", queue: "pending", other: "x" }), { class: "Kelas A", course: "Basis Data" });
  assert.deepEqual(resultContext({ class: ["Kelas A", "Kelas B"], course: null }), {});
});
