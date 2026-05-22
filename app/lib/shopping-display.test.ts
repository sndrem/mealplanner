import { describe, expect, it } from "vitest";

import {
  formatCompactShoppingSourceLine,
  formatGeneratedOccurrenceAttribution,
} from "./shopping-display";

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

  it("formats a single generated occurrence compactly", () => {
    expect(
      formatCompactShoppingSourceLine({
        occurrenceCount: 1,
        occurrences: [{ date: "2026-05-11", recipeTitle: "Lasagne" }],
        sourceType: "GENERATED",
      }),
    ).toBe("Fra Lasagne");
  });

  it("formats multiple generated occurrences compactly", () => {
    expect(
      formatCompactShoppingSourceLine({
        occurrenceCount: 2,
        occurrences: [
          { date: "2026-05-11", recipeTitle: "Taco" },
          { date: "2026-05-12", recipeTitle: "Salat" },
        ],
        sourceType: "GENERATED",
      }),
    ).toBe("Brukt i Taco mandag 11. mai og Salat tirsdag 12. mai");
  });

  it("formats manual items with and without buy dates", () => {
    expect(
      formatCompactShoppingSourceLine({
        buyOnDate: "2026-05-11",
        occurrences: [],
        sourceType: "MANUAL",
      }),
    ).toBe("Manuell · Kjøpes 11. mai");

    expect(
      formatCompactShoppingSourceLine({
        buyOnDate: null,
        occurrences: [],
        sourceType: "MANUAL",
      }),
    ).toBe("Manuell");
  });
});
