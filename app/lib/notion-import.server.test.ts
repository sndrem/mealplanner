import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  dbMock,
  notionQueryMock,
  transactionMock,
} = vi.hoisted(() => {
  const notionQueryMock = vi.fn();
  const transactionMock = {
    ingredient: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    ingredientCategory: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    recipe: {
      create: vi.fn(),
      findFirst: vi.fn(),
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
    },
    notionQueryMock,
    transactionMock,
  };
});

vi.mock("@notionhq/client", () => {
  return {
    Client: vi.fn().mockImplementation(() => ({
      dataSources: {
        query: notionQueryMock,
      },
    })),
  };
});

vi.mock("./env.server", () => {
  return {
    env: {
      NOTION_API_TOKEN: "secret",
      NOTION_INGREDIENTS_DATABASE_ID: "12345678-1234-1234-1234-123456789abc",
      NOTION_RECIPES_DATABASE_ID: "abcdefab-cdef-cdef-cdef-abcdefabcdef",
    },
  };
});

vi.mock("./db.server", () => {
  return {
    db: dbMock,
  };
});

import { runNotionImport, validateNotionPayload } from "./notion-import.server";

describe("notion-import.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.$transaction.mockImplementation(async (callback: (tx: typeof transactionMock) => unknown) =>
      callback(transactionMock),
    );
    transactionMock.ingredientCategory.findMany.mockResolvedValue([
      { id: "cat-other", key: "other" },
    ]);
    transactionMock.ingredient.findFirst.mockResolvedValue(null);
    transactionMock.ingredient.findUnique.mockResolvedValue(null);
    transactionMock.ingredient.create.mockResolvedValue({
      canonicalName: "tomat",
      defaultCategoryId: "cat-veg",
      id: "ingredient-1",
      sourceExternalId: "ingredient-page-1",
    });
    transactionMock.ingredient.update.mockResolvedValue({
      canonicalName: "tomat",
      defaultCategoryId: "cat-veg",
      id: "ingredient-1",
      sourceExternalId: "ingredient-page-1",
    });
    transactionMock.ingredientCategory.create.mockResolvedValue({
      id: "cat-veg",
      key: "gronnsaker",
    });
    transactionMock.recipe.findFirst.mockResolvedValue(null);
    transactionMock.ingredient.upsert.mockResolvedValue({
      canonicalName: "salt",
      defaultCategoryId: "cat-other",
      id: "ingredient-salt",
      sourceExternalId: null,
    });
  });

  it("validates Notion payload in dry-run mode", async () => {
    notionQueryMock
      .mockResolvedValueOnce({
        has_more: false,
        next_cursor: null,
        results: [
          notionIngredientPage({
            category: "Gronnsaker",
            id: "ingredient-page-1",
            name: "Tomat",
            quantityForOne: 2,
            unit: "stk",
          }),
        ],
      })
      .mockResolvedValueOnce({
        has_more: false,
        next_cursor: null,
        results: [
          notionRecipePage({
            id: "recipe-page-1",
            ingredientRelationIds: ["ingredient-page-1"],
            title: "Tomatsalat",
          }),
        ],
      });

    const summary = await validateNotionPayload();

    expect(summary.mode).toBe("DRY_RUN");
    expect(summary.categories.created).toBe(2);
    expect(summary.ingredients.created).toBe(1);
    expect(summary.recipes.created).toBe(1);
    expect(summary.ingredients.errors).toHaveLength(0);
    expect(summary.recipes.errors).toHaveLength(0);
  });

  it("imports categories, ingredients and recipes with fallback ingredient creation", async () => {
    notionQueryMock
      .mockResolvedValueOnce({
        has_more: false,
        next_cursor: null,
        results: [
          notionIngredientPage({
            category: "Gronnsaker",
            id: "ingredient-page-1",
            name: "Tomat",
            quantityForOne: 2,
            unit: "stk",
          }),
        ],
      })
      .mockResolvedValueOnce({
        has_more: false,
        next_cursor: null,
        results: [
          notionRecipePage({
            id: "recipe-page-1",
            ingredients: "Tomat|2|stk|Gronnsaker\nSalt|1|ts|Annet",
            title: "Tomatsalat",
          }),
        ],
      });

    const summary = await runNotionImport({
      dryRun: false,
      familyId: "family-1",
      userId: "user-1",
    });

    expect(summary.mode).toBe("APPLY");
    expect(summary.categories.created).toBe(1);
    expect(summary.ingredients.created).toBe(1);
    expect(summary.recipes.created).toBe(1);
    expect(transactionMock.ingredient.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          canonicalName: "salt",
        },
      }),
    );
    expect(transactionMock.recipe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          familyId: "family-1",
          scope: "FAMILY",
          source: "NOTION",
          sourceExternalId: "recipe-page-1",
        }),
      }),
    );
  });
});

function notionIngredientPage({
  category,
  id,
  name,
  quantityForOne,
  unit,
}: {
  category: string;
  id: string;
  name: string;
  quantityForOne?: number;
  unit?: string;
}) {
  return {
    id,
    object: "page",
    properties: {
      Category: {
        select: {
          name: category,
        },
        type: "select",
      },
      Name: {
        title: [{ plain_text: name }],
        type: "title",
      },
      "Quantity for 1": {
        number: quantityForOne ?? null,
        type: "number",
      },
      Unit: {
        select: unit ? { name: unit } : null,
        type: "select",
      },
    },
  };
}

function notionRecipePage({
  id,
  ingredients,
  ingredientRelationIds,
  title,
}: {
  id: string;
  ingredients?: string;
  ingredientRelationIds?: string[];
  title: string;
}) {
  return {
    id,
    object: "page",
    properties: {
      Ingredients: {
        relation: (ingredientRelationIds ?? []).map((relationId) => ({
          id: relationId,
        })),
        type: ingredientRelationIds ? "relation" : "rich_text",
        ...(ingredientRelationIds
          ? {}
          : { rich_text: [{ plain_text: ingredients ?? "" }] }),
      },
      Name: {
        title: [{ plain_text: title }],
        type: "title",
      },
      Tags: {
        multi_select: [],
        type: "multi_select",
      },
    },
  };
}
