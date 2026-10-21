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
  recipeCatalogReloadSkipped,
  recipeMatchesTags,
  resolveRecipeListFilter,
  visibleFamilyRecipes,
  withRecipeListFilter,
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

describe("resolveRecipeListFilter", () => {
  it("drops a tag that no recipe has and keeps the rest of the address", () => {
    expect(
      resolveRecipeListFilter("?notice=recipe-created&tag=middag&tag=borte", [
        { tags: ["middag"] },
        { tags: ["rask"] },
      ]),
    ).toEqual({
      query: "",
      search: "?notice=recipe-created&tag=middag",
      selectedTags: ["middag"],
    });
  });

  it("treats Middag and middag as different tags", () => {
    expect(
      resolveRecipeListFilter("?tag=Middag&tag=middag", [{ tags: ["Middag"] }]),
    ).toEqual({
      query: "",
      search: "?tag=Middag",
      selectedTags: ["Middag"],
    });
  });

  it("keeps one copy of a repeated tag", () => {
    expect(
      resolveRecipeListFilter("?tag=middag&tag=middag", [{ tags: ["middag"] }]),
    ).toEqual({
      query: "",
      search: "?tag=middag",
      selectedTags: ["middag"],
    });
  });
});

describe("withRecipeListFilter", () => {
  it("replaces the text and selected tags and keeps other params", () => {
    expect(
      withRecipeListFilter("?notice=recipe-created&q=suppe&tag=ovn", {
        query: "taco",
        selectedTags: ["middag", "rask"],
      }),
    ).toBe("?notice=recipe-created&q=taco&tag=middag&tag=rask");
  });

  it("omits the text and tag params when the filter is empty", () => {
    expect(
      withRecipeListFilter("?q=taco&tag=middag", {
        query: "",
        selectedTags: [],
      }),
    ).toBe("");
  });
});

describe("visibleFamilyRecipes", () => {
  it("keeps a pending recipe that the tag filter would hide", () => {
    const pending = {
      description: null,
      id: "optimistic:pending-add",
      tags: [] as string[],
      title: "Kyllingwok",
    };

    expect(
      visibleFamilyRecipes(
        [
          {
            description: "Pai",
            id: "pie",
            tags: ["middag"],
            title: "Familiepai",
          },
          {
            description: "Rask",
            id: "taco",
            tags: ["middag", "rask"],
            title: "Kyllingtaco",
          },
        ],
        { query: "", selectedTags: ["rask"] },
        pending,
      ).map((recipe) => recipe.title),
    ).toEqual(["Kyllingwok", "Kyllingtaco"]);
  });
});

describe("recipeCatalogReloadSkipped", () => {
  it("skips a reload when only the text or tags change", () => {
    expect(
      recipeCatalogReloadSkipped(
        new URL(
          "http://localhost/families/family-1/recipes?notice=recipe-created",
        ),
        new URL(
          "http://localhost/families/family-1/recipes?notice=recipe-created&q=taco&tag=middag",
        ),
      ),
    ).toBe(true);
  });

  it("reloads when the address changes beyond the filter", () => {
    expect(
      recipeCatalogReloadSkipped(
        new URL("http://localhost/families/family-1/recipes"),
        new URL(
          "http://localhost/families/family-1/recipes?notice=recipe-created",
        ),
      ),
    ).toBe(false);
    expect(
      recipeCatalogReloadSkipped(
        new URL("http://localhost/families/family-1/recipes?q=taco"),
        new URL("http://localhost/families/family-1/recipes/recipe-1?q=taco"),
      ),
    ).toBe(false);
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
