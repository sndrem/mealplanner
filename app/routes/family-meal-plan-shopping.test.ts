import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth.server")>("../lib/auth.server");

  return {
    ...actual,
    requireUser: vi.fn(),
  };
});

vi.mock("../lib/shopping.server", () => {
  return {
    getMealPlanShoppingData: vi.fn(),
  };
});

import { requireUser } from "../lib/auth.server";
import { getMealPlanShoppingData } from "../lib/shopping.server";
import { loader } from "./family-meal-plan-shopping";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

function buildRequest(url = "http://localhost/families/family-1/meal-plans/meal-plan-1/shopping") {
  return new Request(url);
}

describe("family meal plan shopping route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads and serializes the server-projected shopping list", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(getMealPlanShoppingData).mockResolvedValue({
      family: {
        id: "family-1",
        name: "Solberg",
      },
      mealPlan: {
        endDate: new Date("2026-05-18T00:00:00.000Z"),
        entries: [],
        id: "meal-plan-1",
        shoppingOverrides: [],
        startDate: new Date("2026-05-15T00:00:00.000Z"),
        status: "DRAFT",
        title: "Langhelg",
      },
      projectedItems: [
        {
          amount: "1",
          category: {
            id: "category-produce",
            name: "Frukt og gront",
          },
          checked: false,
          firstDate: new Date("2026-05-15T00:00:00.000Z"),
          lastDate: new Date("2026-05-16T00:00:00.000Z"),
          name: "Lime",
          note: null,
          occurrenceCount: 1,
          occurrences: [
            {
              date: new Date("2026-05-15T00:00:00.000Z"),
              mealPlanEntryId: "entry-1",
              recipeId: "recipe-1",
              recipeIngredientId: "ingredient-1",
              recipeTitle: "Taco",
            },
          ],
          postponedUntilDate: null,
          preferredStore: {
            id: "store-1",
            name: "Meny",
          },
          quantityLabel: "1 stk",
          section: {
            displayName: "Frukt og gront",
            sortOrder: 1,
          },
          sourceKey: "entry-1:ingredient-1",
          sourceType: "GENERATED",
          unit: "stk",
        },
      ],
      storeGroups: [
        {
          sections: [
            {
              category: {
                id: "category-produce",
                name: "Frukt og gront",
              },
              displayName: "Frukt og gront",
              items: [
                {
                  amount: "1",
                  category: {
                    id: "category-produce",
                    name: "Frukt og gront",
                  },
                  checked: false,
                  firstDate: new Date("2026-05-15T00:00:00.000Z"),
                  lastDate: new Date("2026-05-16T00:00:00.000Z"),
                  name: "Lime",
                  note: null,
                  occurrenceCount: 1,
                  occurrences: [
                    {
                      date: new Date("2026-05-15T00:00:00.000Z"),
                      mealPlanEntryId: "entry-1",
                      recipeId: "recipe-1",
                      recipeIngredientId: "ingredient-1",
                      recipeTitle: "Taco",
                    },
                  ],
                  postponedUntilDate: null,
                  preferredStore: {
                    id: "store-1",
                    name: "Meny",
                  },
                  quantityLabel: "1 stk",
                  section: {
                    displayName: "Frukt og gront",
                    sortOrder: 1,
                  },
                  sourceKey: "entry-1:ingredient-1",
                  sourceType: "GENERATED",
                  unit: "stk",
                },
              ],
            },
          ],
          store: {
            id: "store-1",
            name: "Meny",
          },
        },
      ],
      userRole: "ADMIN",
      visibleDates: ["2026-05-15", "2026-05-16", "2026-05-17", "2026-05-18"],
    });

    const result = await loader({
      params: {
        familyId: "family-1",
        mealPlanId: "meal-plan-1",
      },
      request: buildRequest(),
    });

    expect(getMealPlanShoppingData).toHaveBeenCalledWith({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });
    expect(result).toEqual({
      family: {
        id: "family-1",
        name: "Solberg",
      },
      mealPlan: {
        endDate: "2026-05-18",
        entries: undefined,
        id: "meal-plan-1",
        shoppingOverrides: undefined,
        startDate: "2026-05-15",
        status: "DRAFT",
        title: "Langhelg",
      },
      projectedItemCount: 1,
      storeGroups: [
        {
          sections: [
            {
              category: {
                id: "category-produce",
                name: "Frukt og gront",
              },
              displayName: "Frukt og gront",
              items: [
                {
                  amount: "1",
                  category: {
                    id: "category-produce",
                    name: "Frukt og gront",
                  },
                  checked: false,
                  firstDate: "2026-05-15",
                  lastDate: "2026-05-16",
                  name: "Lime",
                  note: null,
                  occurrenceCount: 1,
                  occurrences: [
                    {
                      date: "2026-05-15",
                      mealPlanEntryId: "entry-1",
                      recipeId: "recipe-1",
                      recipeIngredientId: "ingredient-1",
                      recipeTitle: "Taco",
                    },
                  ],
                  postponedUntilDate: null,
                  preferredStore: {
                    id: "store-1",
                    name: "Meny",
                  },
                  quantityLabel: "1 stk",
                  section: {
                    displayName: "Frukt og gront",
                    sortOrder: 1,
                  },
                  sourceKey: "entry-1:ingredient-1",
                  sourceType: "GENERATED",
                  unit: "stk",
                },
              ],
            },
          ],
          store: {
            id: "store-1",
            name: "Meny",
          },
        },
      ],
      userRole: "ADMIN",
      visibleDates: ["2026-05-15", "2026-05-16", "2026-05-17", "2026-05-18"],
    });
  });
});
