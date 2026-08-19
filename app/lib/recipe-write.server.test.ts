import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, requireFamilyAdminMock, transactionMock } = vi.hoisted(() => {
  const transactionMock = {
    recipe: {
      update: vi.fn(),
    },
    recipeIngredient: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  };

  return {
    dbMock: {
      $transaction: vi.fn(),
      recipe: {
        create: vi.fn(),
        delete: vi.fn(),
        findFirst: vi.fn(),
      },
      store: {
        findMany: vi.fn(),
      },
    },
    requireFamilyAdminMock: vi.fn(),
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
    requireFamilyAdmin: requireFamilyAdminMock,
  };
});

vi.mock("./store.server", () => {
  return {
    listIngredientCategories: vi.fn(),
  };
});

import { listIngredientCategories } from "./store.server";
import {
  createFamilyRecipe,
  deleteFamilyRecipe,
  updateFamilyRecipe,
} from "./recipe-write.server";

const baseValues = {
  defaultServings: "4",
  description: "En god middag",
  ingredients: [
    {
      amount: "500",
      categoryId: "category-meat",
      displayName: "Kyllingfilet",
      preferredStoreId: "",
      unit: "g",
    },
  ],
  prepMinutes: "30",
  tags: "middag, rask",
  title: "Kyllingwok",
};

describe("recipe-write.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireFamilyAdminMock.mockResolvedValue({
      familyId: "family-1",
      role: "ADMIN",
      userId: "user-1",
    });
    vi.mocked(listIngredientCategories).mockResolvedValue([
      {
        displayName: "Kjott og fisk",
        familyId: null,
        id: "category-meat",
      },
    ]);
    dbMock.store.findMany.mockResolvedValue([
      {
        id: "store-1",
      },
    ]);
    dbMock.$transaction.mockImplementation(async (callback: (tx: typeof transactionMock) => unknown) =>
      callback(transactionMock),
    );
  });

  it("returns validation errors before creating a family recipe", async () => {
    const result = await createFamilyRecipe({
      familyId: "family-1",
      userId: "user-1",
      values: {
        ...baseValues,
        ingredients: [],
        title: "   ",
      },
    });

    expect(result).toEqual({
      fieldErrors: {
        ingredients: "Legg til minst en ingrediens.",
        title: "Skriv inn en tittel.",
      },
      status: "VALIDATION_ERROR",
      values: {
        ...baseValues,
        ingredients: [],
        title: "",
      },
    });
    expect(dbMock.recipe.create).not.toHaveBeenCalled();
  });

  it("creates a family recipe with ordered ingredients", async () => {
    dbMock.recipe.create.mockResolvedValue({
      id: "recipe-1",
      title: "Kyllingwok",
    });

    const result = await createFamilyRecipe({
      familyId: "family-1",
      userId: "user-1",
      values: baseValues,
    });

    expect(result).toEqual({
      recipe: {
        id: "recipe-1",
        title: "Kyllingwok",
      },
      status: "CREATED",
    });
    expect(dbMock.recipe.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        familyId: "family-1",
        scope: "FAMILY",
        title: "Kyllingwok",
        ingredients: {
          create: [
            expect.objectContaining({
              displayName: "Kyllingfilet",
              sortOrder: 1,
            }),
          ],
        },
      }),
      select: {
        id: true,
        title: true,
      },
    });
  });

  it("replaces ingredients transactionally on update", async () => {
    dbMock.recipe.findFirst.mockResolvedValue({
      id: "recipe-1",
    });

    const result = await updateFamilyRecipe({
      familyId: "family-1",
      recipeId: "recipe-1",
      userId: "user-1",
      values: baseValues,
    });

    expect(result).toEqual({ status: "UPDATED" });
    expect(transactionMock.recipeIngredient.deleteMany).toHaveBeenCalledWith({
      where: {
        recipeId: "recipe-1",
      },
    });
    expect(transactionMock.recipeIngredient.createMany).toHaveBeenCalled();
  });

  it("blocks delete when recipe is used in meal plans", async () => {
    dbMock.recipe.findFirst.mockResolvedValue({
      _count: {
        mealPlanEntries: 2,
      },
      id: "recipe-1",
      title: "Kyllingwok",
    });

    const result = await deleteFamilyRecipe({
      familyId: "family-1",
      recipeId: "recipe-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      entryCount: 2,
      status: "IN_USE",
      title: "Kyllingwok",
    });
    expect(dbMock.recipe.delete).not.toHaveBeenCalled();
  });

  it("deletes unused family recipes", async () => {
    dbMock.recipe.findFirst.mockResolvedValue({
      _count: {
        mealPlanEntries: 0,
      },
      id: "recipe-1",
      title: "Kyllingwok",
    });

    const result = await deleteFamilyRecipe({
      familyId: "family-1",
      recipeId: "recipe-1",
      userId: "user-1",
    });

    expect(result).toEqual({ status: "DELETED" });
    expect(dbMock.recipe.delete).toHaveBeenCalledWith({
      where: {
        id: "recipe-1",
      },
    });
  });

  it("returns not found for missing family recipes", async () => {
    dbMock.recipe.findFirst.mockResolvedValue(null);

    const result = await updateFamilyRecipe({
      familyId: "family-1",
      recipeId: "global-recipe",
      userId: "user-1",
      values: baseValues,
    });

    expect(result).toEqual({ status: "NOT_FOUND" });
  });

  it("rejects preferred stores outside the family", async () => {
    const result = await createFamilyRecipe({
      familyId: "family-1",
      userId: "user-1",
      values: {
        ...baseValues,
        ingredients: [
          {
            ...baseValues.ingredients[0],
            preferredStoreId: "other-store",
          },
        ],
      },
    });

    expect(result.status).toBe("VALIDATION_ERROR");
    expect(result).toMatchObject({
      fieldErrors: {
        ingredientCategories: {
          0: "Foretrukket butikk må tilhøre familien.",
        },
      },
    });
  });
});
