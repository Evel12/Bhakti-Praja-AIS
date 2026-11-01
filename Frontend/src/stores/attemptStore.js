import { defineStore } from "pinia";
import { useAssessmentStore } from "./assessmentStore.js";
export const useAttemptStore = defineStore("attempt", () => {
  const assessments = useAssessmentStore();
  const answer = (id, qid, value) =>
    assessments.changeAttempt(id, (at) => {
      at.answers[qid] = value;
    });
  const flag = (id, qid) =>
    assessments.changeAttempt(id, (at) => {
      at.flags = at.flags.includes(qid)
        ? at.flags.filter((x) => x !== qid)
        : [...at.flags, qid];
    });
  return { answer, flag };
});
