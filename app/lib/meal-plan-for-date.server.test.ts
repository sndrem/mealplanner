import { afterEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    mealPlan: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("./db.server", () => ({
  db: dbMock,
}));

import { findMealPlanCoveringDate } from "./meal-plan-for-date.server";

describe("findMealPlanCoveringDate", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the meal plan that covers the reference date", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      endDate: new Date("2026-05-18T00:00:00.000Z"),
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      status: "DRAFT",
      title: "Uke 20",
    });

    const result = await findMealPlanCoveringDate({
      familyId: "family-1",
      referenceDate: new Date("2026-05-16T12:00:00.000Z"),
    });

    expect(result?.id).toBe("meal-plan-1");
    expect(dbMock.mealPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          familyId: "family-1",
          endDate: {
            gte: new Date("2026-05-16T00:00:00.000Z"),
          },
          startDate: {
            lte: new Date("2026-05-16T00:00:00.000Z"),
          },
        }),
      }),
    );
  });

  it("returns null when no meal plan covers the date", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue(null);

    const result = await findMealPlanCoveringDate({
      familyId: "family-1",
      referenceDate: new Date("2026-05-16T00:00:00.000Z"),
    });

    expect(result).toBeNull();
  });
});
