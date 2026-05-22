import { ShoppingItemSource } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  dbMock,
  getFamilyStockMatchSetMock,
  getStockIngredientsForMealPlanMock,
  loadShoppingMealPlanMock,
  requireFamilyMembershipMock,
  transactionMock,
} = vi.hoisted(() => {
  const transactionMock = {
    manualShoppingItem: {
      delete: vi.fn(),
    },
    shoppingItemOverride: {
      deleteMany: vi.fn(),
    },
  };

  return {
    dbMock: {
      $transaction: vi.fn(),
      ingredient: {
        findUnique: vi.fn(),
      },
      ingredientCategory: {
        findUnique: vi.fn(),
      },
      manualShoppingItem: {
        create: vi.fn(),
        deleteMany: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      mealPlan: {
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      shoppingItemOverride: {
        create: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        upsert: vi.fn(),
      },
      store: {
        findFirst: vi.fn(),
      },
    },
    getFamilyStockMatchSetMock: vi.fn(),
    getStockIngredientsForMealPlanMock: vi.fn(),
    loadShoppingMealPlanMock: vi.fn(),
    requireFamilyMembershipMock: vi.fn(),
    transactionMock,
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

vi.mock("./write-observability.server", () => {
  return {
    logCollaborationFailure: vi.fn(),
    logCollaborationWrite: vi.fn(),
  };
});

vi.mock("./shopping.server", () => {
  return {
    getStockIngredientsForMealPlan: getStockIngredientsForMealPlanMock,
    loadShoppingMealPlan: loadShoppingMealPlanMock,
  };
});

vi.mock("./stock.server", () => {
  return {
    getFamilyStockMatchSet: getFamilyStockMatchSetMock,
  };
});

import {
  createManualShoppingItem,
  createQuickManualShoppingItem,
  deleteManualShoppingItem,
  resolveQuickAddManualShoppingItemValues,
  excludeGeneratedShoppingItem,
  optInStockShoppingItems,
  restoreGeneratedShoppingItem,
  toggleShoppingItemChecked,
  updateActiveShoppingDate,
  updateGeneratedShoppingItemOverride,
} from "./shopping-write.server";

const mockMealPlan = {
  endDate: new Date("2026-05-18T00:00:00.000Z"),
  id: "meal-plan-1",
  startDate: new Date("2026-05-15T00:00:00.000Z"),
  updatedAt: new Date("2026-05-15T00:00:00.000Z"),
};

describe("shopping-write.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireFamilyMembershipMock.mockResolvedValue({
      familyId: "family-1",
      id: "membership-1",
      role: "ADMIN",
      userId: "user-1",
    });
    dbMock.mealPlan.findFirst.mockResolvedValue(mockMealPlan);
    dbMock.mealPlan.updateMany.mockResolvedValue({ count: 1 });
    dbMock.manualShoppingItem.updateMany.mockResolvedValue({ count: 1 });
    dbMock.manualShoppingItem.deleteMany.mockResolvedValue({ count: 1 });
    dbMock.shoppingItemOverride.updateMany.mockResolvedValue({ count: 1 });
    dbMock.shoppingItemOverride.deleteMany.mockResolvedValue({ count: 1 });
    dbMock.$transaction.mockImplementation(async (callback: (tx: typeof transactionMock) => unknown) =>
      callback(transactionMock),
    );
  });

  it("returns manual item validation errors before writing", async () => {
    const result = await createManualShoppingItem({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
      values: {
        buyOnDate: "2026-05-25",
        categoryId: "",
        name: "   ",
        note: "",
        preferredStoreId: "",
        quantity: "",
      },
    });

    expect(result).toEqual({
      fieldErrors: {
        buyOnDate: "Datoen må ligge innenfor ukeplanens aktive periode.",
        categoryId: "Velg en kategori.",
        name: "Skriv inn et varenavn.",
      },
      status: "VALIDATION_ERROR",
      values: {
        buyOnDate: "2026-05-25",
        categoryId: "",
        name: "",
        note: "",
        preferredStoreId: "",
        quantity: "",
      },
    });
    expect(dbMock.ingredientCategory.findUnique).not.toHaveBeenCalled();
    expect(dbMock.manualShoppingItem.create).not.toHaveBeenCalled();
  });

  it("creates a scoped manual shopping item with trimmed values", async () => {
    dbMock.ingredientCategory.findUnique.mockResolvedValue({
      id: "category-produce",
    });
    dbMock.store.findFirst.mockResolvedValue({
      id: "store-1",
    });

    const result = await createManualShoppingItem({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
      values: {
        buyOnDate: "2026-05-16",
        categoryId: "category-produce",
        name: "  Bananer  ",
        note: "  Til smoothien  ",
        preferredStoreId: "store-1",
        quantity: "  6 stk  ",
      },
    });

    expect(result).toEqual({
      status: "CREATED",
    });
    expect(dbMock.manualShoppingItem.create).toHaveBeenCalledWith({
      data: {
        buyOnDate: new Date("2026-05-16T00:00:00.000Z"),
        categoryId: "category-produce",
        mealPlanId: "meal-plan-1",
        name: "Bananer",
        note: "Til smoothien",
        preferredStoreId: "store-1",
        quantity: "6 stk",
        updatedByUserId: "user-1",
      },
    });
  });

  it("resolves quick-add values from a canonical ingredient", async () => {
    dbMock.ingredientCategory.findUnique.mockResolvedValue({
      id: "category-other",
    });
    dbMock.ingredient.findUnique.mockResolvedValue({
      canonicalName: "Melk",
      defaultCategoryId: "category-dairy",
    });

    const result = await resolveQuickAddManualShoppingItemValues({
      familyId: "family-1",
      input: {
        ingredientId: "ingredient-milk",
      },
    });

    expect(result).toEqual({
      ok: true,
      values: {
        buyOnDate: "",
        categoryId: "category-dairy",
        name: "Melk",
        note: "",
        preferredStoreId: "",
        quantity: "1",
      },
    });
  });

  it("resolves quick-add values from a recent manual item with quantity and category", async () => {
    dbMock.ingredientCategory.findUnique.mockResolvedValue({
      id: "category-other",
    });
    dbMock.manualShoppingItem.findMany.mockResolvedValue([
      {
        categoryId: "category-bakery",
        name: "Brød",
        quantity: "2 stk",
      },
    ]);

    const result = await resolveQuickAddManualShoppingItemValues({
      familyId: "family-1",
      input: {
        recentNameNormalized: "brød",
      },
    });

    expect(result).toEqual({
      ok: true,
      values: {
        buyOnDate: "",
        categoryId: "category-bakery",
        name: "Brød",
        note: "",
        preferredStoreId: "",
        quantity: "2 stk",
      },
    });
  });

  it("creates a quick-add manual item with Annet defaults for new names", async () => {
    dbMock.ingredientCategory.findUnique.mockResolvedValue({
      id: "category-other",
    });

    const result = await createQuickManualShoppingItem({
      familyId: "family-1",
      input: {
        name: "Tannkrem",
      },
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      status: "CREATED",
    });
    expect(dbMock.manualShoppingItem.create).toHaveBeenCalledWith({
      data: {
        buyOnDate: null,
        categoryId: "category-other",
        mealPlanId: "meal-plan-1",
        name: "Tannkrem",
        note: null,
        preferredStoreId: null,
        quantity: "1",
        updatedByUserId: "user-1",
      },
    });
  });

  it("deletes a manual shopping item together with any manual override rows", async () => {
    dbMock.manualShoppingItem.findFirst.mockResolvedValue({
      id: "manual-item-1",
      updatedAt: new Date("2026-05-15T00:00:00.000Z"),
    });

    const result = await deleteManualShoppingItem({
      expectedUpdatedAt: new Date("2026-05-15T00:00:00.000Z").toISOString(),
      familyId: "family-1",
      manualItemId: "manual-item-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      status: "DELETED",
    });
    expect(dbMock.manualShoppingItem.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "manual-item-1",
        updatedAt: new Date("2026-05-15T00:00:00.000Z"),
      },
    });
    expect(dbMock.shoppingItemOverride.deleteMany).toHaveBeenCalledWith({
      where: {
        mealPlanId: "meal-plan-1",
        sourceKey: "manual-item-1",
        sourceType: ShoppingItemSource.MANUAL,
      },
    });
  });

  it("removes manual checked overrides when unchecking a manual row", async () => {
    dbMock.manualShoppingItem.findFirst.mockResolvedValue({
      id: "manual-item-1",
    });
    dbMock.shoppingItemOverride.findUnique.mockResolvedValue({
      checked: true,
      id: "override-1",
      note: null,
      postponedUntilDate: null,
      preferredStoreId: null,
      sourceType: ShoppingItemSource.MANUAL,
      updatedAt: new Date("2026-05-15T00:00:00.000Z"),
    });

    const result = await toggleShoppingItemChecked({
      checked: false,
      expectedUpdatedAt: new Date("2026-05-15T00:00:00.000Z").toISOString(),
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      sourceKey: "manual-item-1",
      sourceType: ShoppingItemSource.MANUAL,
      userId: "user-1",
    });

    expect(result).toEqual({
      status: "UPDATED",
    });
    expect(dbMock.shoppingItemOverride.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "override-1",
        updatedAt: new Date("2026-05-15T00:00:00.000Z"),
      },
    });
    expect(dbMock.shoppingItemOverride.updateMany).not.toHaveBeenCalled();
  });

  it("upserts generated override fields while preserving checked state", async () => {
    dbMock.store.findFirst.mockResolvedValue({
      id: "store-2",
    });
    dbMock.shoppingItemOverride.findUnique.mockResolvedValue({
      checked: true,
      excludedFromList: false,
      id: "override-1",
      includeDespiteStock: false,
      note: null,
      postponedUntilDate: null,
      preferredStoreId: null,
      updatedAt: new Date("2026-05-15T00:00:00.000Z"),
    });

    const result = await updateGeneratedShoppingItemOverride({
      expectedUpdatedAt: new Date("2026-05-15T00:00:00.000Z").toISOString(),
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      sourceKey: "entry-1:ingredient-1",
      userId: "user-1",
      values: {
        note: "  Husk tilbud  ",
        postponedUntilDate: "2026-05-17",
        preferredStoreId: "store-2",
      },
    });

    expect(result).toEqual({
      status: "UPDATED",
    });
    expect(dbMock.shoppingItemOverride.updateMany).toHaveBeenCalledWith({
      data: {
        checked: true,
        excludedFromList: false,
        includeDespiteStock: false,
        note: "Husk tilbud",
        postponedUntilDate: new Date("2026-05-17T00:00:00.000Z"),
        preferredStoreId: "store-2",
        updatedByUserId: "user-1",
      },
      where: {
        id: "override-1",
        updatedAt: new Date("2026-05-15T00:00:00.000Z"),
      },
    });
  });

  it("marks a generated shopping item as excluded from the list", async () => {
    dbMock.shoppingItemOverride.findUnique.mockResolvedValue(null);

    const result = await excludeGeneratedShoppingItem({
      expectedUpdatedAt: "",
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      sourceKey: "entry-1:ingredient-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      status: "EXCLUDED",
    });
    expect(dbMock.shoppingItemOverride.create).toHaveBeenCalledWith({
      data: {
        checked: false,
        excludedFromList: true,
        includeDespiteStock: false,
        mealPlanId: "meal-plan-1",
        note: null,
        postponedUntilDate: null,
        preferredStoreId: null,
        sourceKey: "entry-1:ingredient-1",
        sourceType: ShoppingItemSource.GENERATED,
        updatedByUserId: "user-1",
      },
    });
  });

  it("restores a generated shopping item by clearing excludedFromList", async () => {
    dbMock.shoppingItemOverride.findUnique.mockResolvedValue({
      checked: false,
      excludedFromList: true,
      id: "override-1",
      includeDespiteStock: false,
      note: null,
      postponedUntilDate: null,
      preferredStoreId: null,
      updatedAt: new Date("2026-05-15T00:00:00.000Z"),
    });

    const result = await restoreGeneratedShoppingItem({
      expectedUpdatedAt: new Date("2026-05-15T00:00:00.000Z").toISOString(),
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      sourceKey: "entry-1:ingredient-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      status: "RESTORED",
    });
    expect(dbMock.shoppingItemOverride.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "override-1",
        updatedAt: new Date("2026-05-15T00:00:00.000Z"),
      },
    });
    expect(dbMock.shoppingItemOverride.updateMany).not.toHaveBeenCalled();
  });

  it("opts stock ingredients into the generated shopping list", async () => {
    loadShoppingMealPlanMock.mockResolvedValue({
      id: "meal-plan-1",
      shoppingOverrides: [],
    });
    getFamilyStockMatchSetMock.mockResolvedValue({
      displayNameNormalized: new Set(),
      ingredientIds: new Set(["ingredient-salt"]),
    });
    getStockIngredientsForMealPlanMock.mockReturnValue([
      {
        isOptedIn: false,
        name: "Salt",
        sourceKey: "entry-1:ingredient-1",
      },
    ]);
    dbMock.shoppingItemOverride.findUnique.mockResolvedValue(null);
    dbMock.shoppingItemOverride.upsert.mockResolvedValue({
      id: "override-stock-1",
    });

    const result = await optInStockShoppingItems({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      sourceKeys: ["entry-1:ingredient-1"],
      userId: "user-1",
    });

    expect(result.status).toBe("UPDATED");
    expect(dbMock.shoppingItemOverride.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          includeDespiteStock: true,
          sourceKey: "entry-1:ingredient-1",
        }),
        update: expect.objectContaining({
          includeDespiteStock: true,
        }),
      }),
    );
  });

  it("updates the meal plan active shopping date within range", async () => {
    const result = await updateActiveShoppingDate({
      activeShoppingDate: "2026-05-17",
      expectedMealPlanUpdatedAt: mockMealPlan.updatedAt.toISOString(),
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      status: "UPDATED",
    });
    expect(dbMock.mealPlan.updateMany).toHaveBeenCalledWith({
      data: {
        activeShoppingDate: new Date("2026-05-17T00:00:00.000Z"),
        updatedByUserId: "user-1",
      },
      where: {
        id: "meal-plan-1",
        updatedAt: mockMealPlan.updatedAt,
      },
    });
  });
});
