import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, requireFamilyMembershipMock } = vi.hoisted(() => {
  return {
    dbMock: {
      familyStockIngredient: {
        findMany: vi.fn(),
      },
      ingredient: {
        findMany: vi.fn(),
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
  getFamilyStockMatchSet,
  isStockIngredientMatch,
  listFamilyStockIngredients,
} from "./stock.server";

describe("stock.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireFamilyMembershipMock.mockResolvedValue({
      family: {
        id: "family-1",
        joinCode: "ABC123",
        name: "Solberg",
      },
      familyId: "family-1",
      role: "ADMIN",
      userId: "user-1",
    });
  });

  it("builds a match set from ingredient ids and normalized display names", async () => {
    dbMock.familyStockIngredient.findMany.mockResolvedValue([
      {
        displayNameNormalized: null,
        ingredientId: "ingredient-salt",
      },
      {
        displayNameNormalized: "olivenolje",
        ingredientId: null,
      },
    ]);

    const matchSet = await getFamilyStockMatchSet("family-1");

    expect(matchSet.ingredientIds).toEqual(new Set(["ingredient-salt"]));
    expect(matchSet.displayNameNormalized).toEqual(new Set(["olivenolje"]));
  });

  it("matches recipe ingredients by ingredient id or normalized display name", () => {
    const matchSet = {
      displayNameNormalized: new Set(["salt"]),
      ingredientIds: new Set(["ingredient-salt"]),
    };

    expect(
      isStockIngredientMatch(
        { displayName: "Salt", ingredientId: "ingredient-salt" },
        matchSet,
      ),
    ).toBe(true);
    expect(
      isStockIngredientMatch(
        { displayName: "Salt", ingredientId: null },
        matchSet,
      ),
    ).toBe(true);
    expect(
      isStockIngredientMatch(
        { displayName: "Paprika", ingredientId: null },
        matchSet,
      ),
    ).toBe(false);
  });

  it("lists formatted family stock ingredients for members", async () => {
    dbMock.familyStockIngredient.findMany.mockResolvedValue([
      {
        displayNameNormalized: null,
        id: "stock-1",
        ingredient: {
          canonicalName: "salt",
          id: "ingredient-salt",
        },
        ingredientId: "ingredient-salt",
        note: null,
      },
    ]);

    const result = await listFamilyStockIngredients({
      familyId: "family-1",
      userId: "user-1",
    });

    expect(result.stockIngredients).toEqual([
      {
        displayLabel: "salt",
        displayNameNormalized: null,
        id: "stock-1",
        ingredientId: "ingredient-salt",
        note: null,
      },
    ]);
    expect(result.userRole).toBe("ADMIN");
  });
});
