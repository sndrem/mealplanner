import { describe, expect, it } from "vitest";

import { formatGeneratedOccurrenceAttribution } from "./shopping-display";

describe("shopping-display", () => {
  it("lists every planned occurrence including repeated recipes on different days", () => {
    expect(
      formatGeneratedOccurrenceAttribution([
        { date: "2026-05-11", recipeTitle: "Lasagne" },
        { date: "2026-05-12", recipeTitle: "Lasagne" },
      ]),
    ).toBe("Lasagne mandag 11. mai og Lasagne tirsdag 12. mai");
  });

  it("lists each recipe when ingredients come from different recipes", () => {
    expect(
      formatGeneratedOccurrenceAttribution([
        { date: "2026-05-11", recipeTitle: "Taco" },
        { date: "2026-05-12", recipeTitle: "Salat" },
      ]),
    ).toBe("Taco mandag 11. mai og Salat tirsdag 12. mai");
  });
});
