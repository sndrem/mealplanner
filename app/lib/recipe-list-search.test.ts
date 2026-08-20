import { describe, expect, it } from "vitest";

import {
  deriveRecipeTagOptions,
  filterRecipeList,
  filterRecipePickerList,
  filterRecipesByTags,
  groupRecipePickerResults,
  hasActiveRecipeSearch,
  normalizeRecipeSearchQuery,
  recipeMatchesSearch,
  recipeMatchesTags,
} from "./recipe-list-search";

const sampleRecipe = {
  description: "En varm suppe med tomater",
  id: "tomatsuppe",
  tags: ["middag", "suppe"],
  title: "Tomatsuppe",
};

const taco = {
  description: "Rask taco",
  id: "taco",
  tags: ["rask", "middag"],
  title: "Kyllingtaco",
};

const lasagne = {
  description: "Ovnsrett",
  id: "lasagne",
  tags: ["ovn", "middag"],
  title: "Lasagne",
};

describe("recipe list search", () => {
  it("normalizes whitespace-only queries to empty", () => {
    expect(normalizeRecipeSearchQuery("   ")).toBe("");
    expect(hasActiveRecipeSearch("   ")).toBe(false);
  });

  it("matches all recipes when the query is empty", () => {
    expect(recipeMatchesSearch(sampleRecipe, "")).toBe(true);
    expect(recipeMatchesSearch(sampleRecipe, "   ")).toBe(true);
    expect(filterRecipeList([sampleRecipe], "")).toEqual([sampleRecipe]);
  });

  it("matches titles case-insensitively", () => {
    expect(recipeMatchesSearch(sampleRecipe, "tomat")).toBe(true);
    expect(recipeMatchesSearch(sampleRecipe, "SUPPE")).toBe(true);
  });

  it("matches descriptions and tags", () => {
    expect(recipeMatchesSearch(sampleRecipe, "varm")).toBe(true);
    expect(recipeMatchesSearch(sampleRecipe, "middag")).toBe(true);
  });

  it("returns no matches when the query is absent from all fields", () => {
    expect(recipeMatchesSearch(sampleRecipe, "pizza")).toBe(false);
    expect(filterRecipeList([sampleRecipe], "pizza")).toEqual([]);
  });
});

describe("recipe tag filters", () => {
  it("matches all recipes when no tags are selected", () => {
    expect(recipeMatchesTags(sampleRecipe, [])).toBe(true);
    expect(filterRecipesByTags([sampleRecipe, taco], [])).toEqual([
      sampleRecipe,
      taco,
    ]);
  });

  it("requires all selected tags (AND)", () => {
    expect(recipeMatchesTags(sampleRecipe, ["middag"])).toBe(true);
    expect(recipeMatchesTags(sampleRecipe, ["middag", "suppe"])).toBe(true);
    expect(recipeMatchesTags(sampleRecipe, ["middag", "rask"])).toBe(false);
    expect(filterRecipesByTags([sampleRecipe, taco, lasagne], ["middag", "rask"])).toEqual([
      taco,
    ]);
  });

  it("combines search and tag filters", () => {
    expect(
      filterRecipePickerList([sampleRecipe, taco, lasagne], {
        query: "middag",
        selectedTags: ["rask"],
      }),
    ).toEqual([taco]);

    expect(
      filterRecipePickerList([sampleRecipe, taco, lasagne], {
        query: "ovn",
        selectedTags: ["middag"],
      }),
    ).toEqual([lasagne]);
  });
});

describe("deriveRecipeTagOptions", () => {
  it("returns sorted unique tags with counts", () => {
    expect(deriveRecipeTagOptions([sampleRecipe, taco, lasagne])).toEqual([
      { count: 3, tag: "middag" },
      { count: 1, tag: "ovn" },
      { count: 1, tag: "rask" },
      { count: 1, tag: "suppe" },
    ]);
  });

  it("ignores blank tags", () => {
    expect(
      deriveRecipeTagOptions([{ tags: ["  ", "fisk", "fisk"] }]),
    ).toEqual([{ count: 2, tag: "fisk" }]);
  });
});

describe("groupRecipePickerResults", () => {
  it("assigns each recipe to the first matching section only", () => {
    const result = groupRecipePickerResults([sampleRecipe, taco, lasagne], {
      currentRecipeId: "tomatsuppe",
      inPlanRecipeIds: new Set(["taco", "tomatsuppe"]),
      recentlyUsedRecipeIds: new Set(["taco", "lasagne"]),
    });

    expect(result.inPlan.map((recipe) => recipe.id)).toEqual(["taco"]);
    expect(result.recentlyUsed.map((recipe) => recipe.id)).toEqual(["lasagne"]);
    expect(result.other.map((recipe) => recipe.id)).toEqual(["tomatsuppe"]);
  });

  it("keeps the current recipe out of the in-plan section", () => {
    const result = groupRecipePickerResults([sampleRecipe], {
      currentRecipeId: "tomatsuppe",
      inPlanRecipeIds: new Set(["tomatsuppe"]),
      recentlyUsedRecipeIds: new Set(),
    });

    expect(result.inPlan).toEqual([]);
    expect(result.other).toEqual([sampleRecipe]);
  });
});
