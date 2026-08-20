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

vi.mock("./r2.server", () => ({
  getRecipeImageUrl: vi.fn((imageKey: string | null | undefined) =>
    imageKey ? `https://images.example.com/${imageKey}` : null,
  ),
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
            recipe: {
              imageKey: "families/family-1/recipes/recipe-1/cover.jpg",
              title: "Taco",
            },
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
          {
            date: new Date("2026-06-06T00:00:00.000Z"),
            note: null,
            recipe: {
              imageKey: null,
              title: "Pasta",
            },
            recipeId: "recipe-2",
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
      imageUrl:
        "https://images.example.com/families/family-1/recipes/recipe-1/cover.jpg",
      isToday: true,
      mealPlanId: "meal-plan-1",
      mealPlanTitle: "Uke 23",
      menuLabel: "Taco",
      responsibleDisplayName: "Kari",
    });
    expect(result[4]).toMatchObject({
      date: "2026-06-05",
      imageUrl: null,
      menuLabel: "Restemat",
      responsibleDisplayName: null,
    });
    expect(result[5]).toMatchObject({
      date: "2026-06-06",
      imageUrl: null,
      menuLabel: "Pasta",
    });
    expect(result[0]).toMatchObject({
      date: "2026-06-01",
      imageUrl: null,
      menuLabel: "Ikke planlagt",
    });
    expect(result[6]).toMatchObject({
      date: "2026-06-07",
      imageUrl: null,
      menuLabel: "Ikke planlagt",
      mealPlanId: "meal-plan-1",
    });
  });
});
