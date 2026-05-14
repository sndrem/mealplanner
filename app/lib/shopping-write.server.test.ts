import { ShoppingItemSource } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, requireFamilyMembershipMock, transactionMock } = vi.hoisted(() => {
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
      ingredientCategory: {
        findUnique: vi.fn(),
      },
      manualShoppingItem: {
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      mealPlan: {
        findFirst: vi.fn(),
      },
      shoppingItemOverride: {
        delete: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
      },
      store: {
        findFirst: vi.fn(),
      },
    },
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

import {
  createManualShoppingItem,
  deleteManualShoppingItem,
  toggleShoppingItemChecked,
  updateGeneratedShoppingItemOverride,
} from "./shopping-write.server";

const mockMealPlan = {
  endDate: new Date("2026-05-18T00:00:00.000Z"),
  id: "meal-plan-1",
  startDate: new Date("2026-05-15T00:00:00.000Z"),
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
        buyOnDate: "Datoen ma ligge innenfor ukeplanens aktive periode.",
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
      },
    });
  });

  it("deletes a manual shopping item together with any manual override rows", async () => {
    dbMock.manualShoppingItem.findFirst.mockResolvedValue({
      id: "manual-item-1",
    });

    const result = await deleteManualShoppingItem({
      familyId: "family-1",
      manualItemId: "manual-item-1",
      mealPlanId: "meal-plan-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      status: "DELETED",
    });
    expect(dbMock.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionMock.shoppingItemOverride.deleteMany).toHaveBeenCalledWith({
      where: {
        mealPlanId: "meal-plan-1",
        sourceKey: "manual-item-1",
        sourceType: ShoppingItemSource.MANUAL,
      },
    });
    expect(transactionMock.manualShoppingItem.delete).toHaveBeenCalledWith({
      where: {
        id: "manual-item-1",
      },
    });
  });

  it("removes manual checked overrides when unchecking a manual row", async () => {
    dbMock.manualShoppingItem.findFirst.mockResolvedValue({
      id: "manual-item-1",
    });
    dbMock.shoppingItemOverride.findUnique.mockResolvedValue({
      checked: true,
      createdAt: new Date("2026-05-15T00:00:00.000Z"),
      id: "override-1",
      mealPlanId: "meal-plan-1",
      note: null,
      postponedUntilDate: null,
      preferredStoreId: null,
      sourceKey: "manual-item-1",
      sourceType: ShoppingItemSource.MANUAL,
      updatedAt: new Date("2026-05-15T00:00:00.000Z"),
    });

    const result = await toggleShoppingItemChecked({
      checked: false,
      familyId: "family-1",
      mealPlanId: "meal-plan-1",
      sourceKey: "manual-item-1",
      sourceType: ShoppingItemSource.MANUAL,
      userId: "user-1",
    });

    expect(result).toEqual({
      status: "UPDATED",
    });
    expect(dbMock.shoppingItemOverride.delete).toHaveBeenCalledWith({
      where: {
        id: "override-1",
      },
    });
    expect(dbMock.shoppingItemOverride.update).not.toHaveBeenCalled();
  });

  it("upserts generated override fields while preserving checked state", async () => {
    dbMock.store.findFirst.mockResolvedValue({
      id: "store-2",
    });
    dbMock.shoppingItemOverride.findUnique.mockResolvedValue({
      checked: true,
      createdAt: new Date("2026-05-15T00:00:00.000Z"),
      id: "override-1",
      mealPlanId: "meal-plan-1",
      note: null,
      postponedUntilDate: null,
      preferredStoreId: null,
      sourceKey: "entry-1:ingredient-1",
      sourceType: ShoppingItemSource.GENERATED,
      updatedAt: new Date("2026-05-15T00:00:00.000Z"),
    });

    const result = await updateGeneratedShoppingItemOverride({
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
    expect(dbMock.shoppingItemOverride.upsert).toHaveBeenCalledWith({
      create: {
        checked: true,
        mealPlanId: "meal-plan-1",
        note: "Husk tilbud",
        postponedUntilDate: new Date("2026-05-17T00:00:00.000Z"),
        preferredStoreId: "store-2",
        sourceKey: "entry-1:ingredient-1",
        sourceType: ShoppingItemSource.GENERATED,
      },
      update: {
        checked: true,
        note: "Husk tilbud",
        postponedUntilDate: new Date("2026-05-17T00:00:00.000Z"),
        preferredStoreId: "store-2",
      },
      where: {
        mealPlanId_sourceType_sourceKey: {
          mealPlanId: "meal-plan-1",
          sourceKey: "entry-1:ingredient-1",
          sourceType: ShoppingItemSource.GENERATED,
        },
      },
    });
  });
});
