// Integration boundary: await server acknowledgement before committing an API mutation.
import { createLocalRepository } from "./localAssessmentRepository.js";
import { embedded, sessionUser } from '../integration/session.js';
const storageKey = key => embedded ? `ais.assessment.${sessionUser?.id}.${key}` : key;
export const repository = createLocalRepository({
  getItem: (key) => localStorage.getItem(storageKey(key)),
  setItem: (key, value) => localStorage.setItem(storageKey(key), value),
});
