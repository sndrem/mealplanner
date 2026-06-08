import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetKassalappCacheForTests } from "./kassalapp-cache.server";
import { estimateShoppingListCost } from "./kassalapp-cost.server";
import { resetKassalappRateLimiterForTests } from "./kassalapp-rate-limit.server";
import type {
  KassalappBulkPriceResponse,
  KassalappProductSearchResponse,
} from "./kassalapp.types";
import type { ProjectedFamilyShoppingItem } from "./shopping.server";

const getFamilyKassalappApiTokenMock = vi.fn();
const isKassalappConfiguredForFamilyMock = vi.fn();

vi.mock("./kassalapp-integration.server", () => ({
  getFamilyKassalappApiToken: (...args: unknown[]) =>
    getFamilyKassalappApiTokenMock(...args),
  isKassalappConfiguredForFamily: (...args: unknown[]) =>
    isKassalappConfiguredForFamilyMock(...args),
}));

function createFamilyItem(
  overrides: Partial<ProjectedFamilyShoppingItem> = {},
): ProjectedFamilyShoppingItem {
  return {
    category: { id: "category-1", name: "Meieri" },
    checked: false,
    collaborationVersion: "2026-01-01T00:00:00.000Z",
    mealPlanId: null,
    mealPlanTitle: null,
    name: "Melk",
    note: null,
    preferredStore: null,
    quantity: null,
    quantityLabel: null,
    section: {
      displayName: "Meieri",
      sortOrder: 0,
    },
    sourceKey: "family:item-1",
    sourceType: "FAMILY",
    ...overrides,
  };
}

describe("kassalapp-cost.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetKassalappCacheForTests();
    resetKassalappRateLimiterForTests();
    isKassalappConfiguredForFamilyMock.mockResolvedValue(true);
    getFamilyKassalappApiTokenMock.mockResolvedValue("test-token");
  });

  afterEach(() => {
    resetKassalappCacheForTests();
    resetKassalappRateLimiterForTests();
  });

  it("returns unavailable when the family has no integration", async () => {
    isKassalappConfiguredForFamilyMock.mockResolvedValue(false);

    await expect(
      estimateShoppingListCost({
        familyId: "family-1",
        items: [createFamilyItem()],
      }),
    ).resolves.toEqual({
      reason: "Kassalapp er ikke koblet til for denne familien.",
      status: "unavailable",
    });
  });

  it("aggregates per-store totals from search and bulk price lookups", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/products/prices-bulk")) {
        const body = {
          data: [
            {
              ean: "7039010019811",
              name: "Tine Helmelk 1 liter",
              price_history: [],
              stores: [
                {
                  current_price: 24.9,
                  current_unit_price: null,
                  current_unit_price_unit: null,
                  last_checked: null,
                  name: "Kiwi",
                  store: "KIWI",
                },
                {
                  current_price: 22.5,
                  current_unit_price: null,
                  current_unit_price_unit: null,
                  last_checked: null,
                  name: "Rema 1000",
                  store: "REMA_1000",
                },
              ],
              weight: 1,
              weight_unit: "l",
            },
          ],
          meta: {
            days_included: 1,
            found_products: 1,
            is_premium: false,
            requested_eans: 1,
          },
        } satisfies KassalappBulkPriceResponse;

        return new Response(JSON.stringify(body), { status: 200 });
      }

      const body = {
        data: [
          {
            brand: "Tine",
            current_price: 24.9,
            current_unit_price: null,
            ean: "7039010019811",
            id: 1,
            name: "Tine Helmelk 1 liter",
            store: [{ code: "KIWI", logo: "", name: "Kiwi", url: "" }],
            vendor: null,
          },
        ],
      } satisfies KassalappProductSearchResponse;

      return new Response(JSON.stringify(body), { status: 200 });
    });

    const result = await estimateShoppingListCost({
      familyId: "family-1",
      fetchImpl,
      items: [
        createFamilyItem({ name: "2 dl melk", sourceKey: "family:1" }),
        createFamilyItem({ name: "Melk", sourceKey: "family:2" }),
        createFamilyItem({
          checked: true,
          name: "Melk",
          sourceKey: "family:3",
        }),
      ],
      storeCodes: ["KIWI", "REMA_1000"],
    });

    expect(result).toMatchObject({
      status: "ok",
      meta: {
        bulkCalls: 1,
        searchCalls: 1,
      },
      stores: [
        {
          code: "KIWI",
          matchedCount: 2,
          total: 49.8,
          unmatchedCount: 0,
        },
        {
          code: "REMA_1000",
          matchedCount: 2,
          total: 45,
          unmatchedCount: 0,
        },
      ],
      unmatchedItems: [],
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(getFamilyKassalappApiTokenMock).toHaveBeenCalledWith("family-1");
  });

  it("dedupes search calls and uses cache for repeated terms", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              brand: null,
              current_price: 10,
              current_unit_price: null,
              ean: null,
              id: 2,
              name: "Bananas",
              store: [],
              vendor: null,
            },
          ],
        } satisfies KassalappProductSearchResponse),
        { status: 200 },
      ),
    );

    await estimateShoppingListCost({
      familyId: "family-1",
      fetchImpl,
      items: [
        createFamilyItem({ name: "Banan", sourceKey: "family:1" }),
        createFamilyItem({ name: "banan", sourceKey: "family:2" }),
      ],
      storeCodes: ["KIWI"],
    });

    await estimateShoppingListCost({
      familyId: "family-1",
      fetchImpl,
      items: [createFamilyItem({ name: "Banan", sourceKey: "family:3" })],
      storeCodes: ["KIWI"],
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
