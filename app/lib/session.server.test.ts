import { describe, expect, it } from "vitest";

import { createUserSession, destroyUserSession, getUserId } from "./session.server";

describe("session.server", () => {
  it("stores and reads the current user id from the session cookie", async () => {
    const request = new Request("http://localhost/login");
    const response = await createUserSession({
      request,
      userId: "user-123",
      redirectTo: "/app",
    });
    const cookie = response.headers.get("Set-Cookie");

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/app");
    expect(cookie).toBeTruthy();

    const authenticatedRequest = new Request("http://localhost/app", {
      headers: {
        Cookie: cookie ?? "",
      },
    });

    await expect(getUserId(authenticatedRequest)).resolves.toBe("user-123");
  });

  it("destroys the session cookie on logout", async () => {
    const request = new Request("http://localhost/logout");
    const response = await destroyUserSession({
      request,
      redirectTo: "/",
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/");
    expect(response.headers.get("Set-Cookie")).toContain("__mealplanner_session=");
  });
});
