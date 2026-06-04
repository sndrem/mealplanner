import { describe, expect, it } from "vitest";

import {
  insertProjectedItemIntoSectionGroups,
  insertProjectedItemIntoStoreGroups,
  mergeQuickAddedItemsIntoList,
  prependRecentManualItem,
  relocateProjectedItemInSectionGroups,
} from "./shopping-list-client";
import type { SerializedProjectedShoppingItem } from "./shopping-serialize";

function createFamilyItem(
  overrides: {
    category?: { id: string; name: string };
    checked?: boolean;
    collaborationVersion?: string;
    name: string;
    note?: string | null;
    preferredStore?: { id: string; name: string } | null;
    quantity?: string | null;
    quantityLabel?: string | null;
    section?: { displayName: string; sortOrder: number };
    sourceKey: string;
  },
): SerializedProjectedShoppingItem {
  return {
    category: {
      id: overrides.category?.id ?? "category-1",
      name: overrides.category?.name ?? "Meieri",
    },
    checked: overrides.checked ?? false,
    collaborationVersion: overrides.collaborationVersion ?? "2026-05-31T00:00:00.000Z",
    name: overrides.name,
    note: overrides.note ?? null,
    preferredStore: ("preferredStore" in overrides
      ? overrides.preferredStore
      : {
          id: "store-1",
          name: "Rema",
        }) as SerializedProjectedShoppingItem["preferredStore"],
    quantity: overrides.quantity ?? "1",
    quantityLabel: overrides.quantityLabel ?? "1",
    section: overrides.section ?? {
      displayName: "Meieri",
      sortOrder: 1,
    },
    sourceKey: overrides.sourceKey,
    sourceType: "FAMILY",
  };
}

describe("shopping-list-client", () => {
  it("inserts a new item into an existing store section", () => {
    const existingItem = createFamilyItem({
      name: "Brød",
      sourceKey: "item-1",
    });
    const newItem = createFamilyItem({
      name: "Melk",
      sourceKey: "item-2",
    });

    const result = insertProjectedItemIntoStoreGroups(
      [
        {
          store: existingItem.preferredStore,
          sections: [
            {
              category: existingItem.category,
              displayName: existingItem.section.displayName,
              items: [existingItem],
            },
          ],
        },
      ],
      newItem,
    );

    expect(result[0]?.sections[0]?.items.map((item) => item.sourceKey)).toEqual([
      "item-1",
      "item-2",
    ]);
  });

  it("creates a new store group when needed", () => {
    const newItem = createFamilyItem({
      name: "Melk",
      preferredStore: null,
      sourceKey: "item-2",
    });

    const result = insertProjectedItemIntoStoreGroups([], newItem);

    expect(result).toHaveLength(1);
    expect(result[0]?.store).toBeNull();
    expect(result[0]?.sections[0]?.items[0]?.sourceKey).toBe("item-2");
  });

  it("inserts into section groups for store mode", () => {
    const existingItem = createFamilyItem({
      name: "Brød",
      sourceKey: "item-1",
    });
    const newItem = createFamilyItem({
      name: "Melk",
      sourceKey: "item-2",
    });

    const result = insertProjectedItemIntoSectionGroups(
      [
        {
          category: existingItem.category,
          displayName: existingItem.section.displayName,
          items: [existingItem],
        },
      ],
      newItem,
    );

    expect(result[0]?.items.map((item) => item.sourceKey)).toEqual([
      "item-1",
      "item-2",
    ]);
  });

  it("prepends recent manual items without duplicates", () => {
    const result = prependRecentManualItem(
      [
        {
          categoryId: "category-1",
          displayName: "Brød",
          nameNormalized: "brod",
          quantity: "1",
        },
      ],
      {
        categoryId: "category-2",
        displayName: "Melk",
        nameNormalized: "melk",
        quantity: "1",
      },
    );

    expect(result.map((item) => item.nameNormalized)).toEqual(["melk", "brod"]);
  });

  it("relocates an item into a new section group", () => {
    const existingItem = createFamilyItem({
      category: { id: "category-other", name: "Annet" },
      name: "Bananer",
      section: { displayName: "Annet", sortOrder: 99 },
      sourceKey: "item-1",
    });
    const updatedItem = createFamilyItem({
      category: { id: "category-produce", name: "Frukt og grønt" },
      name: "Bananer",
      section: { displayName: "Frukt og grønt", sortOrder: 2 },
      sourceKey: "item-1",
    });

    const result = relocateProjectedItemInSectionGroups(
      [
        {
          category: existingItem.category,
          displayName: existingItem.section.displayName,
          items: [existingItem],
        },
      ],
      "item-1",
      updatedItem,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.displayName).toBe("Frukt og grønt");
    expect(result[0]?.items[0]?.category.id).toBe("category-produce");
  });

  it("merges quick-added items by source key", () => {
    const loaderItem = createFamilyItem({
      name: "Brød",
      sourceKey: "item-1",
    });
    const quickAddedItem = createFamilyItem({
      name: "Melk",
      sourceKey: "item-2",
    });

    const result = mergeQuickAddedItemsIntoList([loaderItem], [quickAddedItem]);

    expect(result.map((item) => item.sourceKey)).toEqual(["item-1", "item-2"]);
  });
});
