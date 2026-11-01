import { assessmentFieldId } from "../domain/assessmentValidation.js";

export function useAssessmentFields(issues, questionId = () => undefined) {
  function issue(name) {
    return issues().find((item) => item.field === name && item.questionId === questionId());
  }
  function field(name) {
    const id = assessmentFieldId(name, questionId());
    return {
      id,
      "aria-invalid": issue(name) ? "true" : undefined,
      "aria-describedby": issue(name) ? `${id}-error` : undefined,
    };
  }
  return { field, issue };
}
