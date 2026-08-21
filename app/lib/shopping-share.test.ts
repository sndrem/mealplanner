import { describe, expect, it } from "vitest";

import {
  buildShoppingShareItemSelectionKey,
  parseShoppingListShareSnapshot,
  parseShoppingShareItemSelectionKey,
} from "./shopping-share";

describe("shopping-share", () => {
  it("builds and parses selection keys", () => {
    const key = buildShoppingShareItemSelectionKey({
      sourceKey: "item-1",
      sourceType: "FAMILY",
    });

    expect(key).toBe("FAMILY:item-1");
    expect(parseShoppingShareItemSelectionKey(key)).toEqual({
      sourceKey: "item-1",
      sourceType: "FAMILY",
    });
  });

  it("parses a valid snapshot", () => {
    const snapshot = parseShoppingListShareSnapshot({
      items: [
        {
          categoryId: "cat-1",
          categoryName: "Meieri",
          id: "FAMILY:item-1",
          name: "Melk",
          note: null,
          quantityLabel: "1 l",
        },
      ],
      stores: [
        {
          id: "store-1",
          name: "Rema 1000",
          sections: [
            {
              categoryId: "cat-1",
              displayName: "Meieri",
              sortOrder: 0,
            },
          ],
        },
      ],
    });

    expect(snapshot?.items).toHaveLength(1);
    expect(snapshot?.stores[0]?.name).toBe("Rema 1000");
  });

  it("rejects an invalid snapshot", () => {
    expect(parseShoppingListShareSnapshot({ items: "nope" })).toBeNull();
    expect(parseShoppingListShareSnapshot(null)).toBeNull();
  });
});
