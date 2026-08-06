import { describe, expect, it } from "vitest";

import {
  formatMealPlanRecipeSelectLabel,
  getDinnerMenuLabel,
} from "./meal-plan-display";

describe("formatMealPlanRecipeSelectLabel", () => {
  it("returns title only when tags are empty", () => {
    expect(formatMealPlanRecipeSelectLabel("Laksegryte", [])).toBe("Laksegryte");
  });

  it("returns title only when tags are whitespace-only", () => {
    expect(formatMealPlanRecipeSelectLabel("Laksegryte", ["  ", ""])).toBe(
      "Laksegryte",
    );
  });

  it("appends a single tag after a middle dot", () => {
    expect(formatMealPlanRecipeSelectLabel("Laksegryte", ["fisk"])).toBe(
      "Laksegryte · fisk",
    );
  });

  it("joins multiple tags with commas", () => {
    expect(
      formatMealPlanRecipeSelectLabel("Laksegryte", ["fisk", "hverdag"]),
    ).toBe("Laksegryte · fisk, hverdag");
  });

  it("trims tags before joining", () => {
    expect(
      formatMealPlanRecipeSelectLabel("Taco", ["  hverdag  ", "komfort"]),
    ).toBe("Taco · hverdag, komfort");
  });
});

describe("getDinnerMenuLabel", () => {
  it("prefers recipe title over note", () => {
    expect(
      getDinnerMenuLabel({
        note: "Takeaway",
        recipe: { title: "Laks med poteter" },
        recipeId: "recipe-1",
      }),
    ).toBe("Laks med poteter");
  });

  it("uses trimmed note when recipe is missing", () => {
    expect(
      getDinnerMenuLabel({
        note: "  Pizza  ",
        recipe: null,
        recipeId: null,
      }),
    ).toBe("Pizza");
  });

  it("prefers freezer label over note when recipe is missing", () => {
    expect(
      getDinnerMenuLabel({
        freezerItem: { label: "Chili fra fryseren" },
        freezerItemId: "freezer-1",
        note: "Takeaway",
        recipe: null,
        recipeId: null,
      }),
    ).toBe("Chili fra fryseren");
  });

  it("returns default label when entry is empty", () => {
    expect(getDinnerMenuLabel(null)).toBe("Ikke planlagt");
  });
});
