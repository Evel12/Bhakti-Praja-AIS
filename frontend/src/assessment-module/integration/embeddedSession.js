// Embedded mode: when the assessment app is loaded inside the main AIS
// application (iframe at /assessment-app/ or configured Railway origin),
// the parent hands over the AIS Sanctum token and we exchange it with
// assessment-backend for a verified assessment session.
import { apiClient, setStoredSession, setStoredToken } from "../services/apiClient.js";

const ROLE_MAP = {
  admin: "teacher",
  guru: "teacher",
  teacher: "teacher",
  murid: "student",
  student: "student",
};

export function isEmbeddedMode() {
  return (
    import.meta.env.BASE_URL === "/assessment-app/" ||
    (typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("embedded") === "1")
  );
}

export const embedded = isEmbeddedMode();

export function resolveAllowedOrigins() {
  const configured = String(import.meta.env?.VITE_AIS_ALLOWED_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  if (typeof window !== "undefined" && window.location?.origin) {
    configured.unshift(window.location.origin);
  }
  return [...new Set(configured)];
}

export function resolveTargetParentOrigin(allowedOrigins = resolveAllowedOrigins()) {
  if (typeof document !== "undefined" && document.referrer) {
    try {
      const refOrigin = new URL(document.referrer).origin;
      if (allowedOrigins.includes(refOrigin)) {
        return refOrigin;
      }
    } catch {
      // Ignore invalid referrer URL
    }
  }
  return allowedOrigins.find((origin) => origin !== window?.location?.origin)
    || allowedOrigins[0]
    || (typeof window !== "undefined" ? window.location.origin : "");
}

export function postToParent(payload) {
  if (typeof window === "undefined" || !window.parent || window.parent === window) {
    return;
  }
  const targetOrigin = resolveTargetParentOrigin();
  if (targetOrigin) {
    window.parent.postMessage(payload, targetOrigin);
  }
}

/**
 * Wait for the parent AIS app to post the authenticated session.
 * Exchanges the AIS token against /api/auth/ais-exchange so the SPA is API-connected.
 */
export function initializeEmbeddedSession() {
  if (!isEmbeddedMode() || typeof window === "undefined") return Promise.resolve(false);

  const allowedOrigins = resolveAllowedOrigins();
  const parentOrigin = resolveTargetParentOrigin(allowedOrigins);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (applied) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      clearTimeout(timeout);
      resolve(applied);
    };

    const onMessage = async (event) => {
      if (!allowedOrigins.includes(event.origin)) return;
      const data = event?.data;
      if (!data || data.type !== "ais-session" || !data.user) return;
      const role = ROLE_MAP[data.user.role];
      if (!role) return finish(false);

      if (data.token && !String(data.token).startsWith("local-")) {
        try {
          const exchanged = await apiClient.exchangeAisSession({
            ais_token: data.token,
            device_name: "ais-embedded-bridge",
          });
          if (exchanged?.token && exchanged?.user) {
            setStoredToken(exchanged.token);
            setStoredSession({
              user: { ...exchanged.user, aisRole: data.user.role },
              authMethod: "ais-sso",
              apiConnected: true,
            });
            return finish(true);
          }
        } catch {
          if (!import.meta.env?.DEV) {
            return finish(false);
          }
        }
      }

      if (import.meta.env?.DEV) {
        setStoredToken(data.token || `local-ais-sso-${data.user.id}`);
        setStoredSession({
          user: { ...data.user, aisRole: data.user.role, role },
          authMethod: "ais-sso",
          apiConnected: false,
        });
        return finish(true);
      }

      finish(false);
    };

    const timeout = setTimeout(() => finish(false), 2500);
    window.addEventListener("message", onMessage);
    window.parent?.postMessage({ type: "assessment-ready" }, parentOrigin);
  });
}
