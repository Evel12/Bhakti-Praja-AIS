import test from "node:test";
import assert from "node:assert/strict";
import {
  buildClassFieldOptions,
  buildClassFilterHierarchy,
  findMatchingLmsClass,
  matchesSelectedClass,
  parseLmsClassName,
} from "../src/domain/classSync.js";

test("parseLmsClassName parses combined labels, raw CLASSES, and standalone subject names", () => {
  assert.deepEqual(parseLmsClassName("Jaringan Komputer · Kelas B"), {
    course: "Jaringan Komputer",
    className: "Kelas B",
  });
  assert.deepEqual(parseLmsClassName("Kelas C", { course: "Basis Data" }), {
    course: "Basis Data",
    className: "Kelas C",
  });
  assert.deepEqual(parseLmsClassName("Demo Mathematics"), {
    course: "Demo Mathematics",
    className: "Kelas A",
  });
});

test("findMatchingLmsClass resolves by backendClassId, combined name, or course", () => {
  const classes = [
    { id: 1, name: "Demo Mathematics", class_code: "DEMO11" },
    { id: 2, name: "Biologi X · Kelas B", class_code: "BIO22" },
  ];

  assert.equal(findMatchingLmsClass(classes, { backendClassId: 2 })?.id, 2);
  assert.equal(
    findMatchingLmsClass(classes, { course: "Biologi X", className: "Kelas B" })?.id,
    2,
  );
  assert.equal(
    findMatchingLmsClass(classes, { course: "Demo Mathematics", className: "Kelas A" })?.id,
    1,
  );
  assert.equal(
    findMatchingLmsClass(classes, { course: "Kimia", className: "Kelas C" }),
    null,
  );
});

test("buildClassFilterHierarchy merges LMS classes into Pilih Kelas options and matchesSelectedClass filters accurately", () => {
  const hierarchy = buildClassFilterHierarchy({
    assessments: [
      { id: "a1", course: "Jaringan Komputer", className: "Kelas A", state: "published" },
    ],
    lmsClasses: [
      { id: 10, name: "Biologi XI · Kelas D", class_code: "BIOX" },
      { id: 11, name: "Demo Mathematics", class_code: "MATH" },
    ],
  });

  const bio = hierarchy.find((c) => c.name === "Biologi XI");
  assert.ok(bio);
  assert.equal(bio.classes[0].name, "Semua Biologi XI");
  assert.equal(bio.classes[1].name, "Kelas D");
  assert.equal(bio.classes[1].classId, 10);

  const math = hierarchy.find((c) => c.name === "Demo Mathematics");
  assert.ok(math);

  assert.equal(
    matchesSelectedClass(
      { backendClassId: 10, course: "Other", className: "Other" },
      bio.classes[1],
    ),
    true,
  );
  assert.equal(
    matchesSelectedClass(
      { course: "Biologi XI", className: "Kelas D" },
      bio.classes[1],
    ),
    true,
  );
  assert.equal(
    matchesSelectedClass(
      { course: "Basis Data", className: "Kelas A" },
      bio.classes[1],
    ),
    false,
  );
});

test("buildClassFieldOptions exposes synced LMS courses, classes, and quick class options", () => {
  const result = buildClassFieldOptions({
    assessments: [{ course: "Basis Data", className: "Kelas B", state: "published" }],
    lmsClasses: [{ id: 5, name: "Fisika XII · Kelas Unggulan", class_code: "FIS12" }],
    draft: { course: "Kimia", className: "Kelas Khusus" },
  });

  assert.ok(result.courses.includes("Fisika XII"));
  assert.ok(result.courses.includes("Kimia"));
  assert.ok(result.classes.includes("Kelas Unggulan"));
  assert.ok(result.classes.includes("Kelas Khusus"));
  assert.equal(result.lmsClassOptions[0].id, 5);
  assert.equal(result.lmsClassOptions[0].course, "Fisika XII");
});
