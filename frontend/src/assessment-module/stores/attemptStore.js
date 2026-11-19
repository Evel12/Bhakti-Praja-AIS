import { defineStore } from "pinia";
import { useAssessmentStore } from "./assessmentStore.js";
import { apiClient } from "../services/apiClient.js";

function hasLiveBackendToken() {
  const token = apiClient.getToken();
  return Boolean(token && !String(token).startsWith("local-"));
}

export const useAttemptStore = defineStore("attempt", () => {
  const assessments = useAssessmentStore();

  const answer = (id, qid, value) => {
    assessments.changeAttempt(id, (at) => {
      at.answers[qid] = value;
    });
    if (hasLiveBackendToken()) {
      const at = assessments.db.attempts.find((x) => x.id === id);
      const a = assessments.db.assessments.find((x) => x.id === at?.assessmentId);
      const q = a?.questions?.find((x) => x.id === qid);
      if (at?.backendAttemptId && q?.backendQuestionId) {
        const chosenOptionId = Array.isArray(q.backendOptionIds)
          ? q.backendOptionIds[Number(value)]
          : null;
        if (chosenOptionId != null) {
          apiClient
            .submitAnswer(at.backendAttemptId, {
              question_id: q.backendQuestionId,
              chosen_option_id: chosenOptionId,
              replace: true,
              is_flagged: at.flags.includes(qid),
            })
            .catch(() => {});
        }
      }
    }
  };

  const flag = (id, qid) => {
    let isFlaggedNow = false;
    assessments.changeAttempt(id, (at) => {
      isFlaggedNow = !at.flags.includes(qid);
      at.flags = isFlaggedNow
        ? [...at.flags, qid]
        : at.flags.filter((x) => x !== qid);
    });
    if (hasLiveBackendToken()) {
      const at = assessments.db.attempts.find((x) => x.id === id);
      const a = assessments.db.assessments.find((x) => x.id === at?.assessmentId);
      const q = a?.questions?.find((x) => x.id === qid);
      if (at?.backendAttemptId && q?.backendQuestionId) {
        const currentAnswer = at.answers?.[qid];
        const chosenOptionId =
          currentAnswer !== undefined && Array.isArray(q.backendOptionIds)
            ? q.backendOptionIds[Number(currentAnswer)]
            : null;
        apiClient
          .submitAnswer(at.backendAttemptId, {
            question_id: q.backendQuestionId,
            chosen_option_id: chosenOptionId,
            replace: true,
            is_flagged: isFlaggedNow,
          })
          .catch(() => {});
      }
    }
  };

  return { answer, flag };
});
