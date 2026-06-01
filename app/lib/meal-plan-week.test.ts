import { describe, expect, it } from "vitest";

import {
  dateRangesOverlap,
  filterMealPlansOverlappingWeek,
  getCalendarWeekBounds,
  getCalendarWeekDates,
  isMealPlanPast,
} from "./meal-plan-week";

describe("getCalendarWeekBounds", () => {
  it("returns Monday through Sunday for a mid-week reference in Oslo", () => {
    const bounds = getCalendarWeekBounds(
      new Date("2026-06-04T12:00:00.000Z"),
      "Europe/Oslo",
    );

    expect(bounds).toEqual({
      weekEnd: "2026-06-07",
      weekStart: "2026-06-01",
    });
  });
});

describe("getCalendarWeekDates", () => {
  it("lists each date in the week inclusively", () => {
    expect(
      getCalendarWeekDates({
        weekEnd: "2026-06-07",
        weekStart: "2026-06-01",
      }),
    ).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
      "2026-06-06",
      "2026-06-07",
    ]);
  });
});

describe("isMealPlanPast", () => {
  it("returns true when the plan ended before today", () => {
    expect(isMealPlanPast("2026-05-18", "2026-06-04")).toBe(true);
  });

  it("returns false when the plan ends today or later", () => {
    expect(isMealPlanPast("2026-06-04", "2026-06-04")).toBe(false);
    expect(isMealPlanPast("2026-06-10", "2026-06-04")).toBe(false);
  });
});

describe("dateRangesOverlap", () => {
  it("detects overlapping ranges", () => {
    expect(dateRangesOverlap("2026-06-01", "2026-06-10", "2026-06-05", "2026-06-12")).toBe(
      true,
    );
  });

  it("returns false when ranges do not touch", () => {
    expect(dateRangesOverlap("2026-05-01", "2026-05-07", "2026-06-01", "2026-06-07")).toBe(
      false,
    );
  });

  it("treats touching end/start as overlap", () => {
    expect(dateRangesOverlap("2026-05-01", "2026-06-01", "2026-06-01", "2026-06-07")).toBe(
      true,
    );
  });
});

describe("filterMealPlansOverlappingWeek", () => {
  const weekBounds = {
    weekEnd: "2026-06-07",
    weekStart: "2026-06-01",
  };

  const plans = [
    {
      endDate: "2026-05-20",
      id: "before",
      startDate: "2026-05-15",
    },
    {
      endDate: "2026-06-10",
      id: "spanning",
      startDate: "2026-05-28",
    },
    {
      endDate: "2026-06-05",
      id: "inside",
      startDate: "2026-06-02",
    },
    {
      endDate: "2026-06-12",
      id: "also-inside",
      startDate: "2026-06-03",
    },
    {
      endDate: "2026-06-20",
      id: "after",
      startDate: "2026-06-15",
    },
  ];

  it("returns plans that overlap the week in input order", () => {
    expect(filterMealPlansOverlappingWeek(plans, weekBounds)).toEqual([
      plans[1],
      plans[2],
      plans[3],
    ]);
  });

  it("returns an empty list when no plans overlap", () => {
    expect(
      filterMealPlansOverlappingWeek(
        [
          {
            endDate: "2026-05-20",
            id: "old",
            startDate: "2026-05-15",
          },
        ],
        weekBounds,
      ),
    ).toEqual([]);
  });

  it("returns an empty list for empty input", () => {
    expect(filterMealPlansOverlappingWeek([], weekBounds)).toEqual([]);
  });
});
