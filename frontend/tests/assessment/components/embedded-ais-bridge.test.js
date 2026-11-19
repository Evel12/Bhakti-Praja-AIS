import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, getStoredSession, getStoredToken } from "../../../src/assessment-module/services/apiClient.js";
import { initializeEmbeddedSession } from "../../../src/assessment-module/integration/embeddedSession.js";

describe("Embedded AIS SSO Session Bridge", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/?embedded=1");
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
    vi.restoreAllMocks();
  });

  it("exchanges parent AIS Sanctum token via /api/auth/ais-exchange and connects live API session", async () => {
    const exchangeSpy = vi.spyOn(apiClient, "exchangeAisSession").mockResolvedValue({
      token: "assessment-sanctum-token-99",
      user: {
        id: 15,
        name: "Ibu Sari",
        email: "sari@bhaktiprajabatang.sch.id",
        role: "teacher",
        aisRole: "guru",
      },
    });
    const postSpy = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});

    const sessionPromise = initializeEmbeddedSession();
    expect(postSpy).toHaveBeenCalledWith({ type: "assessment-ready" }, window.location.origin);

    // Reject untrusted origins silently
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://evil.example.test",
        data: {
          type: "ais-session",
          token: "spoofed-token",
          user: { id: 1, name: "Attacker", email: "x@evil.test", role: "guru" },
        },
      }),
    );

    // Accept trusted same-origin AIS session message
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: window.location.origin,
        data: {
          type: "ais-session",
          token: "ais-parent-sanctum-token",
          user: { id: 15, name: "Ibu Sari", email: "sari@bhaktiprajabatang.sch.id", role: "guru" },
        },
      }),
    );

    const applied = await sessionPromise;
    expect(applied).toBe(true);
    expect(exchangeSpy).toHaveBeenCalledWith({
      ais_token: "ais-parent-sanctum-token",
      device_name: "ais-embedded-bridge",
    });
    expect(getStoredToken()).toBe("assessment-sanctum-token-99");
    expect(getStoredSession()).toEqual({
      user: {
        id: 15,
        name: "Ibu Sari",
        email: "sari@bhaktiprajabatang.sch.id",
        role: "teacher",
        aisRole: "guru",
      },
      authMethod: "ais-sso",
      apiConnected: true,
    });
  });
});
