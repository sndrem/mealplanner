import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, requireFamilyAdminMock } = vi.hoisted(() => {
  return {
    dbMock: {
      familyStockIngredient: {
        create: vi.fn(),
        deleteMany: vi.fn(),
        findUnique: vi.fn(),
      },
      ingredient: {
        findUnique: vi.fn(),
      },
    },
    requireFamilyAdminMock: vi.fn(),
  };
});

vi.mock("./db.server", () => ({
  db: dbMock,
}));

vi.mock("./family.server", () => ({
  requireFamilyAdmin: requireFamilyAdminMock,
}));

import {
  addFamilyStockIngredient,
  removeFamilyStockIngredient,
} from "./stock-write.server";

describe("stock-write.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireFamilyAdminMock.mockResolvedValue({
      familyId: "family-1",
      role: "ADMIN",
      userId: "user-1",
    });
  });

  it("rejects empty stock ingredient input", async () => {
    const result = await addFamilyStockIngredient({
      familyId: "family-1",
      userId: "user-1",
      values: {
        displayName: "   ",
        ingredientId: "",
        note: "",
      },
    });

    expect(result.status).toBe("VALIDATION_ERROR");
    expect(result.fieldErrors?.displayName).toBeTruthy();
  });

  it("creates a canonical stock ingredient", async () => {
    dbMock.ingredient.findUnique.mockResolvedValue({ id: "ingredient-salt" });
    dbMock.familyStockIngredient.findUnique.mockResolvedValue(null);
    dbMock.familyStockIngredient.create.mockResolvedValue({ id: "stock-1" });

    const result = await addFamilyStockIngredient({
      familyId: "family-1",
      userId: "user-1",
      values: {
        displayName: "",
        ingredientId: "ingredient-salt",
        note: "",
      },
    });

    expect(result).toEqual({
      status: "CREATED",
      stockIngredientId: "stock-1",
    });
    expect(dbMock.familyStockIngredient.create).toHaveBeenCalledWith({
      data: {
        familyId: "family-1",
        ingredientId: "ingredient-salt",
        note: null,
      },
      select: {
        id: true,
      },
    });
  });

  it("creates a display-name stock ingredient when canonical id is missing", async () => {
    dbMock.familyStockIngredient.findUnique.mockResolvedValue(null);
    dbMock.familyStockIngredient.create.mockResolvedValue({ id: "stock-2" });

    const result = await addFamilyStockIngredient({
      familyId: "family-1",
      userId: "user-1",
      values: {
        displayName: "Olivenolje",
        ingredientId: "",
        note: "Extra virgin",
      },
    });

    expect(result.status).toBe("CREATED");
    expect(dbMock.familyStockIngredient.create).toHaveBeenCalledWith({
      data: {
        displayNameNormalized: "olivenolje",
        familyId: "family-1",
        note: "Extra virgin",
      },
      select: {
        id: true,
      },
    });
  });

  it("removes a family stock ingredient", async () => {
    dbMock.familyStockIngredient.deleteMany.mockResolvedValue({ count: 1 });

    const result = await removeFamilyStockIngredient({
      familyId: "family-1",
      stockIngredientId: "stock-1",
      userId: "user-1",
    });

    expect(result.status).toBe("DELETED");
  });
});
