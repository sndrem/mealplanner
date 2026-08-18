import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, requireFamilyMembershipMock, searchCanonicalIngredientsMock } =
  vi.hoisted(() => {
    return {
      dbMock: {
        familyShoppingCatalogItem: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
          findUnique: vi.fn(),
        },
        ingredient: {
          findFirst: vi.fn(),
        },
      },
      requireFamilyMembershipMock: vi.fn(),
      searchCanonicalIngredientsMock: vi.fn(),
    };
  });

vi.mock("./db.server", () => ({
  db: dbMock,
}));

vi.mock("./family.server", () => ({
  requireFamilyMembership: requireFamilyMembershipMock,
}));

vi.mock("./stock.server", () => ({
  searchCanonicalIngredients: searchCanonicalIngredientsMock,
}));

import {
  listFamilyShoppingCatalogItems,
  searchShoppingQuickAddSuggestions,
} from "./shopping-catalog.server";

const catalogPaperTowels = {
  defaultCategory: {
    displayName: "Annet",
    id: "category-other",
  },
  defaultCategoryId: "category-other",
  defaultQuantity: "1 pk",
  displayName: "Tørkerull",
  id: "catalog-1",
  lastUsedAt: new Date("2026-08-18T00:00:00.000Z"),
  nameNormalized: "tørkerull",
};

describe("shopping-catalog.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireFamilyMembershipMock.mockResolvedValue({
      family: {
        id: "family-1",
        name: "Solberg",
      },
      role: "MEMBER",
      userId: "user-1",
    });
  });

  it("lists family catalog items", async () => {
    dbMock.familyShoppingCatalogItem.findMany.mockResolvedValue([
      catalogPaperTowels,
    ]);

    const result = await listFamilyShoppingCatalogItems({
      familyId: "family-1",
      userId: "user-1",
    });

    expect(result.catalogItems).toEqual([catalogPaperTowels]);
    expect(result.family).toEqual({
      id: "family-1",
      name: "Solberg",
    });
    expect(dbMock.familyShoppingCatalogItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { familyId: "family-1" },
      }),
    );
  });

  it("merges catalog and register suggestions and prefers catalog duplicates", async () => {
    dbMock.familyShoppingCatalogItem.findMany.mockResolvedValue([
      catalogPaperTowels,
      {
        ...catalogPaperTowels,
        defaultQuantity: "2 l",
        displayName: "Melk",
        id: "catalog-milk",
        nameNormalized: "melk",
      },
    ]);
    searchCanonicalIngredientsMock.mockResolvedValue([
      {
        canonicalName: "Melk",
        defaultCategoryId: "category-dairy",
        id: "ingredient-milk",
      },
      {
        canonicalName: "Melkesjokolade",
        defaultCategoryId: "category-sweets",
        id: "ingredient-chocolate",
      },
    ]);

    const result = await searchShoppingQuickAddSuggestions({
      familyId: "family-1",
      query: "mel",
    });

    expect(result).toEqual([
      {
        canonicalName: "Tørkerull",
        defaultCategoryId: "category-other",
        defaultQuantity: "1 pk",
        id: "catalog-1",
        source: "catalog",
      },
      {
        canonicalName: "Melk",
        defaultCategoryId: "category-other",
        defaultQuantity: "2 l",
        id: "catalog-milk",
        source: "catalog",
      },
      {
        canonicalName: "Melkesjokolade",
        defaultCategoryId: "category-sweets",
        defaultQuantity: null,
        id: "ingredient-chocolate",
        source: "register",
      },
    ]);
  });
});
