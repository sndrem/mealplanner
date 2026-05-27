import { afterEach, describe, expect, it, beforeEach, vi } from "vitest";

const { dbMock, getFamilyStockMatchSetMock, requireFamilyMembershipMock } =
  vi.hoisted(() => {
    return {
      dbMock: {
        familyShoppingItem: {
          findMany: vi.fn(),
        },
        ingredientCategory: {
          findMany: vi.fn(),
        },
        manualShoppingItem: {
          findMany: vi.fn(),
        },
        mealPlan: {
          findFirst: vi.fn(),
        },
        store: {
          findMany: vi.fn(),
        },
        userStorePreference: {
          findUnique: vi.fn(),
        },
      },
      getFamilyStockMatchSetMock: vi.fn(),
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

vi.mock("./stock.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stock.server")>();

  return {
    ...actual,
    getFamilyStockMatchSet: getFamilyStockMatchSetMock,
  };
});

import {
  getMealPlanShoppingData,
  getMealPlanStoreModeData,
  listRecentManualShoppingItemsForFamily,
} from "./shopping.server";

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
    getFamilyStockMatchSetMock.mockResolvedValue({
      displayNameNormalized: new Set(),
      ingredientIds: new Set(),
    });
    dbMock.userStorePreference.findUnique.mockResolvedValue(null);
    dbMock.familyShoppingItem.findMany.mockResolvedValue([]);
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
      activeShoppingDate: new Date("2026-05-16T00:00:00.000Z"),
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
          updatedAt: new Date("2026-05-15T00:00:00.000Z"),
        },
      ],
      shoppingOverrides: [
        {
          checked: true,
          includeDespiteStock: false,
          note: "Kjøp på tilbud",
          postponedUntilDate: new Date("2026-05-16T00:00:00.000Z"),
          preferredStore: {
            id: "store-2",
            name: "Meny",
          },
          preferredStoreId: "store-2",
          sourceKey: "entry-1:ingredient-1|entry-2:ingredient-3",
          sourceType: "GENERATED",
          updatedAt: new Date("2026-05-15T10:00:00.000Z"),
        },
        {
          checked: true,
          includeDespiteStock: false,
          note: null,
          postponedUntilDate: null,
          preferredStore: null,
          preferredStoreId: null,
          sourceKey: "manual-item-1",
          sourceType: "MANUAL",
          updatedAt: new Date("2026-05-15T11:00:00.000Z"),
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
      family: 0,
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
        note: "Kjøp på tilbud",
        occurrenceCount: 2,
        postponedUntilDate: new Date("2026-05-16T00:00:00.000Z"),
        preferredStore: {
          id: "store-2",
          name: "Meny",
        },
        quantityLabel: "2 pk",
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
        amount: "1",
        date: new Date("2026-05-15T00:00:00.000Z"),
        mealPlanEntryId: "entry-1",
        quantityLabel: "1 pk",
        recipeId: "recipe-1",
        recipeIngredientId: "ingredient-1",
        recipeTitle: "Taco",
        unit: "pk",
      },
      {
        amount: "1",
        date: new Date("2026-05-16T00:00:00.000Z"),
        mealPlanEntryId: "entry-2",
        quantityLabel: "1 pk",
        recipeId: "recipe-2",
        recipeIngredientId: "ingredient-3",
        recipeTitle: "Quesadilla",
        unit: "pk",
      },
    ]);
    expect(mergedItem.preferredStoreConflict).toBe(false);
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

  it("merges canonical ingredients across recipes with different amounts", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      activeShoppingDate: null,
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
      family: 0,
      generated: 1,
      manual: 0,
      total: 1,
    });
    expect(result.projectedItems).toHaveLength(1);

    const mergedYoghurt = result.projectedItems[0];

    if (mergedYoghurt.sourceType !== "GENERATED") {
      throw new Error("Expected a generated shopping item.");
    }

    expect(mergedYoghurt).toEqual(
      expect.objectContaining({
        name: "Yoghurt",
        occurrenceCount: 2,
        quantityLabel: "3 beger",
        sourceKey: "entry-1:ingredient-1|entry-2:ingredient-2",
        sourceType: "GENERATED",
      }),
    );
    expect(mergedYoghurt.occurrences.map((occurrence) => occurrence.quantityLabel)).toEqual([
      "1 beger",
      "2 beger",
    ]);
  });

  it("merges canonical ingredients with different ingredient records by normalized name and unit", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      activeShoppingDate: null,
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
                  id: "category-produce",
                  name: "Frukt og gront",
                },
                categoryId: "category-produce",
                displayName: "Agurk",
                id: "ingredient-1",
                ingredientId: "canonical-cucumber-a",
                preferredStore: null,
                preferredStoreId: null,
                sortOrder: 1,
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
                amount: "2",
                category: {
                  id: "category-produce",
                  name: "Frukt og gront",
                },
                categoryId: "category-produce",
                displayName: "agurk",
                id: "ingredient-2",
                ingredientId: "canonical-cucumber-b",
                preferredStore: null,
                preferredStoreId: null,
                sortOrder: 1,
                unit: "stk",
              },
            ],
            title: "Salat",
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
            categoryId: "category-produce",
            displayName: "Frukt og gront",
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

    expect(result.projectedItems).toHaveLength(1);

    const mergedCucumber = result.projectedItems[0];

    if (mergedCucumber.sourceType !== "GENERATED") {
      throw new Error("Expected a generated shopping item.");
    }

    expect(mergedCucumber).toEqual(
      expect.objectContaining({
        name: "Agurk",
        occurrenceCount: 2,
        quantityLabel: "3 stk",
        recipeCount: 2,
      }),
    );
  });

  it("sums identical units when the same recipe is planned on multiple days", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      activeShoppingDate: null,
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
                  displayName: "Frukt og gront",
                  id: "category-produce",
                },
                categoryId: "category-produce",
                displayName: "Løk",
                id: "ingredient-1",
                ingredientId: "canonical-onion",
                preferredStore: null,
                preferredStoreId: null,
                sortOrder: 1,
                unit: "stk",
              },
            ],
            title: "Lapskaus",
          },
          recipeId: "recipe-1",
        },
        {
          date: new Date("2026-05-16T00:00:00.000Z"),
          id: "entry-2",
          mealType: "DINNER",
          recipe: {
            id: "recipe-1",
            ingredients: [
              {
                amount: "1",
                category: {
                  displayName: "Frukt og gront",
                  id: "category-produce",
                },
                categoryId: "category-produce",
                displayName: "Løk",
                id: "ingredient-2",
                ingredientId: "canonical-onion",
                preferredStore: null,
                preferredStoreId: null,
                sortOrder: 1,
                unit: "stk",
              },
            ],
            title: "Lapskaus",
          },
          recipeId: "recipe-1",
        },
      ],
      id: "meal-plan-1",
      manualShoppingItems: [],
      shoppingOverrides: [],
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      status: "DRAFT",
      title: "Langhelg",
    });
    dbMock.store.findMany.mockResolvedValue([]);

    const result = await getMealPlanShoppingData({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result.projectedItems).toHaveLength(1);
    expect(result.projectedItems[0]).toEqual(
      expect.objectContaining({
        name: "Løk",
        occurrenceCount: 2,
        quantityLabel: "2 stk",
      }),
    );
  });

  it("merges canonical ingredients with different preferred stores and flags conflict", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      activeShoppingDate: null,
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
                  id: "category-produce",
                  name: "Frukt og gront",
                },
                categoryId: "category-produce",
                displayName: "Agurk",
                id: "ingredient-1",
                ingredientId: "canonical-cucumber",
                preferredStore: {
                  id: "store-1",
                  name: "Coop Mega",
                },
                preferredStoreId: "store-1",
                sortOrder: 1,
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
                  id: "category-produce",
                  name: "Frukt og gront",
                },
                categoryId: "category-produce",
                displayName: "Agurk",
                id: "ingredient-2",
                ingredientId: "canonical-cucumber",
                preferredStore: {
                  id: "store-2",
                  name: "Meny",
                },
                preferredStoreId: "store-2",
                sortOrder: 1,
                unit: "stk",
              },
            ],
            title: "Salat",
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
        sections: [],
      },
      {
        familyId: null,
        id: "store-2",
        name: "Meny",
        sections: [],
      },
    ]);

    const result = await getMealPlanShoppingData({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result.projectedItems).toHaveLength(1);

    const mergedCucumber = result.projectedItems[0];

    if (mergedCucumber.sourceType !== "GENERATED") {
      throw new Error("Expected a generated shopping item.");
    }

    expect(mergedCucumber).toEqual(
      expect.objectContaining({
        name: "Agurk",
        occurrenceCount: 2,
        preferredStoreConflict: true,
        recipeCount: 2,
        sourceKey: "entry-1:ingredient-1|entry-2:ingredient-2",
      }),
    );
  });

  it("merges free-text ingredients with the same display name across recipes", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      activeShoppingDate: null,
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
                  id: "category-produce",
                  name: "Frukt og gront",
                },
                categoryId: "category-produce",
                displayName: "Persille",
                id: "ingredient-1",
                ingredientId: null,
                preferredStore: null,
                preferredStoreId: null,
                sortOrder: 1,
                unit: "stk",
              },
            ],
            title: "Suppe",
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
                  id: "category-produce",
                  name: "Frukt og gront",
                },
                categoryId: "category-produce",
                displayName: "Persille",
                id: "ingredient-2",
                ingredientId: null,
                preferredStore: null,
                preferredStoreId: null,
                sortOrder: 1,
                unit: "stk",
              },
            ],
            title: "Salat",
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
    dbMock.store.findMany.mockResolvedValue([]);

    const result = await getMealPlanShoppingData({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result.projectedItems).toHaveLength(1);
    expect(result.projectedItems[0]).toEqual(
      expect.objectContaining({
        name: "Persille",
        occurrenceCount: 2,
        quantityLabel: "3 stk",
        recipeCount: 2,
      }),
    );
  });

  it("keeps free-text ingredients separate when display names differ", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      activeShoppingDate: null,
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
                  displayName: "Frukt og gront",
                  id: "category-produce",
                },
                categoryId: "category-produce",
                displayName: "Agurk",
                id: "ingredient-1",
                ingredientId: null,
                preferredStore: null,
                preferredStoreId: null,
                sortOrder: 1,
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
                  displayName: "Frukt og gront",
                  id: "category-produce",
                },
                categoryId: "category-produce",
                displayName: "Tomat",
                id: "ingredient-2",
                ingredientId: null,
                preferredStore: null,
                preferredStoreId: null,
                sortOrder: 1,
                unit: "stk",
              },
            ],
            title: "Salat",
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
    dbMock.store.findMany.mockResolvedValue([]);

    const result = await getMealPlanShoppingData({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result.projectedItems).toHaveLength(2);
    expect(result.projectedItems.map((item) => item.name)).toEqual(["Agurk", "Tomat"]);
  });

  it("applies legacy single-occurrence overrides after merge", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      activeShoppingDate: null,
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
                preferredStore: null,
                preferredStoreId: null,
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
                preferredStore: null,
                preferredStoreId: null,
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
      shoppingOverrides: [
        {
          checked: true,
          excludedFromList: false,
          includeDespiteStock: false,
          note: "Kjøp ekstra",
          postponedUntilDate: null,
          preferredStore: null,
          preferredStoreId: null,
          sourceKey: "entry-2:ingredient-2",
          sourceType: "GENERATED",
          updatedAt: new Date("2026-05-16T12:00:00.000Z"),
        },
      ],
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      status: "DRAFT",
      title: "Langhelg",
    });
    dbMock.store.findMany.mockResolvedValue([]);

    const result = await getMealPlanShoppingData({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result.projectedItems).toHaveLength(1);

    const mergedYoghurt = result.projectedItems[0];

    if (mergedYoghurt.sourceType !== "GENERATED") {
      throw new Error("Expected a generated shopping item.");
    }

    expect(mergedYoghurt).toEqual(
      expect.objectContaining({
        checked: true,
        note: "Kjøp ekstra",
        recipeCount: 2,
        sourceKey: "entry-1:ingredient-1|entry-2:ingredient-2",
      }),
    );
  });

  describe("getMealPlanStoreModeData", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-14T09:30:45.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

  it("builds store mode with all due items ordered by the selected store layout", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      activeShoppingDate: new Date("2026-05-16T00:00:00.000Z"),
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
                displayName: "Wraps",
                id: "ingredient-1",
                ingredientId: "canonical-wraps",
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
                  id: "store-2",
                  name: "Meny",
                },
                preferredStoreId: "store-2",
                sortOrder: 2,
                unit: "stk",
              },
            ],
            title: "Tacofredag",
          },
          recipeId: "recipe-1",
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
          note: null,
          preferredStore: {
            id: "store-1",
            name: "Coop Mega",
          },
          preferredStoreId: "store-1",
          quantity: "2 beger",
          updatedAt: new Date("2026-05-15T00:00:00.000Z"),
        },
      ],
      shoppingOverrides: [],
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      status: "DRAFT",
      title: "Helgehandel",
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
          {
            categoryId: "category-dairy",
            displayName: "Meieri",
            id: "section-3",
            sortOrder: 3,
          },
        ],
      },
      {
        familyId: "family-1",
        id: "store-2",
        name: "Meny",
        sections: [
          {
            categoryId: "category-bakery",
            displayName: "Brod",
            id: "section-4",
            sortOrder: 1,
          },
          {
            categoryId: "category-produce",
            displayName: "Frukt og gront",
            id: "section-5",
            sortOrder: 2,
          },
          {
            categoryId: "category-dairy",
            displayName: "Meieri",
            id: "section-6",
            sortOrder: 3,
          },
        ],
      },
    ]);
    dbMock.userStorePreference.findUnique.mockResolvedValue({
      selectedStoreId: "store-2",
    });

    const result = await getMealPlanStoreModeData({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(dbMock.userStorePreference.findUnique).toHaveBeenCalledWith({
      select: {
        selectedStoreId: true,
      },
      where: {
        userId_familyId: {
          familyId: "family-1",
          userId: "user-1",
        },
      },
    });
    expect(result.selectedStore).toEqual({
      id: "store-2",
      name: "Meny",
    });
    expect(result.activeShoppingDate).toEqual(new Date("2026-05-16T00:00:00.000Z"));
    expect(result.dueSectionGroups.flatMap((section) => section.items.map((item) => item.name))).toEqual([
      "Yoghurt",
    ]);
    expect(result.laterItems.map((item) => item.name).sort()).toEqual(["Paprika", "Wraps"]);
    expect(result.progress).toEqual({
      checkedCount: 0,
      totalCount: 1,
    });
  });

  it("includes all items from the shopping date through the end of the meal plan", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      activeShoppingDate: new Date("2026-05-15T00:00:00.000Z"),
      endDate: new Date("2026-05-17T00:00:00.000Z"),
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
                category: { id: "category-bakery", name: "Brod" },
                categoryId: "category-bakery",
                displayName: "Wraps",
                id: "ingredient-1",
                ingredientId: "canonical-wraps",
                preferredStore: null,
                preferredStoreId: null,
                sortOrder: 1,
                unit: "pk",
              },
            ],
            title: "Mandag",
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
                category: { id: "category-produce", name: "Frukt og gront" },
                categoryId: "category-produce",
                displayName: "Paprika",
                id: "ingredient-2",
                ingredientId: "canonical-paprika",
                preferredStore: null,
                preferredStoreId: null,
                sortOrder: 1,
                unit: "stk",
              },
            ],
            title: "Tirsdag",
          },
          recipeId: "recipe-2",
        },
        {
          date: new Date("2026-05-17T00:00:00.000Z"),
          id: "entry-3",
          mealType: "DINNER",
          recipe: {
            id: "recipe-3",
            ingredients: [
              {
                amount: "2",
                category: { id: "category-dairy", name: "Meieri" },
                categoryId: "category-dairy",
                displayName: "Yoghurt",
                id: "ingredient-3",
                ingredientId: "canonical-yoghurt",
                preferredStore: null,
                preferredStoreId: null,
                sortOrder: 1,
                unit: "beger",
              },
            ],
            title: "Onsdag",
          },
          recipeId: "recipe-3",
        },
      ],
      id: "meal-plan-1",
      manualShoppingItems: [],
      shoppingOverrides: [],
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      status: "DRAFT",
      title: "Ukehandel",
    });
    dbMock.store.findMany.mockResolvedValue([
      {
        familyId: "family-1",
        id: "store-1",
        name: "Coop Mega",
        sections: [
          {
            categoryId: "category-bakery",
            displayName: "Brod",
            id: "section-1",
            sortOrder: 1,
          },
          {
            categoryId: "category-produce",
            displayName: "Frukt og gront",
            id: "section-2",
            sortOrder: 2,
          },
          {
            categoryId: "category-dairy",
            displayName: "Meieri",
            id: "section-3",
            sortOrder: 3,
          },
        ],
      },
    ]);

    const result = await getMealPlanStoreModeData({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(
      result.dueSectionGroups.flatMap((section) => section.items.map((item) => item.name)),
    ).toEqual(["Wraps", "Paprika", "Yoghurt"]);
    expect(result.laterItems).toEqual([]);
    expect(result.progress).toEqual({
      checkedCount: 0,
      totalCount: 3,
    });
  });

  it("excludes past meals from both the trip list and the before-shopping-date list", async () => {
    vi.setSystemTime(new Date("2026-05-16T09:30:45.000Z"));

    dbMock.mealPlan.findFirst.mockResolvedValue({
      activeShoppingDate: new Date("2026-05-15T00:00:00.000Z"),
      endDate: new Date("2026-05-17T00:00:00.000Z"),
      entries: [
        {
          date: new Date("2026-05-14T00:00:00.000Z"),
          id: "entry-0",
          mealType: "DINNER",
          recipe: {
            id: "recipe-0",
            ingredients: [
              {
                amount: "1",
                category: { id: "category-bakery", name: "Brod" },
                categoryId: "category-bakery",
                displayName: "Gammel wrap",
                id: "ingredient-0",
                ingredientId: "canonical-old-wrap",
                preferredStore: null,
                preferredStoreId: null,
                sortOrder: 1,
                unit: "pk",
              },
            ],
            title: "Sondag",
          },
          recipeId: "recipe-0",
        },
        {
          date: new Date("2026-05-16T00:00:00.000Z"),
          id: "entry-1",
          mealType: "DINNER",
          recipe: {
            id: "recipe-1",
            ingredients: [
              {
                amount: "1",
                category: { id: "category-produce", name: "Frukt og gront" },
                categoryId: "category-produce",
                displayName: "Paprika",
                id: "ingredient-1",
                ingredientId: "canonical-paprika",
                preferredStore: null,
                preferredStoreId: null,
                sortOrder: 1,
                unit: "stk",
              },
            ],
            title: "Tirsdag",
          },
          recipeId: "recipe-1",
        },
      ],
      id: "meal-plan-1",
      manualShoppingItems: [],
      shoppingOverrides: [],
      startDate: new Date("2026-05-14T00:00:00.000Z"),
      status: "DRAFT",
      title: "Ukehandel",
    });
    dbMock.store.findMany.mockResolvedValue([
      {
        familyId: "family-1",
        id: "store-1",
        name: "Coop Mega",
        sections: [
          {
            categoryId: "category-bakery",
            displayName: "Brod",
            id: "section-1",
            sortOrder: 1,
          },
          {
            categoryId: "category-produce",
            displayName: "Frukt og gront",
            id: "section-2",
            sortOrder: 2,
          },
        ],
      },
    ]);

    const result = await getMealPlanStoreModeData({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(
      result.dueSectionGroups.flatMap((section) => section.items.map((item) => item.name)),
    ).toEqual(["Paprika"]);
    expect(result.laterItems.map((item) => item.name)).toEqual([]);
  });
  });

  it("excludes stock ingredients from generated shopping items and exposes a stock summary", async () => {
    getFamilyStockMatchSetMock.mockResolvedValue({
      displayNameNormalized: new Set(),
      ingredientIds: new Set(["canonical-lime"]),
    });

    dbMock.mealPlan.findFirst.mockResolvedValue({
      activeShoppingDate: new Date("2026-05-16T00:00:00.000Z"),
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
                  displayName: "Frukt og gront",
                  id: "category-produce",
                },
                categoryId: "category-produce",
                displayName: "Lime",
                id: "ingredient-1",
                ingredientId: "canonical-lime",
                preferredStore: null,
                preferredStoreId: null,
                sortOrder: 1,
                unit: "stk",
              },
              {
                amount: "1",
                category: {
                  displayName: "Brod",
                  id: "category-bakery",
                },
                categoryId: "category-bakery",
                displayName: "Tortillalefser",
                id: "ingredient-2",
                ingredientId: "canonical-tortilla",
                preferredStore: null,
                preferredStoreId: null,
                sortOrder: 2,
                unit: "pk",
              },
            ],
            title: "Taco",
          },
          recipeId: "recipe-1",
        },
      ],
      id: "meal-plan-1",
      manualShoppingItems: [],
      shoppingOverrides: [],
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      status: "DRAFT",
      title: "Uke 20",
    });
    dbMock.store.findMany.mockResolvedValue([
      {
        familyId: null,
        id: "store-1",
        name: "Coop Mega",
        sections: [],
      },
    ]);

    const result = await getMealPlanShoppingData({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result.itemCounts.generated).toBe(1);
    expect(result.projectedItems.map((item) => item.name)).toEqual(["Tortillalefser"]);
    expect(result.stockIngredientCount).toBe(1);
    expect(result.stockIngredientsForPlan[0]).toMatchObject({
      isOptedIn: false,
      name: "Lime",
      sourceKey: "entry-1:ingredient-1",
    });
  });

  it("includes opted-in stock ingredients in generated shopping items", async () => {
    getFamilyStockMatchSetMock.mockResolvedValue({
      displayNameNormalized: new Set(),
      ingredientIds: new Set(["canonical-lime"]),
    });

    dbMock.mealPlan.findFirst.mockResolvedValue({
      activeShoppingDate: null,
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
                  displayName: "Frukt og gront",
                  id: "category-produce",
                },
                categoryId: "category-produce",
                displayName: "Lime",
                id: "ingredient-1",
                ingredientId: "canonical-lime",
                preferredStore: null,
                preferredStoreId: null,
                sortOrder: 1,
                unit: "stk",
              },
            ],
            title: "Taco",
          },
          recipeId: "recipe-1",
        },
      ],
      id: "meal-plan-1",
      manualShoppingItems: [],
      shoppingOverrides: [
        {
          checked: false,
          excludedFromList: false,
          includeDespiteStock: true,
          note: null,
          postponedUntilDate: null,
          preferredStore: null,
          preferredStoreId: null,
          sourceKey: "entry-1:ingredient-1",
          sourceType: "GENERATED",
          updatedAt: new Date("2026-05-15T10:00:00.000Z"),
        },
      ],
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      status: "DRAFT",
      title: "Uke 20",
    });
    dbMock.store.findMany.mockResolvedValue([
      {
        familyId: null,
        id: "store-1",
        name: "Coop Mega",
        sections: [],
      },
    ]);

    const result = await getMealPlanShoppingData({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result.itemCounts.generated).toBe(1);
    expect(result.projectedItems[0]?.name).toBe("Lime");
    expect(result.stockIngredientCount).toBe(0);
  });

  it("omits generated shopping items marked as excluded from the list", async () => {
    getFamilyStockMatchSetMock.mockResolvedValue({
      displayNameNormalized: new Set(),
      ingredientIds: new Set(),
    });

    dbMock.mealPlan.findFirst.mockResolvedValue({
      activeShoppingDate: null,
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
                  displayName: "Frukt og gront",
                  id: "category-produce",
                },
                categoryId: "category-produce",
                displayName: "Lime",
                id: "ingredient-1",
                ingredientId: "canonical-lime",
                preferredStore: null,
                preferredStoreId: null,
                sortOrder: 1,
                unit: "stk",
              },
              {
                amount: "1",
                category: {
                  displayName: "Brod",
                  id: "category-bakery",
                },
                categoryId: "category-bakery",
                displayName: "Tortillalefser",
                id: "ingredient-2",
                ingredientId: "canonical-tortilla",
                preferredStore: null,
                preferredStoreId: null,
                sortOrder: 2,
                unit: "pk",
              },
            ],
            title: "Taco",
          },
          recipeId: "recipe-1",
        },
      ],
      id: "meal-plan-1",
      manualShoppingItems: [],
      shoppingOverrides: [
        {
          checked: false,
          excludedFromList: true,
          includeDespiteStock: false,
          note: null,
          postponedUntilDate: null,
          preferredStore: null,
          preferredStoreId: null,
          sourceKey: "entry-1:ingredient-1",
          sourceType: "GENERATED",
          updatedAt: new Date("2026-05-15T10:00:00.000Z"),
        },
      ],
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      status: "DRAFT",
      title: "Uke 20",
    });
    dbMock.store.findMany.mockResolvedValue([
      {
        familyId: null,
        id: "store-1",
        name: "Coop Mega",
        sections: [],
      },
    ]);

    const result = await getMealPlanShoppingData({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result.itemCounts.generated).toBe(1);
    expect(result.projectedItems.map((item) => item.name)).toEqual(["Tortillalefser"]);
    expect(result.excludedGeneratedItems.map((item) => item.name)).toEqual(["Lime"]);
    expect(result.excludedGeneratedCount).toBe(1);
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

  it("includes unchecked family items in meal plan shopping data", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      activeShoppingDate: null,
      endDate: new Date("2026-05-18T00:00:00.000Z"),
      entries: [],
      id: "meal-plan-1",
      manualShoppingItems: [],
      shoppingOverrides: [],
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      status: "DRAFT",
      title: "Uke 20",
    });
    dbMock.familyShoppingItem.findMany.mockResolvedValue([
      {
        category: {
          displayName: "Annet",
          id: "category-other",
        },
        categoryId: "category-other",
        checked: false,
        id: "family-item-1",
        name: "Batterier",
        note: null,
        preferredStore: null,
        preferredStoreId: null,
        quantity: "1 pk",
        updatedAt: new Date("2026-05-10T00:00:00.000Z"),
      },
    ]);

    const result = await getMealPlanShoppingData({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result.familyStoreGroups).toHaveLength(1);
    expect(
      result.familyStoreGroups[0]?.sections[0]?.items.map((item) => item.name),
    ).toEqual(["Batterier"]);
    expect(result.itemCounts.family).toBe(1);
  });

  it("lists recent manual shopping items deduped by normalized name", async () => {
    dbMock.manualShoppingItem.findMany.mockResolvedValue([
      {
        categoryId: "category-dairy",
        name: "Melk",
        quantity: "2 liter",
        updatedAt: new Date("2026-05-16T00:00:00.000Z"),
      },
      {
        categoryId: "category-other",
        name: "melk",
        quantity: "1 liter",
        updatedAt: new Date("2026-05-15T00:00:00.000Z"),
      },
      {
        categoryId: "category-bakery",
        name: "Brød",
        quantity: null,
        updatedAt: new Date("2026-05-14T00:00:00.000Z"),
      },
    ]);
    dbMock.familyShoppingItem.findMany.mockResolvedValue([
      {
        categoryId: "category-other",
        name: "Batterier",
        quantity: "2",
        updatedAt: new Date("2026-05-17T00:00:00.000Z"),
      },
    ]);

    const result = await listRecentManualShoppingItemsForFamily({
      familyId: "family-1",
      limit: 5,
    });

    expect(dbMock.manualShoppingItem.findMany).toHaveBeenCalled();
    expect(dbMock.familyShoppingItem.findMany).toHaveBeenCalled();
    expect(result).toEqual([
      {
        categoryId: "category-other",
        displayName: "Batterier",
        nameNormalized: "batterier",
        quantity: "2",
      },
      {
        categoryId: "category-dairy",
        displayName: "Melk",
        nameNormalized: "melk",
        quantity: "2 liter",
      },
      {
        categoryId: "category-bakery",
        displayName: "Brød",
        nameNormalized: "brød",
        quantity: "1",
      },
    ]);
  });
});
