import { describe, expect, it } from "vitest";

import { getSafeRedirectTo, hashPassword, requireUser, verifyPassword } from "./auth.server";

describe("auth.server", () => {
  it("hashes and verifies passwords", async () => {
    const passwordHash = await hashPassword("super-secret-password");

    await expect(verifyPassword("super-secret-password", passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", passwordHash)).resolves.toBe(false);
  });

  it("rejects unsafe redirect targets", () => {
    expect(getSafeRedirectTo("/app?tab=overview")).toBe("/app?tab=overview");
    expect(getSafeRedirectTo("https://example.com")).toBe("/app");
    expect(getSafeRedirectTo("//example.com")).toBe("/app");
    expect(getSafeRedirectTo(null, "/login")).toBe("/login");
  });

  it("redirects unauthenticated users to login with the original path", async () => {
    const request = new Request("http://localhost/app?tab=overview");

    try {
      await requireUser(request);
      throw new Error("Expected requireUser to redirect");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);

      const response = error as Response;

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login?redirectTo=%2Fapp%3Ftab%3Doverview");
    }
  });
});
