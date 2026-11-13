import test from "node:test";
import assert from "node:assert/strict";
import {
  buildClassFilterOptions,
  formatSortValue,
  matchesClassFilter,
  nextColumnSort,
  parseSortValue,
  sortAssessments,
} from "../src/domain/assessmentSort.js";

const NOW = Date.parse("2026-11-13T08:00:00.000Z");

const SAMPLE = [
  {
    id: "a-closed",
    title: "Kuis Basis Data",
    course: "Basis Data",
    className: "Kelas B",
    state: "published",
    openAt: "2026-11-01T01:00:00.000Z",
    closeAt: "2026-11-10T01:00:00.000Z",
  },
  {
    id: "a-draft",
    title: "Draft Algoritma",
    course: "Pemrograman Dasar",
    className: "Kelas A",
    state: "draft",
    openAt: "2026-11-12T01:00:00.000Z",
    closeAt: "2026-11-20T01:00:00.000Z",
  },
  {
    id: "a-active",
    title: "Evaluasi Jaringan",
    course: "Jaringan Komputer",
    className: "Kelas A",
    state: "published",
    openAt: "2026-11-10T01:00:00.000Z",
    closeAt: "2026-11-15T01:00:00.000Z",
  },
  {
    id: "a-sched",
    title: "Ujian Sistem Operasi",
    course: "Sistem Operasi",
    className: "Kelas C",
    state: "published",
    openAt: "2026-11-14T01:00:00.000Z",
    closeAt: "2026-11-18T01:00:00.000Z",
  },
];

const ATTEMPTS = [
  { assessmentId: "a-closed", status: "submitted" },
  { assessmentId: "a-closed", status: "submitted" },
  { assessmentId: "a-closed", status: "submitted" },
  { assessmentId: "a-active", status: "submitted" },
  { assessmentId: "a-active", status: "in_progress" },
];

test("default sort preserves incoming store order", () => {
  const sorted = sortAssessments(SAMPLE, ATTEMPTS, { key: "default", dir: "asc" }, NOW);
  assert.deepEqual(
    sorted.map((x) => x.id),
    ["a-closed", "a-draft", "a-active", "a-sched"],
  );
});

test("sorts by title ascending and descending", () => {
  const asc = sortAssessments(SAMPLE, ATTEMPTS, { key: "title", dir: "asc" }, NOW);
  assert.deepEqual(
    asc.map((x) => x.id),
    ["a-draft", "a-active", "a-closed", "a-sched"],
  );
  const desc = sortAssessments(SAMPLE, ATTEMPTS, { key: "title", dir: "desc" }, NOW);
  assert.deepEqual(
    desc.map((x) => x.id),
    ["a-sched", "a-closed", "a-active", "a-draft"],
  );
});

test("sorts by teacher status rank (Aktif -> Terjadwal -> Draft -> Ditutup) and reversed", () => {
  const asc = sortAssessments(SAMPLE, ATTEMPTS, { key: "status", dir: "asc" }, NOW);
  assert.deepEqual(
    asc.map((x) => x.id),
    ["a-active", "a-sched", "a-draft", "a-closed"],
  );
  const desc = sortAssessments(SAMPLE, ATTEMPTS, { key: "status", dir: "desc" }, NOW);
  assert.deepEqual(
    desc.map((x) => x.id),
    ["a-closed", "a-draft", "a-sched", "a-active"],
  );
});

test("sorts by deadline while sinking invalid deadlines to bottom", () => {
  const withInvalid = [...SAMPLE, { id: "a-nodate", title: "Tanpa tanggal", state: "draft" }];
  const asc = sortAssessments(withInvalid, ATTEMPTS, { key: "closeAt", dir: "asc" }, NOW);
  assert.deepEqual(
    asc.map((x) => x.id),
    ["a-closed", "a-active", "a-sched", "a-draft", "a-nodate"],
  );
  const desc = sortAssessments(withInvalid, ATTEMPTS, { key: "closeAt", dir: "desc" }, NOW);
  assert.deepEqual(
    desc.map((x) => x.id),
    ["a-draft", "a-sched", "a-active", "a-closed", "a-nodate"],
  );
});

test("sorts by submitted attempt count descending and ascending", () => {
  const desc = sortAssessments(SAMPLE, ATTEMPTS, { key: "submitted", dir: "desc" }, NOW);
  assert.deepEqual(
    desc.map((x) => x.id),
    ["a-closed", "a-active", "a-draft", "a-sched"],
  );
  const asc = sortAssessments(SAMPLE, ATTEMPTS, { key: "submitted", dir: "asc" }, NOW);
  // Draft & sched both have 0 -> tie-broken by title ('Draft Algoritma' < 'Ujian Sistem Operasi')
  assert.deepEqual(
    asc.map((x) => x.id),
    ["a-draft", "a-sched", "a-active", "a-closed"],
  );
});

test("cycles column sort state and formats/parses dropdown values cleanly", () => {
  assert.deepEqual(nextColumnSort("default", "asc", "closeAt"), { key: "closeAt", dir: "asc" });
  assert.deepEqual(nextColumnSort("closeAt", "asc", "closeAt"), { key: "closeAt", dir: "desc" });
  assert.deepEqual(nextColumnSort("closeAt", "desc", "closeAt"), { key: "default", dir: "asc" });
  assert.deepEqual(nextColumnSort("default", "asc", "submitted"), { key: "submitted", dir: "desc" });
  assert.deepEqual(nextColumnSort("submitted", "desc", "submitted"), { key: "submitted", dir: "asc" });
  assert.deepEqual(nextColumnSort("submitted", "asc", "submitted"), { key: "default", dir: "asc" });

  assert.equal(formatSortValue("closeAt", "desc"), "closeAt:desc");
  assert.equal(formatSortValue("default", "asc"), "default");
  assert.deepEqual(parseSortValue("submitted:desc"), { key: "submitted", dir: "desc" });
  assert.deepEqual(parseSortValue("unknown:desc"), { key: "default", dir: "asc" });
});

test("builds class filter options from non-archived assessments and matches course or pair", () => {
  const items = [
    ...SAMPLE,
    { id: "a-arch", course: "Arsip", className: "Kelas Z", state: "archived" },
  ];
  const opts = buildClassFilterOptions(items);
  assert.equal(opts[0].value, "");
  assert.ok(opts.some((o) => o.value === "course::Basis Data"));
  assert.ok(opts.some((o) => o.value === "pair::Basis Data::Kelas B"));
  assert.ok(!opts.some((o) => o.value.includes("Arsip")));

  assert.equal(matchesClassFilter(SAMPLE[0], "course::Basis Data"), true);
  assert.equal(matchesClassFilter(SAMPLE[0], "pair::Basis Data::Kelas B"), true);
  assert.equal(matchesClassFilter(SAMPLE[0], "pair::Basis Data::Kelas A"), false);
});
