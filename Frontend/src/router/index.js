import { createRouter, createWebHashHistory } from "vue-router";
import { getStoredSession, getStoredToken } from "../services/apiClient.js";
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
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/login" },
    {
      path: "/login",
      name: "login",
      component: () => import("../views/auth/LoginView.vue"),
      meta: { auth: true },
    },
    {
      path: "/reset-password",
      name: "reset-password",
      component: () => import("../views/auth/ResetPasswordView.vue"),
      meta: { auth: true },
    },
    {
      path: "/motion-lab",
      component: () => import("../views/MotionLabView.vue"),
    },
    ...routes,
    { path: "/:pathMatch(.*)*", redirect: "/login" },
  ],
  scrollBehavior: (to, from) =>
    (to.meta.assessmentList && from.meta.assessmentList)
      || (to.path === from.path && to.path.startsWith('/results'))
      ? false : { top: 0 },
});

router.beforeEach((to) => {
  if (to.meta.auth || to.path === "/motion-lab") {
    return true;
  }

  const token = getStoredToken();
  if (!token) {
    return "/login";
  }

  const session = getStoredSession();
  const role = session?.user?.role;
  if (role === "student" && !to.meta.student) {
    return "/student";
  }
  if (role === "teacher" && to.meta.student) {
    return "/dashboard";
  }

  return true;
});

export default router;
