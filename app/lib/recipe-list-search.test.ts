import { describe, expect, it } from "vitest";

import {
  filterRecipeList,
  hasActiveRecipeSearch,
  normalizeRecipeSearchQuery,
  recipeMatchesSearch,
} from "./recipe-list-search";

const sampleRecipe = {
  description: "En varm suppe med tomater",
  tags: ["middag", "suppe"],
  title: "Tomatsuppe",
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
