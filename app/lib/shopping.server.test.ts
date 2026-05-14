import { describe, expect, it, beforeEach, vi } from "vitest";

const { dbMock, requireFamilyMembershipMock } = vi.hoisted(() => {
  return {
    dbMock: {
      ingredientCategory: {
        findMany: vi.fn(),
      },
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
    dbMock.ingredientCategory.findMany.mockResolvedValue([
      {
        displayName: "Brod",
        id: "category-bakery",
      },
      {
        displayName: "Frukt og gront",
        id: "category-produce",
      },
      {
        displayName: "Meieri",
        id: "category-dairy",
      },
    ]);
  });

  it("projects deterministic generated and manual shopping items with exact-match merge, overrides, and store ordering", async () => {
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
      manualShoppingItems: [
        {
          buyOnDate: new Date("2026-05-18T00:00:00.000Z"),
          category: {
            displayName: "Meieri",
            id: "category-dairy",
          },
          categoryId: "category-dairy",
          id: "manual-item-1",
          name: "Yoghurt",
          note: "Til frokost",
          preferredStore: {
            id: "store-1",
            name: "Coop Mega",
          },
          preferredStoreId: "store-1",
          quantity: "2 beger",
        },
      ],
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
        {
          checked: true,
          note: null,
          postponedUntilDate: null,
          preferredStore: null,
          preferredStoreId: null,
          sourceKey: "manual-item-1",
          sourceType: "MANUAL",
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
    expect(dbMock.ingredientCategory.findMany).toHaveBeenCalledWith({
      orderBy: [{ displayName: "asc" }],
      select: {
        displayName: true,
        id: true,
      },
    });
    expect(result.categories.map((category) => category.displayName)).toEqual(["Brod", "Frukt og gront", "Meieri"]);
    expect(result.itemCounts).toEqual({
      generated: 4,
      manual: 1,
      total: 5,
    });
    expect(result.stores).toEqual([
      {
        id: "store-1",
        name: "Coop Mega",
      },
      {
        id: "store-2",
        name: "Meny",
      },
    ]);
    expect(result.visibleDates).toEqual(["2026-05-15", "2026-05-16", "2026-05-17", "2026-05-18"]);
    expect(result.projectedItems.map((item) => item.name)).toEqual([
      "Paprika",
      "Yoghurt",
      "Lime",
      "Tortillalefser",
      "Tomater",
    ]);

    const manualItem = result.projectedItems[1];
    const mergedItem = result.projectedItems[3];

    expect(manualItem).toEqual(
      expect.objectContaining({
        buyOnDate: new Date("2026-05-18T00:00:00.000Z"),
        category: {
          id: "category-dairy",
          name: "Meieri",
        },
        checked: true,
        name: "Yoghurt",
        note: "Til frokost",
        preferredStore: {
          id: "store-1",
          name: "Coop Mega",
        },
        quantity: "2 beger",
        quantityLabel: "2 beger",
        sourceKey: "manual-item-1",
        sourceType: "MANUAL",
      }),
    );

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
    if (mergedItem.sourceType !== "GENERATED") {
      throw new Error("Expected a generated shopping item.");
    }
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
    expect(
      result.storeGroups[0]?.sections.flatMap((section) => section.items).find((item) => item.sourceKey === "manual-item-1"),
    ).toEqual(
      expect.objectContaining({
        name: "Yoghurt",
        sourceType: "MANUAL",
      }),
    );
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
      manualShoppingItems: [],
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

    expect(result.itemCounts).toEqual({
      generated: 2,
      manual: 0,
      total: 2,
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
    expect(dbMock.ingredientCategory.findMany).not.toHaveBeenCalled();
  });
});
