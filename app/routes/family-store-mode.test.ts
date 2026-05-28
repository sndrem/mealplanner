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

vi.mock("../lib/meal-plan-for-date.server", () => ({
  findMealPlanCoveringDate: vi.fn(),
}));

vi.mock("../lib/db.server", () => ({
  db: {
    mealPlan: {
      findFirst: vi.fn(),
    },
  },
}));

import { requireUser } from "../lib/auth.server";
import { db } from "../lib/db.server";
import { requireFamilyMembership } from "../lib/family.server";
import { findMealPlanCoveringDate } from "../lib/meal-plan-for-date.server";
import { loader } from "./family-store-mode";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

describe("family-store-mode redirect route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to store mode for today's meal plan", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(requireFamilyMembership).mockResolvedValue({
      family: { id: "family-1", name: "Solberg" },
      role: "ADMIN",
    } as never);
    vi.mocked(findMealPlanCoveringDate).mockResolvedValue({
      endDate: new Date("2026-05-18T00:00:00.000Z"),
      id: "meal-plan-today",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      status: "DRAFT",
      title: "Uke 20",
    });

    try {
      await loader({
        params: { familyId: "family-1" },
        request: new Request("http://localhost/families/family-1/store-mode"),
      } as never);
      expect.fail("Expected redirect");
    } catch (response) {
      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      expect((response as Response).headers.get("Location")).toBe(
        "/families/family-1/meal-plans/meal-plan-today/store-mode",
      );
    }
  });

  it("falls back to the latest meal plan when none covers today", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(requireFamilyMembership).mockResolvedValue({
      family: { id: "family-1", name: "Solberg" },
      role: "ADMIN",
    } as never);
    vi.mocked(findMealPlanCoveringDate).mockResolvedValue(null);
    vi.mocked(db.mealPlan.findFirst).mockResolvedValue({
      id: "meal-plan-latest",
    } as never);

    try {
      await loader({
        params: { familyId: "family-1" },
        request: new Request("http://localhost/families/family-1/store-mode"),
      } as never);
    } catch (response) {
      expect((response as Response).headers.get("Location")).toBe(
        "/families/family-1/meal-plans/meal-plan-latest/store-mode",
      );
    }
  });

  it("redirects to meal plans when the family has none", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(requireFamilyMembership).mockResolvedValue({
      family: { id: "family-1", name: "Solberg" },
      role: "ADMIN",
    } as never);
    vi.mocked(findMealPlanCoveringDate).mockResolvedValue(null);
    vi.mocked(db.mealPlan.findFirst).mockResolvedValue(null);

    try {
      await loader({
        params: { familyId: "family-1" },
        request: new Request("http://localhost/families/family-1/store-mode"),
      } as never);
    } catch (response) {
      expect((response as Response).headers.get("Location")).toBe(
        "/families/family-1/meal-plans",
      );
    }
  });
});
