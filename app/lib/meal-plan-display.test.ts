import { describe, expect, it } from "vitest";

import { getDinnerMenuLabel } from "./meal-plan-display";

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

  it("returns default label when entry is empty", () => {
    expect(getDinnerMenuLabel(null)).toBe("Ikke planlagt");
  });
});
