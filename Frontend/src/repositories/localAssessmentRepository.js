import { STORAGE_KEY, clone } from "../domain/assessment.js";
import { makeSeed } from "../fixtures/seed.js";
const validQuestion = (q) =>
  q &&
  typeof q.id === "string" &&
  typeof q.text === "string" &&
  Array.isArray(q.options) &&
  q.options.every((o) => typeof o === "string");
export function validateDatabase(db) {
  if (
    !db ||
    db.version !== 1 ||
    !["assessments", "attempts", "bank"].every((k) => Array.isArray(db[k]))
  )
    throw new Error(
      "Format data assessment tidak dikenali. Data asli tetap tersimpan.",
    );
  if (
    db.assessments.some(
      (a) =>
        !a ||
        !a.id ||
        typeof a.title !== "string" ||
        !Array.isArray(a.questions) ||
        !a.questions.every(validQuestion) ||
        typeof a.instructions !== "string" ||
        typeof a.course !== "string" ||
        typeof a.className !== "string",
    ) ||
    db.attempts.some(
      (a) =>
        !a ||
        !a.id ||
        !a.assessmentId ||
        !a.answers ||
        typeof a.answers !== "object" ||
        Array.isArray(a.answers) ||
        !Array.isArray(a.flags) ||
        !Number.isFinite(Date.parse(a.expiresAt)),
    ) ||
    !db.bank.every(validQuestion)
  )
    throw new Error(
      "Data assessment tidak lengkap. Pulihkan dari salinan yang valid.",
    );
  return db;
}
export function createLocalRepository(storage) {
  return {
    load() {
      const raw = storage.getItem(STORAGE_KEY);
      return raw === null ? makeSeed() : validateDatabase(JSON.parse(raw));
    },
    raw() {
      return storage.getItem(STORAGE_KEY) || "";
    },
    save(db) {
      storage.setItem(STORAGE_KEY, JSON.stringify(validateDatabase(db)));
    },
    async listAssessments(db) {
      return clone(db.assessments);
    },
    async getAssessment(db, id) {
      return clone(db.assessments.find((a) => a.id === id) || null);
    },
  };
}
