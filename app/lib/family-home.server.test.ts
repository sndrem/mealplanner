import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./db.server", () => ({
  db: {
    mealPlan: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("./family.server", () => ({
  requireFamilyMembership: vi.fn(),
}));

import { db } from "./db.server";
import { requireFamilyMembership } from "./family.server";
import { getFamilyWeekDinnerMenu } from "./family-home.server";

describe("getFamilyWeekDinnerMenu", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("returns dinner labels for each day in the current week", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T12:00:00.000Z"));

    vi.mocked(requireFamilyMembership).mockResolvedValue({
      family: {
        id: "family-1",
        joinCode: "ABC123",
        name: "Solberg",
      },
      familyId: "family-1",
      id: "membership-1",
      role: "ADMIN",
      userId: "user-1",
    });

    vi.mocked(db.mealPlan.findMany).mockResolvedValue([
      {
        endDate: new Date("2026-06-07T00:00:00.000Z"),
        entries: [
          {
            date: new Date("2026-06-04T00:00:00.000Z"),
            note: null,
            recipe: { title: "Taco" },
            recipeId: "recipe-1",
            responsibleUser: { displayName: "Kari" },
          },
          {
            date: new Date("2026-06-05T00:00:00.000Z"),
            note: "Restemat",
            recipe: null,
            recipeId: null,
            responsibleUser: null,
          },
        ],
        id: "meal-plan-1",
        startDate: new Date("2026-06-01T00:00:00.000Z"),
        title: "Uke 23",
      },
    ] as never);

    const result = await getFamilyWeekDinnerMenu({
      familyId: "family-1",
      userId: "user-1",
    });

    expect(result).toHaveLength(7);
    expect(result[3]).toMatchObject({
      date: "2026-06-04",
      isToday: true,
      mealPlanId: "meal-plan-1",
      mealPlanTitle: "Uke 23",
      menuLabel: "Taco",
      responsibleDisplayName: "Kari",
    });
    expect(result[4]).toMatchObject({
      date: "2026-06-05",
      menuLabel: "Restemat",
      responsibleDisplayName: null,
    });
    expect(result[0]).toMatchObject({
      date: "2026-06-01",
      menuLabel: "Ikke planlagt",
    });
    expect(result[6]).toMatchObject({
      date: "2026-06-07",
      menuLabel: "Ikke planlagt",
      mealPlanId: "meal-plan-1",
    });
  });
});
