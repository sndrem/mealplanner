import { afterEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    mealPlan: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("./db.server", () => ({
  db: dbMock,
}));

import {
  findMealPlanCoveringDate,
  resolveEffectiveStoreModeTripFocus,
  resolveStoreModeAnchorMealPlan,
  resolveStoreModeNextMealPlan,
  selectMealPlansForTripFocus,
} from "./meal-plan-for-date.server";

describe("findMealPlanCoveringDate", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the meal plan that covers the reference date", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({
      endDate: new Date("2026-05-18T00:00:00.000Z"),
      id: "meal-plan-1",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      status: "DRAFT",
      title: "Uke 20",
    });

    const result = await findMealPlanCoveringDate({
      familyId: "family-1",
      referenceDate: new Date("2026-05-16T12:00:00.000Z"),
    });

    expect(result?.id).toBe("meal-plan-1");
    expect(dbMock.mealPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          familyId: "family-1",
          endDate: {
            gte: new Date("2026-05-16T00:00:00.000Z"),
          },
          startDate: {
            lte: new Date("2026-05-16T00:00:00.000Z"),
          },
          status: {
            in: ["APPROVED", "DRAFT"],
          },
        }),
      }),
    );
  });

  it("returns null when no meal plan covers the date", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue(null);

    const result = await findMealPlanCoveringDate({
      familyId: "family-1",
      referenceDate: new Date("2026-05-16T00:00:00.000Z"),
    });

    expect(result).toBeNull();
  });
});

describe("resolveStoreModeAnchorMealPlan", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("prefers the meal plan covering today", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValueOnce({
      endDate: new Date("2026-05-18T00:00:00.000Z"),
      id: "meal-plan-today",
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      status: "DRAFT",
      title: "Uke 20",
    });

    const result = await resolveStoreModeAnchorMealPlan({
      familyId: "family-1",
    });

    expect(result).toEqual({ id: "meal-plan-today" });
    expect(dbMock.mealPlan.findFirst).toHaveBeenCalledTimes(1);
  });

  it("falls back to the latest meal plan when none covers today", async () => {
    dbMock.mealPlan.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "meal-plan-latest" });

    const result = await resolveStoreModeAnchorMealPlan({
      familyId: "family-1",
    });

    expect(result).toEqual({ id: "meal-plan-latest" });
    expect(dbMock.mealPlan.findFirst).toHaveBeenCalledTimes(2);
    expect(dbMock.mealPlan.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        select: { id: true },
        where: {
          familyId: "family-1",
          status: {
            in: ["APPROVED", "DRAFT"],
          },
        },
      }),
    );
  });

  it("returns null when the family has no meal plans", async () => {
    dbMock.mealPlan.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await resolveStoreModeAnchorMealPlan({
      familyId: "family-1",
    });

    expect(result).toBeNull();
  });
});

describe("resolveStoreModeNextMealPlan", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the earliest meal plan that starts after today", async () => {
    dbMock.mealPlan.findFirst.mockResolvedValue({ id: "meal-plan-next" });

    const result = await resolveStoreModeNextMealPlan({
      familyId: "family-1",
      referenceDate: new Date("2026-05-14T12:00:00.000Z"),
    });

    expect(result).toEqual({ id: "meal-plan-next" });
    expect(dbMock.mealPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ startDate: "asc" }, { id: "asc" }],
        where: expect.objectContaining({
          familyId: "family-1",
          startDate: {
            gt: new Date("2026-05-14T00:00:00.000Z"),
          },
          status: {
            in: ["APPROVED", "DRAFT"],
          },
        }),
      }),
    );
  });
});

describe("resolveEffectiveStoreModeTripFocus", () => {
  it("keeps NEXT when a next plan exists", () => {
    expect(
      resolveEffectiveStoreModeTripFocus({
        canFocusNext: true,
        tripFocus: "NEXT",
      }),
    ).toBe("NEXT");
  });

  it("coerces NEXT to CURRENT when no next plan exists", () => {
    expect(
      resolveEffectiveStoreModeTripFocus({
        canFocusNext: false,
        tripFocus: "NEXT",
      }),
    ).toBe("CURRENT");
  });
});

describe("selectMealPlansForTripFocus", () => {
  const currentPlan = {
    id: "meal-plan-1",
    startDate: new Date("2026-05-12T00:00:00.000Z"),
  };
  const nextPlan = {
    id: "meal-plan-2",
    startDate: new Date("2026-05-19T00:00:00.000Z"),
  };
  const openPlans = [currentPlan, nextPlan];

  it("returns only the covering plan for CURRENT", () => {
    expect(
      selectMealPlansForTripFocus({
        anchorPlan: currentPlan,
        currentPlanId: currentPlan.id,
        focus: "CURRENT",
        nextPlanId: nextPlan.id,
        openPlans,
      }),
    ).toEqual([currentPlan]);
  });

  it("returns only the next plan for NEXT", () => {
    expect(
      selectMealPlansForTripFocus({
        anchorPlan: currentPlan,
        currentPlanId: currentPlan.id,
        focus: "NEXT",
        nextPlanId: nextPlan.id,
        openPlans,
      }),
    ).toEqual([nextPlan]);
  });

  it("returns all open plans for ALL", () => {
    expect(
      selectMealPlansForTripFocus({
        anchorPlan: currentPlan,
        currentPlanId: currentPlan.id,
        focus: "ALL",
        nextPlanId: nextPlan.id,
        openPlans,
      }),
    ).toEqual(openPlans);
  });
});
