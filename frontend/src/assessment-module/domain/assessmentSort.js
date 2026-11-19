import { statusOf } from "./assessment.js";

export const ASSESSMENT_SORT_OPTIONS = [
  { value: "default", label: "Urutan bawaan" },
  { value: "closeAt:asc", label: "Deadline terdekat" },
  { value: "closeAt:desc", label: "Deadline terjauh" },
  { value: "submitted:desc", label: "Terkirim terbanyak" },
  { value: "submitted:asc", label: "Terkirim tersedikit" },
  { value: "title:asc", label: "Judul (A–Z)" },
  { value: "title:desc", label: "Judul (Z–A)" },
  { value: "status:asc", label: "Status (Aktif dulu)" },
  { value: "status:desc", label: "Status (Ditutup dulu)" },
];

const STATUS_RANK = {
  Aktif: 0,
  Terjadwal: 1,
  Draft: 2,
  Ditutup: 3,
  Arsip: 4,
};

const VALID_KEYS = new Set(["default", "title", "status", "closeAt", "submitted"]);

export function parseSortValue(value) {
  if (!value || value === "default") return { key: "default", dir: "asc" };
  const [rawKey, rawDir] = String(value).split(":");
  const key = VALID_KEYS.has(rawKey) ? rawKey : "default";
  if (key === "default") return { key: "default", dir: "asc" };
  const dir = rawDir === "desc" ? "desc" : "asc";
  return { key, dir };
}

export function formatSortValue(key, dir = "asc") {
  if (!key || key === "default" || !VALID_KEYS.has(key)) return "default";
  return `${key}:${dir === "desc" ? "desc" : "asc"}`;
}

export function nextColumnSort(currentKey, currentDir, clickedKey) {
  if (!VALID_KEYS.has(clickedKey) || clickedKey === "default") {
    return { key: "default", dir: "asc" };
  }
  const initialDir = clickedKey === "submitted" ? "desc" : "asc";
  if (currentKey !== clickedKey) {
    return { key: clickedKey, dir: initialDir };
  }
  if (currentDir === initialDir) {
    return { key: clickedKey, dir: initialDir === "asc" ? "desc" : "asc" };
  }
  return { key: "default", dir: "asc" };
}

export function submittedCountsByAssessment(attempts = []) {
  const counts = new Map();
  for (const attempt of attempts) {
    if (attempt?.status !== "submitted" || !attempt?.assessmentId) continue;
    counts.set(attempt.assessmentId, (counts.get(attempt.assessmentId) ?? 0) + 1);
  }
  return counts;
}

function compareText(a, b) {
  return String(a || "").localeCompare(String(b || ""), "id", {
    sensitivity: "base",
    numeric: true,
  });
}

function titleOf(assessment) {
  return assessment?.title || "Draft tanpa judul";
}

export function sortAssessments(items = [], attempts = [], sort = {}, now = Date.now()) {
  const list = [...items];
  const key = VALID_KEYS.has(sort?.key) ? sort.key : "default";
  if (key === "default") return list;

  const factor = sort?.dir === "desc" ? -1 : 1;
  const counts = key === "submitted" ? submittedCountsByAssessment(attempts) : null;
  const originalOrder = new Map(list.map((item, idx) => [item?.id ?? idx, idx]));

  return list.sort((a, b) => {
    let diff = 0;

    if (key === "title") {
      diff = compareText(titleOf(a), titleOf(b)) * factor;
    } else if (key === "status") {
      const rankA = STATUS_RANK[statusOf(a, now)] ?? 99;
      const rankB = STATUS_RANK[statusOf(b, now)] ?? 99;
      diff = (rankA - rankB) * factor;
    } else if (key === "closeAt") {
      const timeA = Date.parse(a?.closeAt);
      const timeB = Date.parse(b?.closeAt);
      const validA = Number.isFinite(timeA);
      const validB = Number.isFinite(timeB);
      if (validA !== validB) return validA ? -1 : 1;
      if (validA && validB) diff = (timeA - timeB) * factor;
    } else if (key === "submitted") {
      const countA = counts.get(a?.id) ?? 0;
      const countB = counts.get(b?.id) ?? 0;
      diff = (countA - countB) * factor;
    }

    if (diff !== 0) return diff;
    const byTitle = compareText(titleOf(a), titleOf(b));
    if (byTitle !== 0) return byTitle;
    return (originalOrder.get(a?.id) ?? 0) - (originalOrder.get(b?.id) ?? 0);
  });
}

export function buildClassFilterOptions(assessments = []) {
  const byCourse = new Map();
  for (const item of assessments) {
    if (!item || item.state === "archived") continue;
    const course = String(item.course || "").trim();
    const className = String(item.className || "").trim();
    if (!course) continue;
    if (!byCourse.has(course)) byCourse.set(course, new Set());
    if (className) byCourse.get(course).add(className);
  }

  const options = [{ value: "", label: "Semua kelas" }];
  const sortedCourses = [...byCourse.keys()].sort((a, b) => compareText(a, b));

  for (const course of sortedCourses) {
    options.push({
      value: `course::${course}`,
      label: `${course} (Semua kelas)`,
    });
    const sortedClasses = [...byCourse.get(course)].sort((a, b) => compareText(a, b));
    for (const className of sortedClasses) {
      options.push({
        value: `pair::${course}::${className}`,
        label: `${course} · ${className}`,
      });
    }
  }
  return options;
}

export function matchesClassFilter(assessment, classFilterValue) {
  if (!classFilterValue) return true;
  if (classFilterValue.startsWith("course::")) {
    const course = classFilterValue.slice("course::".length);
    return assessment?.course === course;
  }
  if (classFilterValue.startsWith("pair::")) {
    const rest = classFilterValue.slice("pair::".length);
    const sep = rest.indexOf("::");
    if (sep < 0) return true;
    const course = rest.slice(0, sep);
    const className = rest.slice(sep + 2);
    return assessment?.course === course && assessment?.className === className;
  }
  return true;
}

export function describeClassFilter(classFilterValue) {
  if (!classFilterValue) return "";
  if (classFilterValue.startsWith("course::")) {
    return `${classFilterValue.slice("course::".length)} (Semua kelas)`;
  }
  if (classFilterValue.startsWith("pair::")) {
    const rest = classFilterValue.slice("pair::".length);
    const sep = rest.indexOf("::");
    if (sep >= 0) return `${rest.slice(0, sep)} · ${rest.slice(sep + 2)}`;
  }
  return classFilterValue;
}
