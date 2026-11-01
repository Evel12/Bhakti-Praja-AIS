// Integration boundary: await server acknowledgement before committing an API mutation.
import { createLocalRepository } from "./localAssessmentRepository.js";
export const repository = createLocalRepository({
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
});
