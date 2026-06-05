import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth.server")>(
    "../lib/auth.server",
  );

  return {
    ...actual,
    requireUser: vi.fn(),
  };
});

vi.mock("../lib/family.server", () => ({
  requireFamilyMembership: vi.fn(),
}));

import { requireUser } from "../lib/auth.server";
import { requireFamilyMembership } from "../lib/family.server";
import { loader } from "./family-meal-plan-store-mode-redirect";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

describe("family-meal-plan-store-mode redirect route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects legacy meal-plan store-mode URLs to the family canonical URL", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(requireFamilyMembership).mockResolvedValue({
      family: { id: "family-1", name: "Solberg" },
      role: "ADMIN",
    } as never);

    try {
      await loader({
        params: {
          familyId: "family-1",
          mealPlanId: "meal-plan-old",
        },
        request: new Request(
          "http://localhost/families/family-1/meal-plans/meal-plan-old/store-mode?notice=selected-store-updated",
        ),
      } as never);
      expect.fail("Expected redirect");
    } catch (response) {
      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      expect((response as Response).headers.get("Location")).toBe(
        "/families/family-1/store-mode?notice=selected-store-updated",
      );
    }
  });
});
