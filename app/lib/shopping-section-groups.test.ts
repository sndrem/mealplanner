import { describe, expect, it } from "vitest";

import {
  groupSharedShoppingItemsByStore,
  resolveDefaultSharedStoreId,
} from "./shopping-section-groups";

const produceSection = {
  categoryId: "cat-produce",
  displayName: "Frukt og grønt",
  sortOrder: 1,
};

const dairySection = {
  categoryId: "cat-dairy",
  displayName: "Meieri",
  sortOrder: 0,
};

const items = [
  {
    categoryId: "cat-produce",
    categoryName: "Frukt og grønt",
    id: "GENERATED:paprika",
    name: "Paprika",
    note: null,
    quantityLabel: "2 stk",
  },
  {
    categoryId: "cat-dairy",
    categoryName: "Meieri",
    id: "FAMILY:milk",
    name: "Melk",
    note: null,
    quantityLabel: "1 l",
  },
];

describe("shopping-section-groups", () => {
  it("resolves Rema 1000 as the default store when present", () => {
    expect(
      resolveDefaultSharedStoreId([
        { id: "kiwi", name: "Kiwi" },
        { id: "rema", name: "Rema 1000" },
      ]),
    ).toBe("rema");
  });

  it("falls back to the first store when Rema 1000 is missing", () => {
    expect(
      resolveDefaultSharedStoreId([
        { id: "meny", name: "Meny" },
        { id: "kiwi", name: "Kiwi" },
      ]),
    ).toBe("meny");
  });

  it("returns null when there are no stores", () => {
    expect(resolveDefaultSharedStoreId([])).toBeNull();
  });

  it("groups items by the selected store section order", () => {
    const groups = groupSharedShoppingItemsByStore({
      items,
      selectedStoreId: "rema",
      stores: [
        {
          id: "rema",
          name: "Rema 1000",
          sections: [produceSection, dairySection],
        },
      ],
    });

    expect(groups.map((group) => group.displayName)).toEqual([
      "Meieri",
      "Frukt og grønt",
    ]);
    expect(groups[0]?.items.map((item) => item.name)).toEqual(["Melk"]);
    expect(groups[1]?.items.map((item) => item.name)).toEqual(["Paprika"]);
  });

  it("falls back to category name when the store has no matching section", () => {
    const groups = groupSharedShoppingItemsByStore({
      items,
      selectedStoreId: "unknown",
      stores: [],
    });

    expect(groups.map((group) => group.displayName).sort()).toEqual([
      "Frukt og grønt",
      "Meieri",
    ]);
  });
});
