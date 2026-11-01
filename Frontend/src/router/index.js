import { createRouter, createWebHashHistory } from "vue-router";
const routes = [
  ["/dashboard", () => import("../views/teacher/DashboardView.vue")],
  ["/assessments/:status?", () => import("../views/teacher/AssessmentListView.vue")],
  ["/builder/:id", () => import("../views/teacher/AssessmentBuilderView.vue")],
  ["/bank", () => import("../views/teacher/QuestionBankView.vue")],
  ["/results/:id?", () => import("../views/teacher/ResultsView.vue")],
  ["/grade/:id", () => import("../views/teacher/AssignmentGradeView.vue")],
  ["/student", () => import("../views/student/StudentAssessmentView.vue")],
  ["/instructions/:id", () => import("../views/student/AssessmentInstructionsView.vue")],
  ["/attempt/:id", () => import("../views/student/AttemptView.vue")],
  ["/review/:id", () => import("../views/student/AttemptReviewView.vue")],
  ["/my-results", () => import("../views/student/MyResultsView.vue")],
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
