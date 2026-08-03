import { describe, expect, it } from "vitest";

import {
  dateRangesOverlap,
  filterMealPlansOverlappingWeek,
  formatMealPlanAutoTitle,
  getCalendarWeekBounds,
  getCalendarWeekDates,
  getIsoWeekNumber,
  getMealPlanTimeStatus,
  getNextCalendarWeekBounds,
  isMealPlanPast,
  partitionMealPlansByTimeStatus,
  resolveAutoMealPlanTitle,
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

describe("getNextCalendarWeekBounds", () => {
  it("returns the Monday through Sunday after the current Oslo week", () => {
    const bounds = getNextCalendarWeekBounds(
      new Date("2026-06-04T12:00:00.000Z"),
      "Europe/Oslo",
    );

    expect(bounds).toEqual({
      weekEnd: "2026-06-14",
      weekStart: "2026-06-08",
    });
  });
});

describe("getIsoWeekNumber", () => {
  it("returns the ISO week for a mid-year date", () => {
    expect(getIsoWeekNumber("2026-06-01")).toBe(23);
  });

  it("handles year-boundary weeks that belong to the next year", () => {
    expect(getIsoWeekNumber("2025-12-29")).toBe(1);
  });

  it("handles year-boundary weeks that belong to the previous year", () => {
    expect(getIsoWeekNumber("2027-01-03")).toBe(53);
  });
});

describe("formatMealPlanAutoTitle", () => {
  it("returns an empty string when startDate is missing", () => {
    expect(formatMealPlanAutoTitle("")).toBe("");
  });

  it("formats the ISO week as Uke N", () => {
    expect(formatMealPlanAutoTitle("2026-06-01")).toBe("Uke 23");
  });
});

describe("resolveAutoMealPlanTitle", () => {
  it("fills an empty title with the auto title", () => {
    expect(
      resolveAutoMealPlanTitle({
        currentTitle: "",
        previousAutoTitle: "Uke 22",
        startDate: "2026-06-01",
      }),
    ).toBe("Uke 23");
  });

  it("updates the title when it still matches the previous auto title", () => {
    expect(
      resolveAutoMealPlanTitle({
        currentTitle: "Uke 22",
        previousAutoTitle: "Uke 22",
        startDate: "2026-06-01",
      }),
    ).toBe("Uke 23");
  });

  it("preserves a customized title", () => {
    expect(
      resolveAutoMealPlanTitle({
        currentTitle: "Familieferie",
        previousAutoTitle: "Uke 22",
        startDate: "2026-06-01",
      }),
    ).toBe("Familieferie");
  });

  it("restores the auto title after the user clears a customized title", () => {
    expect(
      resolveAutoMealPlanTitle({
        currentTitle: "",
        previousAutoTitle: "Uke 22",
        startDate: "2026-06-08",
      }),
    ).toBe("Uke 24");
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

describe("getMealPlanTimeStatus", () => {
  const today = "2026-06-04";

  it("returns past when the plan ended before today", () => {
    expect(getMealPlanTimeStatus("2026-05-15", "2026-05-18", today)).toBe(
      "past",
    );
  });

  it("returns active when today is the start date", () => {
    expect(getMealPlanTimeStatus("2026-06-04", "2026-06-10", today)).toBe(
      "active",
    );
  });

  it("returns active when today is the end date", () => {
    expect(getMealPlanTimeStatus("2026-05-28", "2026-06-04", today)).toBe(
      "active",
    );
  });

  it("returns active when today falls inside the range", () => {
    expect(getMealPlanTimeStatus("2026-06-01", "2026-06-07", today)).toBe(
      "active",
    );
  });

  it("returns upcoming when the plan starts after today", () => {
    expect(getMealPlanTimeStatus("2026-06-08", "2026-06-14", today)).toBe(
      "upcoming",
    );
  });
});

describe("partitionMealPlansByTimeStatus", () => {
  const today = "2026-06-04";
  const plans = [
    {
      endDate: "2026-05-20",
      id: "past-older",
      startDate: "2026-05-10",
    },
    {
      endDate: "2026-05-28",
      id: "past-recent",
      startDate: "2026-05-22",
    },
    {
      endDate: "2026-06-07",
      id: "active-later-start",
      startDate: "2026-06-02",
    },
    {
      endDate: "2026-06-10",
      id: "active-earlier-start",
      startDate: "2026-05-28",
    },
    {
      endDate: "2026-06-20",
      id: "upcoming-later",
      startDate: "2026-06-15",
    },
    {
      endDate: "2026-06-14",
      id: "upcoming-soon",
      startDate: "2026-06-08",
    },
  ];

  it("groups plans into active, upcoming, and past", () => {
    const partitioned = partitionMealPlansByTimeStatus(plans, today);

    expect(partitioned.active.map((plan) => plan.id)).toEqual([
      "active-later-start",
      "active-earlier-start",
    ]);
    expect(partitioned.upcoming.map((plan) => plan.id)).toEqual([
      "upcoming-soon",
      "upcoming-later",
    ]);
    expect(partitioned.past.map((plan) => plan.id)).toEqual([
      "past-recent",
      "past-older",
    ]);
  });

  it("returns empty groups when there are no plans", () => {
    expect(partitionMealPlansByTimeStatus([], today)).toEqual({
      active: [],
      upcoming: [],
      past: [],
    });
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
