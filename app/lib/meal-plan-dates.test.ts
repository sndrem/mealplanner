import { describe, expect, it } from "vitest";

import {
  differenceInUtcDateOnlyDays,
  isPlanDateToday,
  parseDateOnly,
} from "./meal-plan-dates";

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

describe("parseDateOnly", () => {
  it("returns a UTC date for a real calendar day", () => {
    expect(parseDateOnly("2026-02-28")?.toISOString()).toBe(
      "2026-02-28T00:00:00.000Z",
    );
  });

  it("rejects dates that are not a real calendar day", () => {
    expect(parseDateOnly("2026-02-31")).toBeNull();
    expect(parseDateOnly("2026-13-01")).toBeNull();
    expect(parseDateOnly("26-02-28")).toBeNull();
  });
});

describe("differenceInUtcDateOnlyDays", () => {
  it("counts whole UTC days, including across a month boundary", () => {
    expect(differenceInUtcDateOnlyDays("2026-05-26", "2026-05-26")).toBe(0);
    expect(differenceInUtcDateOnlyDays("2026-05-26", "2026-05-27")).toBe(1);
    expect(differenceInUtcDateOnlyDays("2026-05-31", "2026-06-02")).toBe(2);
    expect(differenceInUtcDateOnlyDays("2026-05-26", "2026-05-25")).toBe(-1);
  });
});
