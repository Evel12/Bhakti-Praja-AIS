// Integration boundary: await server acknowledgement before committing an API mutation.
import { createLocalRepository } from "./localAssessmentRepository.js";
import { getStoredSession } from "../services/apiClient.js";

function scopedKey(key) {
  if (!globalThis.__AIS_COMBINED_SHELL__) return key;
  const userId = getStoredSession()?.user?.id;
  return userId ? `${key}:u:${userId}` : key;
}

export const repository = createLocalRepository({
  getItem: (key) => localStorage.getItem(scopedKey(key)),
  setItem: (key, value) => localStorage.setItem(scopedKey(key), value),
});
