import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, requireFamilyMembershipMock } = vi.hoisted(() => {
  return {
    dbMock: {
      familyShoppingCatalogItem: {
        create: vi.fn(),
        deleteMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      ingredient: {
        findFirst: vi.fn(),
      },
      ingredientCategory: {
        findUnique: vi.fn(),
      },
    },
    requireFamilyMembershipMock: vi.fn(),
  };
});

vi.mock("./db.server", () => ({
  db: dbMock,
}));

vi.mock("./family.server", () => ({
  requireFamilyMembership: requireFamilyMembershipMock,
}));

import {
  addFamilyShoppingCatalogItem,
  deleteFamilyShoppingCatalogItem,
  updateFamilyShoppingCatalogItem,
  upsertFamilyShoppingCatalogItem,
  upsertFamilyShoppingCatalogItemFromQuickAdd,
} from "./shopping-catalog-write.server";

describe("shopping-catalog-write.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireFamilyMembershipMock.mockResolvedValue({
      family: { id: "family-1", name: "Solberg" },
      role: "MEMBER",
      userId: "user-1",
    });
    dbMock.ingredient.findFirst.mockResolvedValue(null);
    dbMock.ingredientCategory.findUnique.mockResolvedValue({
      id: "category-other",
    });
    dbMock.familyShoppingCatalogItem.findFirst.mockResolvedValue(null);
    dbMock.familyShoppingCatalogItem.findUnique.mockResolvedValue(null);
  });

  it("creates a catalog item on first custom upsert", async () => {
    dbMock.familyShoppingCatalogItem.create.mockResolvedValue({
      id: "catalog-1",
    });

    const result = await upsertFamilyShoppingCatalogItem({
      categoryId: "category-other",
      displayName: "  Tørkerull  ",
      familyId: "family-1",
      quantity: "1 pk",
    });

    expect(result).toEqual({
      catalogItemId: "catalog-1",
      status: "CREATED",
    });
    expect(dbMock.familyShoppingCatalogItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        defaultCategoryId: "category-other",
        defaultQuantity: "1 pk",
        displayName: "Tørkerull",
        familyId: "family-1",
        nameNormalized: "tørkerull",
      }),
      select: { id: true },
    });
  });

  it("only updates lastUsedAt on a later upsert of the same name", async () => {
    dbMock.familyShoppingCatalogItem.findUnique.mockResolvedValue({
      id: "catalog-1",
    });
    dbMock.familyShoppingCatalogItem.update.mockResolvedValue({
      id: "catalog-1",
    });

    const result = await upsertFamilyShoppingCatalogItem({
      categoryId: "category-household",
      displayName: "Tørkerull",
      familyId: "family-1",
      quantity: "2 pk",
    });

    expect(result).toEqual({
      catalogItemId: "catalog-1",
      status: "UPDATED",
    });
    expect(dbMock.familyShoppingCatalogItem.update).toHaveBeenCalledWith({
      data: {
        lastUsedAt: expect.any(Date),
      },
      where: { id: "catalog-1" },
    });
    expect(dbMock.familyShoppingCatalogItem.create).not.toHaveBeenCalled();
  });

  it("skips upsert for canonical ingredient names", async () => {
    dbMock.ingredient.findFirst.mockResolvedValue({
      canonicalName: "Melk",
      id: "ingredient-milk",
    });

    const result = await upsertFamilyShoppingCatalogItem({
      categoryId: "category-dairy",
      displayName: "Melk",
      familyId: "family-1",
      quantity: "1",
    });

    expect(result).toEqual({ status: "SKIPPED" });
    expect(dbMock.familyShoppingCatalogItem.create).not.toHaveBeenCalled();
  });

  it("skips quick-add upsert when an ingredientId was used", async () => {
    const result = await upsertFamilyShoppingCatalogItemFromQuickAdd({
      familyId: "family-1",
      ingredientId: "ingredient-milk",
      item: {
        category: { id: "category-dairy" },
        name: "Melk",
        quantity: "1",
      },
    });

    expect(result).toEqual({ status: "SKIPPED" });
    expect(dbMock.familyShoppingCatalogItem.findUnique).not.toHaveBeenCalled();
  });

  it("rejects admin add of a duplicate catalog name", async () => {
    dbMock.familyShoppingCatalogItem.findFirst.mockResolvedValue({
      id: "catalog-existing",
    });

    const result = await addFamilyShoppingCatalogItem({
      familyId: "family-1",
      userId: "user-1",
      values: {
        categoryId: "category-other",
        name: "Tørkerull",
        quantity: "1 pk",
      },
    });

    expect(result.status).toBe("VALIDATION_ERROR");
    if (result.status === "VALIDATION_ERROR") {
      expect(result.fieldErrors.name).toBe(
        "Det finnes allerede en handlevare med dette navnet.",
      );
    }
    expect(dbMock.familyShoppingCatalogItem.create).not.toHaveBeenCalled();
  });

  it("rejects renaming onto another catalog name", async () => {
    dbMock.familyShoppingCatalogItem.findFirst.mockResolvedValue({
      id: "catalog-other",
    });

    const result = await updateFamilyShoppingCatalogItem({
      catalogItemId: "catalog-1",
      familyId: "family-1",
      userId: "user-1",
      values: {
        categoryId: "category-other",
        name: "Tannkrem",
        quantity: "1",
      },
    });

    expect(result.status).toBe("VALIDATION_ERROR");
    if (result.status === "VALIDATION_ERROR") {
      expect(result.fieldErrors.name).toBe(
        "Det finnes allerede en handlevare med dette navnet.",
      );
    }
  });

  it("updates a catalog item", async () => {
    dbMock.familyShoppingCatalogItem.updateMany.mockResolvedValue({ count: 1 });

    const result = await updateFamilyShoppingCatalogItem({
      catalogItemId: "catalog-1",
      familyId: "family-1",
      userId: "user-1",
      values: {
        categoryId: "category-other",
        name: "Tørkerull XL",
        quantity: "2 pk",
      },
    });

    expect(result).toEqual({ status: "UPDATED" });
    expect(dbMock.familyShoppingCatalogItem.updateMany).toHaveBeenCalledWith({
      data: {
        defaultCategoryId: "category-other",
        defaultQuantity: "2 pk",
        displayName: "Tørkerull XL",
        nameNormalized: "tørkerull xl",
      },
      where: {
        familyId: "family-1",
        id: "catalog-1",
      },
    });
  });

  it("deletes a catalog item", async () => {
    dbMock.familyShoppingCatalogItem.deleteMany.mockResolvedValue({ count: 1 });

    const result = await deleteFamilyShoppingCatalogItem({
      catalogItemId: "catalog-1",
      familyId: "family-1",
      userId: "user-1",
    });

    expect(result).toEqual({ status: "DELETED" });
  });
});
