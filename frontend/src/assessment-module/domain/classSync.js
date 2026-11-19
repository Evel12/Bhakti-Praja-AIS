import { CLASSES, COURSES } from "./assessment.js";

function uniqueNonEmpty(values) {
  const seen = new Set();
  const list = [];
  for (const raw of values) {
    const val = String(raw || "").trim();
    if (!val || seen.has(val)) continue;
    seen.add(val);
    list.push(val);
  }
  return list;
}

export function parseLmsClassName(rawName, existing = {}) {
  const trimmed = String(rawName || "").trim();
  const fallbackCourse = existing?.course || COURSES[3] || "Pemrograman Dasar";
  const fallbackClass =
    existing?.className && CLASSES.includes(existing.className)
      ? existing.className
      : CLASSES[0] || "Kelas A";

  if (!trimmed) {
    return { course: fallbackCourse, className: fallbackClass };
  }

  const separatorMatch = trimmed.match(/^(.+?)\s+[·•-]\s+(.+)$/);
  if (separatorMatch) {
    const left = separatorMatch[1].trim();
    const right = separatorMatch[2].trim();
    if (left && right) {
      return { course: left, className: right };
    }
  }

  if (CLASSES.includes(trimmed)) {
    return {
      course:
        existing?.course && existing.course !== trimmed
          ? existing.course
          : fallbackCourse,
      className: trimmed,
    };
  }

  return {
    course: trimmed,
    className: fallbackClass,
  };
}

export function formatLmsClassLabel(course, className) {
  const c = String(course || "").trim();
  const cls = String(className || "").trim();
  if (c && cls) return `${c} · ${cls}`;
  return c || cls || "";
}

export function findMatchingLmsClass(lmsClasses = [], criteria = {}) {
  const list = Array.isArray(lmsClasses) ? lmsClasses : [];
  if (!list.length) return null;

  if (criteria.backendClassId != null) {
    const byId = list.find((c) => Number(c.id) === Number(criteria.backendClassId));
    if (byId) return byId;
  }

  const course = String(criteria.course || "").trim().toLowerCase();
  const className = String(criteria.className || "").trim().toLowerCase();
  const combined = formatLmsClassLabel(criteria.course, criteria.className).toLowerCase();

  if (combined) {
    const exactCombined = list.find(
      (c) => String(c.name || "").trim().toLowerCase() === combined,
    );
    if (exactCombined) return exactCombined;
  }

  if (course && className) {
    const parsedMatch = list.find((c) => {
      const parsed = parseLmsClassName(c.name);
      return (
        parsed.course.toLowerCase() === course &&
        parsed.className.toLowerCase() === className
      );
    });
    if (parsedMatch) return parsedMatch;
  }

  if (course) {
    const byCourseName = list.find(
      (c) => String(c.name || "").trim().toLowerCase() === course,
    );
    if (byCourseName) return byCourseName;
  }

  if (className) {
    const byClassOnly = list.find(
      (c) => String(c.name || "").trim().toLowerCase() === className,
    );
    if (byClassOnly) return byClassOnly;
  }

  return null;
}

export function matchesSelectedClass(assessment, selectedClass) {
  if (!selectedClass || selectedClass.code === "all") return true;
  if (
    selectedClass.classId != null &&
    assessment?.backendClassId != null &&
    Number(assessment.backendClassId) === Number(selectedClass.classId)
  ) {
    return true;
  }

  const { course, className } = selectedClass;
  if (course && course !== "all" && assessment?.course !== course) {
    return false;
  }
  if (className && className !== "all" && assessment?.className !== className) {
    return false;
  }
  return true;
}

export function buildClassFilterHierarchy({ assessments = [], lmsClasses = [] } = {}) {
  const activeAssessments = (Array.isArray(assessments) ? assessments : []).filter(
    (a) => a && a.state !== "archived",
  );
  const classList = Array.isArray(lmsClasses) ? lmsClasses : [];

  const coursesOrder = [];
  const courseSet = new Set();
  const classesByCourse = new Map();
  const lmsMetaByPair = new Map();

  const ensureCourse = (courseName) => {
    const name = String(courseName || "").trim();
    if (!name) return null;
    if (!courseSet.has(name)) {
      courseSet.add(name);
      coursesOrder.push(name);
      classesByCourse.set(name, new Set());
    }
    return classesByCourse.get(name);
  };

  for (const defaultCourse of COURSES) {
    const bucket = ensureCourse(defaultCourse);
    CLASSES.forEach((cls) => bucket.add(cls));
  }

  for (const a of activeAssessments) {
    const bucket = ensureCourse(a.course);
    if (bucket && a.className) {
      bucket.add(String(a.className).trim());
    }
  }

  for (const schoolClass of classList) {
    const parsed = parseLmsClassName(schoolClass?.name);
    const bucket = ensureCourse(parsed.course);
    if (bucket && parsed.className) {
      bucket.add(parsed.className);
      const pairKey = `${parsed.course}::${parsed.className}`;
      if (!lmsMetaByPair.has(pairKey)) {
        lmsMetaByPair.set(pairKey, {
          classId: schoolClass.id,
          classCode: schoolClass.class_code || "",
          lmsClassName: schoolClass.name,
        });
      }
    }
  }

  const globalExtraClasses = uniqueNonEmpty([
    ...CLASSES,
    ...activeAssessments.map((a) => a.className),
  ]);

  return coursesOrder.map((course) => {
    const courseBucket = classesByCourse.get(course) || new Set();
    if (COURSES.includes(course)) {
      globalExtraClasses.forEach((cls) => courseBucket.add(cls));
    }
    const sorted = Array.from(courseBucket).sort((a, b) =>
      a.localeCompare(b, "id", { numeric: true }),
    );
    return {
      name: course,
      code: course,
      classes: [
        {
          name: `Semua ${course}`,
          code: `${course}:all`,
          course,
          className: "all",
        },
        ...sorted.map((cls) => {
          const meta = lmsMetaByPair.get(`${course}::${cls}`);
          return {
            name: cls,
            code: `${course}:${cls}`,
            course,
            className: cls,
            ...(meta ? { classId: meta.classId, classCode: meta.classCode } : {}),
          };
        }),
      ],
    };
  });
}

export function buildClassFieldOptions({
  assessments = [],
  lmsClasses = [],
  draft = null,
} = {}) {
  const activeAssessments = (Array.isArray(assessments) ? assessments : []).filter(
    (a) => a && a.state !== "archived",
  );
  const classList = Array.isArray(lmsClasses) ? lmsClasses : [];

  const parsedLms = classList.map((c) => ({
    id: c.id,
    name: c.name,
    class_code: c.class_code || "",
    ...parseLmsClassName(c.name),
  }));

  const courses = uniqueNonEmpty([
    ...COURSES,
    ...parsedLms.map((c) => c.course),
    ...activeAssessments.map((a) => a.course),
    draft?.course,
  ]);

  const classes = uniqueNonEmpty([
    ...CLASSES,
    ...parsedLms.map((c) => c.className),
    ...activeAssessments.map((a) => a.className),
    draft?.className,
  ]);

  return {
    courses,
    classes,
    lmsClassOptions: parsedLms,
  };
}
