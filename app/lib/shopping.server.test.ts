import { describe, expect, it, beforeEach, vi } from "vitest";

const { dbMock, requireFamilyMembershipMock } = vi.hoisted(() => {
  return {
    dbMock: {
      mealPlan: {
        findFirst: vi.fn(),
      },
      store: {
        findMany: vi.fn(),
      },
    },
    requireFamilyMembershipMock: vi.fn(),
  };
});

vi.mock("./db.server", () => {
  return {
    db: dbMock,
  };
});

vi.mock("./family.server", () => {
  return {
    requireFamilyMembership: requireFamilyMembershipMock,
  };
});

import { getMealPlanShoppingData } from "./shopping.server";

const mockMembership = {
  family: {
    id: "family-1",
    joinCode: "ABC123",
    name: "Solberg",
  },
  familyId: "family-1",
  id: "membership-1",
  role: "ADMIN",
  userId: "user-1",
};

describe("shopping.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireFamilyMembershipMock.mockResolvedValue(mockMembership);
  });

  it("projects deterministic generated shopping items with exact-match merge, overrides, and store ordering", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      endDate: new Date("2026-05-18T00:00:00.000Z"),
      entries: [
        {
          date: new Date("2026-05-15T00:00:00.000Z"),
          id: "entry-1",
          mealType: "DINNER",
          recipe: {
            id: "recipe-1",
            ingredients: [
              {
                amount: "1",
                category: {
                  id: "category-bakery",
                  name: "Brod",
                },
                categoryId: "category-bakery",
                displayName: "Tortillalefser",
                id: "ingredient-1",
                ingredientId: "canonical-tortilla",
                preferredStore: {
                  id: "store-1",
                  name: "Coop Mega",
                },
                preferredStoreId: "store-1",
                sortOrder: 1,
                unit: "pk",
              },
              {
                amount: "1",
                category: {
                  id: "category-produce",
                  name: "Frukt og gront",
                },
                categoryId: "category-produce",
                displayName: "Paprika",
                id: "ingredient-2",
                ingredientId: "canonical-paprika",
                preferredStore: {
                  id: "store-1",
                  name: "Coop Mega",
                },
                preferredStoreId: "store-1",
                sortOrder: 2,
                unit: "stk",
              },
            ],
            title: "Taco",
          },
          recipeId: "recipe-1",
        },
        {
          date: new Date("2026-05-16T00:00:00.000Z"),
          id: "entry-2",
          mealType: "DINNER",
          recipe: {
            id: "recipe-2",
            ingredients: [
              {
                amount: "1",
                category: {
                  id: "category-bakery",
                  name: "Brod",
                },
                categoryId: "category-bakery",
                displayName: "Tortillalefser",
                id: "ingredient-3",
                ingredientId: "canonical-tortilla",
                preferredStore: {
                  id: "store-1",
                  name: "Coop Mega",
                },
                preferredStoreId: "store-1",
                sortOrder: 1,
                unit: "pk",
              },
              {
                amount: "1",
                category: {
                  id: "category-produce",
                  name: "Frukt og gront",
                },
                categoryId: "category-produce",
                displayName: "Lime",
                id: "ingredient-4",
                ingredientId: "canonical-lime",
                preferredStore: {
                  id: "store-2",
                  name: "Meny",
                },
                preferredStoreId: "store-2",
                sortOrder: 2,
                unit: "stk",
              },
              {
                amount: "2",
                category: {
                  id: "category-produce",
                  name: "Frukt og gront",
                },
                categoryId: "category-produce",
                displayName: "Tomater",
                id: "ingredient-5",
                ingredientId: "canonical-tomato",
                preferredStore: null,
                preferredStoreId: null,
                sortOrder: 3,
                unit: "stk",
              },
            ],
            title: "Quesadilla",
          },
          recipeId: "recipe-2",
        },
      ],
      id: "meal-plan-1",
      shoppingOverrides: [
        {
          checked: true,
          note: "Kjop pa tilbud",
          postponedUntilDate: new Date("2026-05-16T00:00:00.000Z"),
          preferredStore: {
            id: "store-2",
            name: "Meny",
          },
          preferredStoreId: "store-2",
          sourceKey: "entry-1:ingredient-1|entry-2:ingredient-3",
          sourceType: "GENERATED",
        },
      ],
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      status: "DRAFT",
      title: "Langhelg",
    });
    dbMock.store.findMany.mockResolvedValue([
      {
        familyId: null,
        id: "store-1",
        name: "Coop Mega",
        sections: [
          {
            categoryId: "category-produce",
            displayName: "Frukt og gront",
            id: "section-1",
            sortOrder: 1,
          },
          {
            categoryId: "category-bakery",
            displayName: "Brod",
            id: "section-2",
            sortOrder: 2,
          },
        ],
      },
      {
        familyId: null,
        id: "store-2",
        name: "Meny",
        sections: [
          {
            categoryId: "category-produce",
            displayName: "Frukt og gront",
            id: "section-3",
            sortOrder: 1,
          },
          {
            categoryId: "category-bakery",
            displayName: "Brod",
            id: "section-4",
            sortOrder: 2,
          },
        ],
      },
    ]);

    const result = await getMealPlanShoppingData({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(requireFamilyMembershipMock).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(dbMock.mealPlan.findFirst).toHaveBeenCalledWith({
      select: expect.objectContaining({
        endDate: true,
        entries: expect.objectContaining({
          orderBy: [{ date: "asc" }, { id: "asc" }],
          where: {
            mealType: "DINNER",
          },
        }),
      }),
      where: {
        familyId: "family-1",
        id: "meal-plan-1",
      },
    });
    expect(dbMock.store.findMany).toHaveBeenCalledWith({
      orderBy: [{ name: "asc" }],
      select: expect.objectContaining({
        id: true,
        name: true,
        sections: expect.objectContaining({
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        }),
      }),
      where: {
        OR: [{ familyId: null }, { familyId: "family-1" }],
      },
    });
    expect(result.visibleDates).toEqual(["2026-05-15", "2026-05-16", "2026-05-17", "2026-05-18"]);
    expect(result.projectedItems.map((item) => item.name)).toEqual([
      "Paprika",
      "Lime",
      "Tortillalefser",
      "Tomater",
    ]);

    const mergedItem = result.projectedItems[2];

    expect(mergedItem).toEqual(
      expect.objectContaining({
        checked: true,
        name: "Tortillalefser",
        note: "Kjop pa tilbud",
        occurrenceCount: 2,
        postponedUntilDate: new Date("2026-05-16T00:00:00.000Z"),
        preferredStore: {
          id: "store-2",
          name: "Meny",
        },
        quantityLabel: "1 pk",
        section: {
          displayName: "Brod",
          sortOrder: 2,
        },
        sourceKey: "entry-1:ingredient-1|entry-2:ingredient-3",
        sourceType: "GENERATED",
      }),
    );
    expect(mergedItem.occurrences).toEqual([
      {
        date: new Date("2026-05-15T00:00:00.000Z"),
        mealPlanEntryId: "entry-1",
        recipeId: "recipe-1",
        recipeIngredientId: "ingredient-1",
        recipeTitle: "Taco",
      },
      {
        date: new Date("2026-05-16T00:00:00.000Z"),
        mealPlanEntryId: "entry-2",
        recipeId: "recipe-2",
        recipeIngredientId: "ingredient-3",
        recipeTitle: "Quesadilla",
      },
    ]);
    expect(result.storeGroups).toHaveLength(3);
    expect(result.storeGroups.map((group) => group.store?.name ?? "Ingen valgt butikk")).toEqual([
      "Coop Mega",
      "Meny",
      "Ingen valgt butikk",
    ]);
    expect(result.storeGroups[1]?.sections.map((section) => section.displayName)).toEqual([
      "Frukt og gront",
      "Brod",
    ]);
  });

  it("keeps generated items separate when exact-match fields differ", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      endDate: new Date("2026-05-18T00:00:00.000Z"),
      entries: [
        {
          date: new Date("2026-05-15T00:00:00.000Z"),
          id: "entry-1",
          mealType: "DINNER",
          recipe: {
            id: "recipe-1",
            ingredients: [
              {
                amount: "1",
                category: {
                  id: "category-dairy",
                  name: "Meieri",
                },
                categoryId: "category-dairy",
                displayName: "Yoghurt",
                id: "ingredient-1",
                ingredientId: "canonical-yoghurt",
                preferredStore: {
                  id: "store-1",
                  name: "Coop Mega",
                },
                preferredStoreId: "store-1",
                sortOrder: 1,
                unit: "beger",
              },
            ],
            title: "Frokostbolle",
          },
          recipeId: "recipe-1",
        },
        {
          date: new Date("2026-05-16T00:00:00.000Z"),
          id: "entry-2",
          mealType: "DINNER",
          recipe: {
            id: "recipe-2",
            ingredients: [
              {
                amount: "2",
                category: {
                  id: "category-dairy",
                  name: "Meieri",
                },
                categoryId: "category-dairy",
                displayName: "Yoghurt",
                id: "ingredient-2",
                ingredientId: "canonical-yoghurt",
                preferredStore: {
                  id: "store-1",
                  name: "Coop Mega",
                },
                preferredStoreId: "store-1",
                sortOrder: 1,
                unit: "beger",
              },
            ],
            title: "Parfait",
          },
          recipeId: "recipe-2",
        },
      ],
      id: "meal-plan-1",
      shoppingOverrides: [],
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      status: "DRAFT",
      title: "Langhelg",
    });
    dbMock.store.findMany.mockResolvedValue([
      {
        familyId: null,
        id: "store-1",
        name: "Coop Mega",
        sections: [
          {
            categoryId: "category-dairy",
            displayName: "Meieri",
            id: "section-1",
            sortOrder: 1,
          },
        ],
      },
    ]);

    const result = await getMealPlanShoppingData({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result.projectedItems).toHaveLength(2);
    expect(result.projectedItems.map((item) => item.sourceKey)).toEqual([
      "entry-1:ingredient-1",
      "entry-2:ingredient-2",
    ]);
    expect(result.projectedItems.map((item) => item.quantityLabel)).toEqual(["1 beger", "2 beger"]);
  });

  it("throws a not-found response when the meal plan is outside the family scope", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue(null);

    await expect(
      getMealPlanShoppingData({
        familyId: "family-1",
        mealPlanId: "meal-plan-404",
        userId: "user-1",
      }),
    ).rejects.toMatchObject({
      status: 404,
      statusText: "Not Found",
    });

    expect(dbMock.store.findMany).not.toHaveBeenCalled();
  });
});
