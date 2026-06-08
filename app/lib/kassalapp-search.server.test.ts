import { describe, expect, it } from "vitest";

import {
  dedupeShoppingSearchTerms,
  getUncheckedShoppingItems,
  normalizeShoppingSearchTerm,
} from "./kassalapp-search.server";
import type { ProjectedFamilyShoppingItem } from "./shopping.server";

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

describe("kassalapp-search.server", () => {
  it("strips leading quantity prefixes from search terms", () => {
    expect(normalizeShoppingSearchTerm("2 dl melk")).toBe("melk");
    expect(normalizeShoppingSearchTerm("500 g kjøttdeig")).toBe("kjøttdeig");
    expect(normalizeShoppingSearchTerm("1 stk løk")).toBe("løk");
  });

  it("falls back to quantityLabel when the name is too short", () => {
    expect(normalizeShoppingSearchTerm("lø", "2 stk gul løk")).toBe("gul løk");
  });

  it("returns null for terms shorter than three characters", () => {
    expect(normalizeShoppingSearchTerm("2 dl")).toBeNull();
    expect(normalizeShoppingSearchTerm("te")).toBeNull();
  });

  it("dedupes unchecked items by normalized search term", () => {
    const groupedTerms = dedupeShoppingSearchTerms(
      getUncheckedShoppingItems([
        createFamilyItem({ name: "2 dl melk", sourceKey: "family:1" }),
        createFamilyItem({ name: "Melk", sourceKey: "family:2" }),
        createFamilyItem({
          checked: true,
          name: "Melk",
          sourceKey: "family:3",
        }),
      ]),
    );

    expect(groupedTerms.get("melk")?.map((item) => item.sourceKey)).toEqual([
      "family:1",
      "family:2",
    ]);
  });

  it("filters checked items out of cost estimation input", () => {
    expect(
      getUncheckedShoppingItems([
        createFamilyItem({ checked: false }),
        createFamilyItem({ checked: true, sourceKey: "family:2" }),
      ]),
    ).toHaveLength(1);
  });
});
