import { describe, expect, it } from "vitest";

import {
  formatMealPlanRecipeSelectLabel,
  getDinnerMenuLabel,
  getMealSelectionTriggerLabel,
  swapOrMoveMealSelection,
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

describe("getMealSelectionTriggerLabel", () => {
  const recipes = [{ id: "recipe-taco", title: "Taco" }];
  const freezerItems = [{ id: "freezer-1", label: "Lasagne" }];

  it("returns the empty label when nothing is selected", () => {
    expect(
      getMealSelectionTriggerLabel({
        freezerItems,
        recipes,
        value: "",
      }),
    ).toBe("Velg middag");
  });

  it("returns the selected recipe title", () => {
    expect(
      getMealSelectionTriggerLabel({
        freezerItems,
        recipes,
        value: "recipe:recipe-taco",
      }),
    ).toBe("Taco");
  });

  it("returns the selected freezer label", () => {
    expect(
      getMealSelectionTriggerLabel({
        freezerItems,
        recipes,
        value: "freezer:freezer-1",
      }),
    ).toBe("Lasagne");
  });

  it("falls back to the stored label when the recipe is missing from the picker list", () => {
    expect(
      getMealSelectionTriggerLabel({
        fallbackLabel: "Gammel gryte",
        freezerItems,
        recipes,
        value: "recipe:deleted-recipe",
      }),
    ).toBe("Gammel gryte");
  });
});

describe("swapOrMoveMealSelection", () => {
  it("swaps recipe selections between two days", () => {
    expect(
      swapOrMoveMealSelection(
        {
          "2026-08-03": "recipe:a",
          "2026-08-04": "recipe:b",
        },
        "2026-08-03",
        "2026-08-04",
      ),
    ).toEqual({
      "2026-08-03": "recipe:b",
      "2026-08-04": "recipe:a",
    });
  });

  it("swaps recipe with freezer selection", () => {
    expect(
      swapOrMoveMealSelection(
        {
          "2026-08-03": "recipe:a",
          "2026-08-05": "freezer:f1",
        },
        "2026-08-03",
        "2026-08-05",
      ),
    ).toEqual({
      "2026-08-03": "freezer:f1",
      "2026-08-05": "recipe:a",
    });
  });

  it("moves freezer selection onto an empty day", () => {
    expect(
      swapOrMoveMealSelection(
        {
          "2026-08-03": "freezer:f1",
          "2026-08-06": "",
        },
        "2026-08-03",
        "2026-08-06",
      ),
    ).toEqual({
      "2026-08-03": "",
      "2026-08-06": "freezer:f1",
    });
  });

  it("is a no-op when source day has no meal", () => {
    const selections = {
      "2026-08-03": "",
      "2026-08-04": "recipe:b",
    };

    expect(
      swapOrMoveMealSelection(selections, "2026-08-03", "2026-08-04"),
    ).toBe(selections);
  });

  it("is a no-op when from and to dates are the same", () => {
    const selections = {
      "2026-08-03": "recipe:a",
    };

    expect(
      swapOrMoveMealSelection(selections, "2026-08-03", "2026-08-03"),
    ).toBe(selections);
  });
});
