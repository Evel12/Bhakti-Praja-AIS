// Embedded mode: when the assessment app is loaded inside the main AIS
// application (iframe at /assessment-app/), the parent hands over the
// authenticated AIS session. Query parameters never determine a role.
import { setStoredSession, setStoredToken } from "../services/apiClient.js";

const ROLE_MAP = {
  admin: "teacher",
  guru: "teacher",
  teacher: "teacher",
  murid: "student",
  student: "student",
};

export const embedded =
  import.meta.env.BASE_URL === "/assessment-app/" ||
  (typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("embedded") === "1");

/**
 * Wait for the parent AIS app to post the authenticated session.
 * Resolves true when a valid session was applied, false when the
 * app should fall back to its own login screen.
 */
export function initializeEmbeddedSession() {
  if (!embedded || typeof window === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (applied) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      clearTimeout(timeout);
      resolve(applied);
    };
    const onMessage = (event) => {
      // Only trust messages from the same origin (the AIS host app).
      if (event.origin !== window.location.origin) return;
      const data = event?.data;
      if (!data || data.type !== "ais-session" || !data.user) return;
      const role = ROLE_MAP[data.user.role];
      if (!role) return finish(false);
      setStoredToken(data.token || "embedded-ais-session");
      setStoredSession({
        user: { ...data.user, role },
        authMethod: "ais-sso",
        apiConnected: false,
      });
      finish(true);
    };
    const timeout = setTimeout(() => finish(false), 2500);
    window.addEventListener("message", onMessage);
    window.parent?.postMessage({ type: "assessment-ready" }, window.location.origin);
  });
}
