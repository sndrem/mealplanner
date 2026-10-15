import { describe, expect, it } from "vitest";

import {
  formatCompactShoppingSourceLine,
  formatGeneratedItemSummary,
  formatGeneratedOccurrenceAttribution,
  formatOccurrenceSourceLine,
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

  it("labels an undated extra meal as this week", () => {
    expect(
      formatGeneratedItemSummary({
        firstDate: null,
        lastDate: null,
        occurrenceCount: 1,
        occurrences: [{ date: null, recipeTitle: "Kyllingsalat" }],
        sourceType: "GENERATED",
      }),
    ).toBe("Fra Kyllingsalat. Denne uken.");
    expect(
      formatOccurrenceSourceLine({
        date: null,
        quantityLabel: "1 stk",
        recipeTitle: "Kyllingsalat",
      }),
    ).toBe("Denne uken: Kyllingsalat · 1 stk");
  });

  it("dates only the dinner when an ingredient is also used this week", () => {
    expect(
      formatGeneratedOccurrenceAttribution([
        { date: "2026-05-11", recipeTitle: "Taco" },
        { date: null, recipeTitle: "Kyllingsalat" },
      ]),
    ).toBe("Taco mandag 11. mai og Kyllingsalat (denne uken)");
    expect(
      formatGeneratedItemSummary({
        firstDate: "2026-05-11",
        lastDate: "2026-05-11",
        occurrenceCount: 2,
        occurrences: [
          { date: "2026-05-11", recipeTitle: "Taco" },
          { date: null, recipeTitle: "Kyllingsalat" },
        ],
        sourceType: "GENERATED",
      }),
    ).toBe(
      "Brukt i Taco mandag 11. mai og Kyllingsalat (denne uken). Planlagt mandag 11. mai–mandag 11. mai.",
    );
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
