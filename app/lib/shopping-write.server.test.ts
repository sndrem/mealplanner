import { ShoppingItemSource } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  dbMock,
  getFamilyStockMatchSetMock,
  getStockIngredientsForMealPlanMock,
  loadShoppingMealPlanMock,
  projectCreatedManualShoppingItemMock,
  requireFamilyMembershipMock,
  transactionMock,
} = vi.hoisted(() => {
  const transactionMock = {
    manualShoppingItem: {
      delete: vi.fn(),
      findFirst: vi.fn(),
    },
    recipeIngredient: {
      findUnique: vi.fn(),
    },
    shoppingItemCheckEvent: {
      create: vi.fn(),
    },
    shoppingItemOverride: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
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
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      shoppingItemOverride: {
        create: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
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
    projectCreatedManualShoppingItemMock: vi.fn(),
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
    buildRecentManualItemFromProjectedItem: (item: {
      category: { id: string };
      name: string;
      quantity: string | null;
    }) => ({
      categoryId: item.category.id,
      displayName: item.name.trim(),
      nameNormalized: item.name.trim().toLowerCase(),
      quantity: item.quantity?.trim() || "1",
    }),
    getStockIngredientsForMealPlan: getStockIngredientsForMealPlanMock,
    loadShoppingMealPlan: loadShoppingMealPlanMock,
    projectCreatedManualShoppingItem: projectCreatedManualShoppingItemMock,
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
  updateGeneratedShoppingItemQuantity,
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
    dbMock.mealPlan.findMany.mockResolvedValue([
      {
        endDate: mockMealPlan.endDate,
        startDate: mockMealPlan.startDate,
      },
    ]);
    dbMock.mealPlan.updateMany.mockResolvedValue({ count: 1 });
    dbMock.manualShoppingItem.updateMany.mockResolvedValue({ count: 1 });
    dbMock.manualShoppingItem.deleteMany.mockResolvedValue({ count: 1 });
    dbMock.shoppingItemOverride.updateMany.mockResolvedValue({ count: 1 });
    dbMock.shoppingItemOverride.deleteMany.mockResolvedValue({ count: 1 });
    dbMock.shoppingItemOverride.findMany.mockResolvedValue([]);
    dbMock.$transaction.mockImplementation(async (callback: (tx: typeof transactionMock) => unknown) =>
      callback(transactionMock),
    );
    transactionMock.shoppingItemOverride.create.mockResolvedValue({
      id: "override-created",
    });
    transactionMock.shoppingItemOverride.deleteMany.mockResolvedValue({
      count: 1,
    });
    transactionMock.shoppingItemOverride.updateMany.mockResolvedValue({
      count: 1,
    });
    transactionMock.shoppingItemCheckEvent.create.mockResolvedValue({
      id: "check-event-1",
    });
    transactionMock.manualShoppingItem.findFirst.mockResolvedValue({
      name: "Kaffe",
    });
    transactionMock.recipeIngredient.findUnique.mockResolvedValue({
      displayName: "Paprika",
    });
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
        buyOnDate: "Datoen må ligge innenfor en av familiens ukeplaner.",
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
    dbMock.manualShoppingItem.create.mockResolvedValue({
      id: "manual-item-1",
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
      manualItemId: "manual-item-1",
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

  it("accepts a buyOnDate from another family meal plan range", async () => {
    dbMock.mealPlan.findMany.mockResolvedValue([
      {
        endDate: new Date("2026-05-18T00:00:00.000Z"),
        startDate: new Date("2026-05-15T00:00:00.000Z"),
      },
      {
        endDate: new Date("2026-05-25T00:00:00.000Z"),
        startDate: new Date("2026-05-22T00:00:00.000Z"),
      },
    ]);
    dbMock.ingredientCategory.findUnique.mockResolvedValue({
      id: "category-produce",
    });
    dbMock.store.findFirst.mockResolvedValue(null);
    dbMock.manualShoppingItem.create.mockResolvedValue({
      id: "manual-item-2",
    });

    const result = await createManualShoppingItem({
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
      values: {
        buyOnDate: "2026-05-23",
        categoryId: "category-produce",
        name: "Bananer",
        note: "",
        preferredStoreId: "",
        quantity: "",
      },
    });

    expect(result).toEqual({
      manualItemId: "manual-item-2",
      status: "CREATED",
    });
    expect(dbMock.manualShoppingItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        buyOnDate: new Date("2026-05-23T00:00:00.000Z"),
        mealPlanId: "meal-plan-1",
      }),
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

  it("uses an explicit quick-add quantity for ingredient matches", async () => {
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
        quantity: "4 flasker",
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
        quantity: "4 flasker",
      },
    });
  });

  it("prefers explicit quick-add quantity over recent item quantity", async () => {
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
        quantity: "4 stk",
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
        quantity: "4 stk",
      },
    });
  });

  it("creates a quick-add manual item with Annet defaults for new names", async () => {
    dbMock.ingredientCategory.findUnique.mockResolvedValue({
      id: "category-other",
    });
    dbMock.manualShoppingItem.create.mockResolvedValue({
      id: "manual-item-3",
    });
    projectCreatedManualShoppingItemMock.mockResolvedValue({
      buyOnDate: null,
      category: { id: "category-other", name: "Annet" },
      checked: false,
      collaborationVersion: "2026-05-31T00:00:00.000Z",
      name: "Tannkrem",
      note: null,
      overrideVersion: "",
      preferredStore: null,
      quantity: "1",
      quantityLabel: "1",
      section: { displayName: "Annet", sortOrder: 99 },
      sourceKey: "manual-item-3",
      sourceType: "MANUAL",
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
      item: {
        buyOnDate: null,
        category: { id: "category-other", name: "Annet" },
        checked: false,
        collaborationVersion: "2026-05-31T00:00:00.000Z",
        name: "Tannkrem",
        note: null,
        overrideVersion: "",
        preferredStore: null,
        quantity: "1",
        quantityLabel: "1",
        section: { displayName: "Annet", sortOrder: 99 },
        sourceKey: "manual-item-3",
        sourceType: "MANUAL",
      },
      recentManualItem: {
        categoryId: "category-other",
        displayName: "Tannkrem",
        nameNormalized: "tannkrem",
        quantity: "1",
      },
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
    expect(transactionMock.shoppingItemOverride.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "override-1",
        updatedAt: new Date("2026-05-15T00:00:00.000Z"),
      },
    });
    expect(transactionMock.shoppingItemOverride.updateMany).not.toHaveBeenCalled();
    expect(transactionMock.shoppingItemCheckEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "user-1",
        checked: false,
        familyId: "family-1",
        itemName: "Kaffe",
        mealPlanId: "meal-plan-1",
        sourceType: ShoppingItemSource.MANUAL,
        targetKey: "manual-item-1",
        targetType: "MEAL_PLAN_ITEM",
      }),
    });
  });

  it("records history when checking a generated shopping item", async () => {
    dbMock.shoppingItemOverride.findUnique.mockResolvedValue(null);

    const result = await toggleShoppingItemChecked({
      checked: true,
      expectedUpdatedAt: "",
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      sourceKey: "entry-1:ingredient-1",
      sourceType: ShoppingItemSource.GENERATED,
      userId: "user-1",
    });

    expect(result).toEqual({
      status: "UPDATED",
    });
    expect(transactionMock.shoppingItemOverride.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        checked: true,
        sourceKey: "entry-1:ingredient-1",
        sourceType: ShoppingItemSource.GENERATED,
      }),
    });
    expect(transactionMock.recipeIngredient.findUnique).toHaveBeenCalledWith({
      select: {
        displayName: true,
      },
      where: {
        id: "ingredient-1",
      },
    });
    expect(transactionMock.shoppingItemCheckEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "user-1",
        checked: true,
        itemName: "Paprika",
        sourceType: ShoppingItemSource.GENERATED,
        targetKey: "entry-1:ingredient-1",
        targetType: "MEAL_PLAN_ITEM",
      }),
    });
  });

  it("does not record history for no-op uncheck without an override", async () => {
    dbMock.shoppingItemOverride.findUnique.mockResolvedValue(null);

    const result = await toggleShoppingItemChecked({
      checked: false,
      expectedUpdatedAt: "",
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      sourceKey: "entry-1:ingredient-1",
      sourceType: ShoppingItemSource.GENERATED,
      userId: "user-1",
    });

    expect(result).toEqual({
      status: "UPDATED",
    });
    expect(dbMock.$transaction).not.toHaveBeenCalled();
    expect(transactionMock.shoppingItemCheckEvent.create).not.toHaveBeenCalled();
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
        quantity: " 4 flasker ",
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
        quantity: "4 flasker",
        sourceKey: "entry-1:ingredient-1",
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
        quantity: null,
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

  it("updates quantity on a generated shopping item", async () => {
    dbMock.shoppingItemOverride.findUnique.mockResolvedValue({
      checked: false,
      excludedFromList: false,
      id: "override-1",
      includeDespiteStock: false,
      note: null,
      postponedUntilDate: null,
      preferredStoreId: null,
      quantity: "2 stk",
      sourceKey: "entry-1:ingredient-1",
      sourceType: ShoppingItemSource.GENERATED,
      updatedAt: new Date("2026-05-15T00:00:00.000Z"),
    });

    const result = await updateGeneratedShoppingItemQuantity({
      expectedUpdatedAt: new Date("2026-05-15T00:00:00.000Z").toISOString(),
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      quantity: " 4 flasker ",
      sourceKey: "entry-1:ingredient-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      status: "UPDATED",
    });
    expect(dbMock.shoppingItemOverride.updateMany).toHaveBeenCalledWith({
      data: {
        checked: false,
        excludedFromList: false,
        includeDespiteStock: false,
        note: null,
        postponedUntilDate: null,
        preferredStoreId: null,
        quantity: "4 flasker",
        sourceKey: "entry-1:ingredient-1",
        updatedByUserId: "user-1",
      },
      where: {
        id: "override-1",
        updatedAt: new Date("2026-05-15T00:00:00.000Z"),
      },
    });
  });

  it("clears a quantity-only generated override", async () => {
    dbMock.shoppingItemOverride.findUnique.mockResolvedValue({
      checked: false,
      excludedFromList: false,
      id: "override-1",
      includeDespiteStock: false,
      note: null,
      postponedUntilDate: null,
      preferredStoreId: null,
      quantity: "4 flasker",
      sourceKey: "entry-1:ingredient-1",
      sourceType: ShoppingItemSource.GENERATED,
      updatedAt: new Date("2026-05-15T00:00:00.000Z"),
    });

    const result = await updateGeneratedShoppingItemQuantity({
      expectedUpdatedAt: new Date("2026-05-15T00:00:00.000Z").toISOString(),
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      quantity: "  ",
      sourceKey: "entry-1:ingredient-1",
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

  it("keeps a quantity-only override when unchecking a generated item", async () => {
    dbMock.shoppingItemOverride.findUnique.mockResolvedValue({
      checked: true,
      excludedFromList: false,
      id: "override-1",
      includeDespiteStock: false,
      note: null,
      postponedUntilDate: null,
      preferredStoreId: null,
      quantity: "4 flasker",
      sourceType: ShoppingItemSource.GENERATED,
      updatedAt: new Date("2026-05-15T00:00:00.000Z"),
    });

    const result = await toggleShoppingItemChecked({
      checked: false,
      expectedUpdatedAt: new Date("2026-05-15T00:00:00.000Z").toISOString(),
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      sourceKey: "entry-1:ingredient-1",
      sourceType: ShoppingItemSource.GENERATED,
      userId: "user-1",
    });

    expect(result).toEqual({
      status: "UPDATED",
    });
    expect(transactionMock.shoppingItemOverride.updateMany).toHaveBeenCalledWith({
      data: {
        checked: false,
        updatedByUserId: "user-1",
      },
      where: {
        id: "override-1",
        updatedAt: new Date("2026-05-15T00:00:00.000Z"),
      },
    });
    expect(transactionMock.shoppingItemOverride.deleteMany).not.toHaveBeenCalled();
  });

  it("migrates an overlapping generated quantity override onto the current source key", async () => {
    dbMock.shoppingItemOverride.findUnique.mockResolvedValue(null);
    dbMock.shoppingItemOverride.findMany.mockResolvedValue([
      {
        checked: false,
        excludedFromList: false,
        id: "override-1",
        includeDespiteStock: false,
        note: null,
        postponedUntilDate: null,
        preferredStoreId: null,
        quantity: "4 flasker",
        sourceKey: "entry-1:ingredient-1|entry-2:ingredient-2",
        sourceType: ShoppingItemSource.GENERATED,
        updatedAt: new Date("2026-05-15T00:00:00.000Z"),
      },
    ]);

    const result = await updateGeneratedShoppingItemQuantity({
      expectedUpdatedAt: new Date("2026-05-15T00:00:00.000Z").toISOString(),
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      quantity: "6 flasker",
      sourceKey: "entry-1:ingredient-1|entry-2:ingredient-2|entry-3:ingredient-3",
      userId: "user-1",
    });

    expect(result).toEqual({
      status: "UPDATED",
    });
    expect(dbMock.shoppingItemOverride.updateMany).toHaveBeenCalledWith({
      data: {
        checked: false,
        excludedFromList: false,
        includeDespiteStock: false,
        note: null,
        postponedUntilDate: null,
        preferredStoreId: null,
        quantity: "6 flasker",
        sourceKey: "entry-1:ingredient-1|entry-2:ingredient-2|entry-3:ingredient-3",
        updatedByUserId: "user-1",
      },
      where: {
        id: "override-1",
        updatedAt: new Date("2026-05-15T00:00:00.000Z"),
      },
    });
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

  it("accepts an active shopping date from another family meal plan range", async () => {
    dbMock.mealPlan.findMany.mockResolvedValue([
      {
        endDate: new Date("2026-05-18T00:00:00.000Z"),
        startDate: new Date("2026-05-15T00:00:00.000Z"),
      },
      {
        endDate: new Date("2026-05-25T00:00:00.000Z"),
        startDate: new Date("2026-05-22T00:00:00.000Z"),
      },
    ]);

    const result = await updateActiveShoppingDate({
      activeShoppingDate: "2026-05-23",
      expectedMealPlanUpdatedAt: mockMealPlan.updatedAt.toISOString(),
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      status: "UPDATED",
    });
    expect(dbMock.mealPlan.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        activeShoppingDate: new Date("2026-05-23T00:00:00.000Z"),
      }),
      where: {
        id: "meal-plan-1",
        updatedAt: mockMealPlan.updatedAt,
      },
    });
  });
});
