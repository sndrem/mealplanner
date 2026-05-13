import { describe, expect, it } from "vitest";

import { action } from "./logout";

describe("logout route action", () => {
  it("clears the session and redirects to the home page", async () => {
    const request = new Request("http://localhost/logout", {
      method: "POST",
    });

    const response = await action({
      params: {},
      request,
      context: {} as never,
    } as unknown as Parameters<typeof action>[0]);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/");
    expect(response.headers.get("Set-Cookie")).toContain("__mealplanner_session=");
  });
});
