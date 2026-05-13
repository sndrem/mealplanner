import { describe, expect, it } from "vitest";

import { buildIngredientSeeds, validateSeedData } from "./seed-data";

describe("seed-data", () => {
  it("validates the starter seed fixtures", () => {
    expect(validateSeedData()).toEqual({
      categoryCount: 9,
      ingredientCount: 38,
      recipeCount: 7,
      storeCount: 3,
    });
  });

  it("deduplicates ingredient seeds by canonical name", () => {
    let ingredients = buildIngredientSeeds([
      {
        id: "recipe-1",
        title: "Recipe 1",
        description: "Desc",
        prepMinutes: 10,
        defaultServings: 4,
        tags: [],
        ingredients: [{ key: "one", displayName: "Tomater", categoryKey: "produce" }],
      },
      {
        id: "recipe-2",
        title: "Recipe 2",
        description: "Desc",
        prepMinutes: 10,
        defaultServings: 4,
        tags: [],
        ingredients: [{ key: "two", displayName: " tomater ", categoryKey: "produce" }],
      },
    ]);

    expect(ingredients).toEqual([{ canonicalName: "tomater", defaultCategoryKey: "produce" }]);
  });

  it("throws when the same ingredient is assigned to multiple categories", () => {
    expect(() =>
      buildIngredientSeeds([
        {
          id: "recipe-1",
          title: "Recipe 1",
          description: "Desc",
          prepMinutes: 10,
          defaultServings: 4,
          tags: [],
          ingredients: [{ key: "one", displayName: "Tomater", categoryKey: "produce" }],
        },
        {
          id: "recipe-2",
          title: "Recipe 2",
          description: "Desc",
          prepMinutes: 10,
          defaultServings: 4,
          tags: [],
          ingredients: [{ key: "two", displayName: "tomater", categoryKey: "pantry" }],
        },
      ]),
    ).toThrow(/multiple categories/i);
  });
});
