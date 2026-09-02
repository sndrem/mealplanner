import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, requireFamilyAdminMock, transactionMock, r2Mocks } = vi.hoisted(() => {
  const transactionMock = {
    recipe: {
      update: vi.fn(),
    },
    recipeIngredient: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    recipeReminderSuggestion: {
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
        update: vi.fn(),
      },
      store: {
        findMany: vi.fn(),
      },
    },
    r2Mocks: {
      deleteR2Object: vi.fn(),
      isR2Configured: vi.fn(() => false),
      uploadRecipeCover: vi.fn(),
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

vi.mock("./r2.server", () => {
  return {
    RECIPE_COVER_CONTENT_TYPES: ["image/jpeg", "image/png", "image/webp"],
    RECIPE_COVER_MAX_BYTES: 2 * 1024 * 1024,
    deleteR2Object: r2Mocks.deleteR2Object,
    isR2Configured: r2Mocks.isR2Configured,
    uploadRecipeCover: r2Mocks.uploadRecipeCover,
  };
});

import { listIngredientCategories } from "./store.server";
import {
  createFamilyRecipe,
  deleteFamilyRecipe,
  parseFamilyRecipeCoverInput,
  parseFamilyRecipeValues,
  updateFamilyRecipe,
  validateRecipeCoverFile,
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
  reminderSuggestions: [] as Array<{
    note: string;
    timingKind: string;
    title: string;
  }>,
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
        key: "meat-fish",
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

  it("creates a family recipe with ordered reminder suggestions", async () => {
    dbMock.recipe.create.mockResolvedValue({
      id: "recipe-1",
      title: "Kyllingwok",
    });

    const result = await createFamilyRecipe({
      familyId: "family-1",
      userId: "user-1",
      values: {
        ...baseValues,
        reminderSuggestions: [
          {
            note: "Ta ut kvelden før",
            timingKind: "HOURS_BEFORE_16",
            title: "Ta deigen ut av kjøleskapet",
          },
          {
            note: "",
            timingKind: "MORNING_OF",
            title: "Sett ovnen på",
          },
        ],
      },
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
        reminderSuggestions: {
          create: [
            {
              note: "Ta ut kvelden før",
              sortOrder: 1,
              timingKind: "HOURS_BEFORE_16",
              title: "Ta deigen ut av kjøleskapet",
            },
            {
              note: null,
              sortOrder: 2,
              timingKind: "MORNING_OF",
              title: "Sett ovnen på",
            },
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
      imageKey: null,
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
    expect(transactionMock.recipeReminderSuggestion.deleteMany).toHaveBeenCalledWith({
      where: {
        recipeId: "recipe-1",
      },
    });
    expect(transactionMock.recipeReminderSuggestion.createMany).not.toHaveBeenCalled();
  });

  it("replaces reminder suggestions transactionally on update", async () => {
    dbMock.recipe.findFirst.mockResolvedValue({
      id: "recipe-1",
      imageKey: null,
    });

    const result = await updateFamilyRecipe({
      familyId: "family-1",
      recipeId: "recipe-1",
      userId: "user-1",
      values: {
        ...baseValues,
        reminderSuggestions: [
          {
            note: "Ta ut kvelden før",
            timingKind: "HOURS_BEFORE_16",
            title: "Ta deigen ut av kjøleskapet",
          },
          {
            note: "",
            timingKind: "MORNING_OF",
            title: "Sett ovnen på",
          },
        ],
      },
    });

    expect(result).toEqual({ status: "UPDATED" });
    expect(transactionMock.recipeReminderSuggestion.deleteMany).toHaveBeenCalledWith({
      where: {
        recipeId: "recipe-1",
      },
    });
    expect(transactionMock.recipeReminderSuggestion.createMany).toHaveBeenCalledWith({
      data: [
        {
          note: "Ta ut kvelden før",
          recipeId: "recipe-1",
          sortOrder: 1,
          timingKind: "HOURS_BEFORE_16",
          title: "Ta deigen ut av kjøleskapet",
        },
        {
          note: null,
          recipeId: "recipe-1",
          sortOrder: 2,
          timingKind: "MORNING_OF",
          title: "Sett ovnen på",
        },
      ],
    });
  });

  it("rejects reminder rows that have a note but no title", async () => {
    dbMock.recipe.findFirst.mockResolvedValue({
      id: "recipe-1",
      imageKey: null,
    });

    const result = await updateFamilyRecipe({
      familyId: "family-1",
      recipeId: "recipe-1",
      userId: "user-1",
      values: {
        ...baseValues,
        reminderSuggestions: [
          {
            note: "Husk deigen",
            timingKind: "",
            title: "   ",
          },
        ],
      },
    });

    expect(result.status).toBe("VALIDATION_ERROR");
    if (result.status !== "VALIDATION_ERROR") {
      return;
    }

    expect(result.fieldErrors.reminderTitles?.[0]).toBe("Skriv inn en tittel.");
    expect(transactionMock.recipeReminderSuggestion.createMany).not.toHaveBeenCalled();
  });

  it("parses reminder suggestion fields from form data", () => {
    const formData = new FormData();
    formData.set("title", "Pizza");
    formData.append("ingredientIndex", "0");
    formData.set("ingredientDisplayName:0", "Mel");
    formData.set("ingredientCategoryId:0", "category-dry");
    formData.append("reminderIndex", "0");
    formData.set("reminderTitle:0", "Ta deigen ut");
    formData.set("reminderNote:0", "Fra kjøleskapet");
    formData.set("reminderTimingKind:0", "HOURS_BEFORE_16");
    formData.append("reminderIndex", "1");
    formData.set("reminderTitle:1", "   ");
    formData.set("reminderNote:1", "");
    formData.set("reminderTimingKind:1", "");

    expect(parseFamilyRecipeValues(formData).reminderSuggestions).toEqual([
      {
        note: "Fra kjøleskapet",
        timingKind: "HOURS_BEFORE_16",
        title: "Ta deigen ut",
      },
      {
        note: "",
        timingKind: "",
        title: "   ",
      },
    ]);
  });

  it("uploads a cover image when creating a recipe", async () => {
    r2Mocks.isR2Configured.mockReturnValue(true);
    r2Mocks.uploadRecipeCover.mockResolvedValue(
      "families/family-1/recipes/recipe-1/cover.jpg",
    );
    dbMock.recipe.create.mockResolvedValue({
      id: "recipe-1",
      title: "Kyllingwok",
    });
    dbMock.recipe.update.mockResolvedValue({});

    const file = new File([new Uint8Array([1, 2, 3])], "cover.jpg", {
      type: "image/jpeg",
    });

    const result = await createFamilyRecipe({
      cover: { file, remove: false },
      familyId: "family-1",
      userId: "user-1",
      values: baseValues,
    });

    expect(result.status).toBe("CREATED");
    expect(r2Mocks.uploadRecipeCover).toHaveBeenCalled();
    expect(dbMock.recipe.update).toHaveBeenCalledWith({
      data: {
        imageKey: "families/family-1/recipes/recipe-1/cover.jpg",
      },
      where: { id: "recipe-1" },
    });
  });

  it("rejects oversized cover images", () => {
    r2Mocks.isR2Configured.mockReturnValue(true);
    const file = new File([new Uint8Array(3 * 1024 * 1024)], "big.jpg", {
      type: "image/jpeg",
    });

    expect(validateRecipeCoverFile(file)).toEqual({
      error: "Coverbildet kan være maks 2 MB.",
      ok: false,
    });
  });

  it("parses removeCoverImage from form data", () => {
    const formData = new FormData();
    formData.set("removeCoverImage", "1");

    expect(parseFamilyRecipeCoverInput(formData)).toEqual({
      file: null,
      remove: true,
    });
  });

  it("removes an existing cover image on update", async () => {
    r2Mocks.isR2Configured.mockReturnValue(true);
    dbMock.recipe.findFirst.mockResolvedValue({
      id: "recipe-1",
      imageKey: "families/family-1/recipes/recipe-1/cover.jpg",
    });

    const result = await updateFamilyRecipe({
      cover: { file: null, remove: true },
      familyId: "family-1",
      recipeId: "recipe-1",
      userId: "user-1",
      values: baseValues,
    });

    expect(result).toEqual({ status: "UPDATED" });
    expect(transactionMock.recipe.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          imageKey: null,
        }),
      }),
    );
    expect(r2Mocks.deleteR2Object).toHaveBeenCalledWith(
      "families/family-1/recipes/recipe-1/cover.jpg",
    );
  });

  it("blocks delete when recipe is used in meal plans", async () => {
    dbMock.recipe.findFirst.mockResolvedValue({
      _count: {
        mealPlanEntries: 2,
      },
      id: "recipe-1",
      imageKey: null,
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

  it("deletes unused family recipes and their cover objects", async () => {
    dbMock.recipe.findFirst.mockResolvedValue({
      _count: {
        mealPlanEntries: 0,
      },
      id: "recipe-1",
      imageKey: "families/family-1/recipes/recipe-1/cover.jpg",
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
    expect(r2Mocks.deleteR2Object).toHaveBeenCalledWith(
      "families/family-1/recipes/recipe-1/cover.jpg",
    );
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
