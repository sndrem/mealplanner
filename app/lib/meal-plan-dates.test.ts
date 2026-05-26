import { describe, expect, it } from "vitest";

import { isPlanDateToday } from "./meal-plan-dates";

describe("isPlanDateToday", () => {
  it("returns true when plan date matches the reference UTC calendar day", () => {
    const referenceDate = new Date("2026-05-26T15:30:00.000Z");

    expect(isPlanDateToday("2026-05-26", referenceDate)).toBe(true);
  });

  it("returns false for adjacent plan dates", () => {
    const referenceDate = new Date("2026-05-26T00:00:00.000Z");

    expect(isPlanDateToday("2026-05-25", referenceDate)).toBe(false);
    expect(isPlanDateToday("2026-05-27", referenceDate)).toBe(false);
  });

  it("uses the UTC calendar day near midnight boundaries", () => {
    const lateUtcEvening = new Date("2026-05-26T23:59:59.000Z");
    const nextUtcDay = new Date("2026-05-27T00:00:00.000Z");

    expect(isPlanDateToday("2026-05-26", lateUtcEvening)).toBe(true);
    expect(isPlanDateToday("2026-05-26", nextUtcDay)).toBe(false);
    expect(isPlanDateToday("2026-05-27", nextUtcDay)).toBe(true);
  });
});
