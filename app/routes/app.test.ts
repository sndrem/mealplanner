import { describe, expect, it } from "vitest";

import { loader } from "./app";

describe("app route loader", () => {
  it("redirects unauthenticated requests to login", async () => {
    const request = new Request("http://localhost/app");

    try {
      await loader({
        params: {},
        request,
        context: {} as never,
      } as unknown as Parameters<typeof loader>[0]);
      throw new Error("Expected loader to redirect");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);

      const response = error as Response;

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login?redirectTo=%2Fapp");
    }
  });
});
