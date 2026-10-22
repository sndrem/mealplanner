import { afterEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock("./db.server", () => ({
  db: dbMock,
}));

import {
  buildStoreModeTripRevisionToken,
  getStoreModeTripRevision,
  type StoreModeTripRevisionSnapshot,
} from "./store-mode-trip-revision.server";

const atNoon = new Date("2026-05-14T12:00:00.000Z");
const later = new Date("2026-05-14T12:05:00.000Z");

function snapshot(
  overrides: Partial<StoreModeTripRevisionSnapshot> = {},
): StoreModeTripRevisionSnapshot {
  const empty = {
    count: 0,
    max: null,
  };

  return {
    checkEvent: empty,
    extraMeal: empty,
    familyItem: empty,
    manualItem: empty,
    mealPlan: empty,
    mealPlanEntry: empty,
    offerBriefing: empty,
    shoppingOverride: empty,
    stockIngredient: empty,
    store: empty,
    storeSection: empty,
    ...overrides,
  };
}

describe("buildStoreModeTripRevisionToken", () => {
  it("keeps the same token when the snapshot is unchanged", () => {
    const current = snapshot({
      shoppingOverride: { count: 2, max: atNoon },
    });

    expect(buildStoreModeTripRevisionToken(current)).toBe(
      buildStoreModeTripRevisionToken(
        snapshot({
          shoppingOverride: { count: 2, max: new Date(atNoon.toISOString()) },
        }),
      ),
    );
  });

  it("changes when a shopping override is updated", () => {
    const before = buildStoreModeTripRevisionToken(
      snapshot({
        shoppingOverride: { count: 1, max: atNoon },
      }),
    );
    const after = buildStoreModeTripRevisionToken(
      snapshot({
        shoppingOverride: { count: 1, max: later },
      }),
    );

    expect(after).not.toBe(before);
  });

  it("changes when a family shopping item is updated", () => {
    const before = buildStoreModeTripRevisionToken(
      snapshot({
        familyItem: { count: 1, max: atNoon },
      }),
    );
    const after = buildStoreModeTripRevisionToken(
      snapshot({
        familyItem: { count: 1, max: later },
      }),
    );

    expect(after).not.toBe(before);
  });

  it("changes when a check event is recorded", () => {
    const before = buildStoreModeTripRevisionToken(
      snapshot({
        checkEvent: { count: 1, max: atNoon },
      }),
    );
    const after = buildStoreModeTripRevisionToken(
      snapshot({
        checkEvent: { count: 2, max: later },
      }),
    );

    expect(after).not.toBe(before);
  });

  it("changes when a row that is not the newest is deleted", () => {
    const before = buildStoreModeTripRevisionToken(
      snapshot({
        shoppingOverride: { count: 2, max: later },
      }),
    );
    const after = buildStoreModeTripRevisionToken(
      snapshot({
        shoppingOverride: { count: 1, max: later },
      }),
    );

    expect(after).not.toBe(before);
  });
});

describe("getStoreModeTripRevision", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reads the shared trip once and turns the row into a token", async () => {
    dbMock.$queryRaw.mockResolvedValue([
      {
        checkEventCount: 1n,
        checkEventMax: atNoon,
        extraMealCount: 0,
        extraMealMax: null,
        familyItemCount: 0,
        familyItemMax: null,
        manualItemCount: 0,
        manualItemMax: null,
        mealPlanCount: 1,
        mealPlanEntryCount: 0,
        mealPlanEntryMax: null,
        mealPlanMax: atNoon.toISOString(),
        offerBriefingCount: 0,
        offerBriefingMax: null,
        shoppingOverrideCount: 2,
        shoppingOverrideMax: later,
        stockIngredientCount: 0,
        stockIngredientMax: null,
        storeCount: 1,
        storeMax: null,
        storeSectionCount: 0,
        storeSectionMax: null,
      },
    ]);

    await expect(getStoreModeTripRevision("family-1")).resolves.toBe(
      buildStoreModeTripRevisionToken(
        snapshot({
          checkEvent: { count: 1, max: atNoon },
          mealPlan: { count: 1, max: atNoon },
          shoppingOverride: { count: 2, max: later },
          store: { count: 1, max: null },
        }),
      ),
    );
    expect(dbMock.$queryRaw).toHaveBeenCalledOnce();

    const sql = String(dbMock.$queryRaw.mock.calls[0]?.[0]);
    expect(sql).toContain("ShoppingItemOverride");
    expect(sql).toContain("FamilyShoppingItem");
    expect(sql).toContain("ShoppingItemCheckEvent");
    expect(sql).toContain("MealPlanEntry");
    expect(sql).toContain("FamilyStockIngredient");
    expect(sql).toContain("StoreOfferBriefing");
    expect(sql).toContain("StoreSection");
    expect(dbMock.$queryRaw.mock.calls[0]).toContain("family-1");
  });
});
