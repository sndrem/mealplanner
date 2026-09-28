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
  ensureFamilyStockIngredient,
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

  it("creates a canonical stock ingredient when ensuring it is missing", async () => {
    dbMock.ingredient.findUnique.mockResolvedValue({ id: "ingredient-salt" });
    dbMock.familyStockIngredient.findUnique.mockResolvedValue(null);
    dbMock.familyStockIngredient.create.mockResolvedValue({ id: "stock-1" });

    const result = await ensureFamilyStockIngredient({
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
  });

  it("creates a display-name stock ingredient when ensuring an unlinked name", async () => {
    dbMock.familyStockIngredient.findUnique.mockResolvedValue(null);
    dbMock.familyStockIngredient.create.mockResolvedValue({ id: "stock-2" });

    const result = await ensureFamilyStockIngredient({
      familyId: "family-1",
      userId: "user-1",
      values: {
        displayName: "Olivenolje",
        ingredientId: "",
        note: "",
      },
    });

    expect(result.status).toBe("CREATED");
    expect(dbMock.familyStockIngredient.create).toHaveBeenCalledWith({
      data: {
        displayNameNormalized: "olivenolje",
        familyId: "family-1",
        note: null,
      },
      select: {
        id: true,
      },
    });
  });

  it("treats an existing stock ingredient as success when ensuring it", async () => {
    dbMock.ingredient.findUnique.mockResolvedValue({ id: "ingredient-salt" });
    dbMock.familyStockIngredient.findUnique.mockResolvedValue({ id: "stock-1" });

    const ensured = await ensureFamilyStockIngredient({
      familyId: "family-1",
      userId: "user-1",
      values: {
        displayName: "",
        ingredientId: "ingredient-salt",
        note: "",
      },
    });
    const added = await addFamilyStockIngredient({
      familyId: "family-1",
      userId: "user-1",
      values: {
        displayName: "",
        ingredientId: "ingredient-salt",
        note: "",
      },
    });

    expect(ensured).toEqual({
      status: "ALREADY_EXISTS",
      stockIngredientId: "stock-1",
    });
    expect(added.status).toBe("VALIDATION_ERROR");
    expect(dbMock.familyStockIngredient.create).not.toHaveBeenCalled();
  });

  it("rejects non-admins when ensuring a stock ingredient", async () => {
    requireFamilyAdminMock.mockRejectedValue(
      new Response("Du har ikke tilgang til å administrere denne familien.", {
        status: 403,
      }),
    );

    await expect(
      ensureFamilyStockIngredient({
        familyId: "family-1",
        userId: "user-1",
        values: {
          displayName: "Salt",
          ingredientId: "",
          note: "",
        },
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(dbMock.familyStockIngredient.create).not.toHaveBeenCalled();
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
