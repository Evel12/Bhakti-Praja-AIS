import { createRouter, createWebHashHistory } from "vue-router";
import DashboardView from "../views/teacher/DashboardView.vue";
import AssessmentListView from "../views/teacher/AssessmentListView.vue";
import AssessmentBuilderView from "../views/teacher/AssessmentBuilderView.vue";
import QuestionBankView from "../views/teacher/QuestionBankView.vue";
import ResultsView from "../views/teacher/ResultsView.vue";
import AssignmentGradeView from "../views/teacher/AssignmentGradeView.vue";
import StudentAssessmentView from "../views/student/StudentAssessmentView.vue";
import AssessmentInstructionsView from "../views/student/AssessmentInstructionsView.vue";
import AttemptView from "../views/student/AttemptView.vue";
import AttemptReviewView from "../views/student/AttemptReviewView.vue";
import MyResultsView from "../views/student/MyResultsView.vue";
const routes = [
  ["/dashboard", DashboardView],
  ["/assessments/:status?", AssessmentListView],
  ["/builder/:id", AssessmentBuilderView],
  ["/bank", QuestionBankView],
  ["/results/:id?", ResultsView],
  ["/grade/:id", AssignmentGradeView],
  ["/student", StudentAssessmentView],
  ["/instructions/:id", AssessmentInstructionsView],
  ["/attempt/:id", AttemptView],
  ["/review/:id", AttemptReviewView],
  ["/my-results", MyResultsView],
].map(([path, component]) => ({
  path,
  component,
  meta: {
    assessmentList: path === "/assessments/:status?",
    student: /^\/(student|instructions|attempt|review|my-results)/.test(path),
    exam: path.startsWith("/attempt"),
  },
}));
export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/dashboard" },
    {
      path: "/motion-lab",
      component: () => import("../views/MotionLabView.vue"),
    },
    ...routes,
    { path: "/:pathMatch(.*)*", redirect: "/dashboard" },
  ],
  scrollBehavior: (to, from) =>
    (to.meta.assessmentList && from.meta.assessmentList)
      || (to.path === from.path && to.path.startsWith('/results'))
      ? false : { top: 0 },
});
