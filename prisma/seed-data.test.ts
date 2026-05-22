import { describe, expect, it } from "vitest";

import {
  buildIngredientSeeds,
  catalogIngredientSeeds,
  parseCatalogIngredientCsv,
  validateSeedData,
} from "./seed-data";

describe("seed-data", () => {
  it("validates the starter seed fixtures", () => {
    expect(validateSeedData()).toEqual({
      categoryCount: 9,
      ingredientCount: 181,
      recipeCount: 0,
      storeCount: 0,
      catalogIngredientCount: 181,
    });
  });

  it("loads the manual shopping catalog with display casing preserved", () => {
    expect(catalogIngredientSeeds).toHaveLength(181);

    expect(
      catalogIngredientSeeds.find((item) => item.name === "Toalettpapir"),
    ).toEqual({
      name: "Toalettpapir",
      categoryKey: "household",
    });
  });

  it("includes catalog ingredients in buildIngredientSeeds", () => {
    const ingredients = buildIngredientSeeds();

    expect(ingredients).toHaveLength(181);
    expect(ingredients).toContainEqual({
      canonicalName: "Toalettpapir",
      defaultCategoryKey: "household",
    });
  });

  it("deduplicates ingredient seeds by canonical name", () => {
    let ingredients = buildIngredientSeeds(
      [
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
      ],
      [],
    );

    expect(ingredients).toEqual([{ canonicalName: "tomater", defaultCategoryKey: "produce" }]);
  });

  it("throws when the same ingredient is assigned to multiple categories", () => {
    expect(() =>
      buildIngredientSeeds(
        [
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
        ],
        [],
      ),
    ).toThrow(/multiple categories/i);
  });

  it("throws when catalog and recipe seeds disagree on category", () => {
    expect(() =>
      buildIngredientSeeds(
        [
          {
            id: "recipe-1",
            title: "Recipe 1",
            description: "Desc",
            prepMinutes: 10,
            defaultServings: 4,
            tags: [],
            ingredients: [{ key: "one", displayName: "Tomat", categoryKey: "pantry" }],
          },
        ],
        [{ name: "Tomat", categoryKey: "produce" }],
      ),
    ).toThrow(/multiple categories/i);
  });

  it("throws when catalog seeds contain duplicate normalized names", () => {
    expect(() =>
      parseCatalogIngredientCsv(
        ["name,categoryKey", "Melk,dairy", " melk ,dairy"].join("\n"),
      ),
    ).toThrow(/duplicated/i);
  });
});
