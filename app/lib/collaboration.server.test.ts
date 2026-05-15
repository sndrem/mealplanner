import { MealType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildMealPlanEntriesSnapshot,
  matchesExpectedUpdatedAt,
} from "./collaboration.server";

describe("collaboration.server", () => {
  it("treats empty expected versions as absent rows", () => {
    expect(matchesExpectedUpdatedAt("", null)).toBe(true);
    expect(matchesExpectedUpdatedAt(undefined, null)).toBe(true);
  });

  it("detects stale versions and unexpected new rows", () => {
    const updatedAt = new Date("2026-05-15T12:00:00.000Z");

    expect(matchesExpectedUpdatedAt(updatedAt.toISOString(), updatedAt)).toBe(true);
    expect(
      matchesExpectedUpdatedAt(
        "2026-05-15T11:00:00.000Z",
        updatedAt,
      ),
    ).toBe(false);
    expect(matchesExpectedUpdatedAt("", updatedAt)).toBe(false);
  });

  it("builds a stable meal-plan entry snapshot", () => {
    const snapshot = buildMealPlanEntriesSnapshot([
      {
        date: new Date("2026-05-16T00:00:00.000Z"),
        mealType: MealType.DINNER,
        updatedAt: new Date("2026-05-16T09:00:00.000Z"),
      },
      {
        date: new Date("2026-05-15T00:00:00.000Z"),
        mealType: MealType.DINNER,
        updatedAt: new Date("2026-05-15T09:00:00.000Z"),
      },
    ]);

    expect(snapshot).toBe(
      [
        "2026-05-15T00:00:00.000Z:DINNER:2026-05-15T09:00:00.000Z",
        "2026-05-16T00:00:00.000Z:DINNER:2026-05-16T09:00:00.000Z",
      ].join("|"),
    );
  });
});
