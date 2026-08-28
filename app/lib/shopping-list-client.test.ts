import { describe, expect, it } from "vitest";

import {
  applyOptimisticShoppingListFormOverlay,
  buildOptimisticManualShoppingItem,
  dropResolvedOptimisticItemsFromStoreGroups,
  filterStoreGroupsBySourceType,
  getOptimisticChecked,
  insertProjectedItemIntoSectionGroups,
  insertProjectedItemIntoStoreGroups,
  mergeQuickAddedItemsIntoList,
  patchProjectedItemInSectionGroups,
  patchProjectedItemInStoreGroups,
  prependRecentManualItem,
  relocateProjectedItemInSectionGroups,
  relocateProjectedItemInStoreGroups,
  removeProjectedItemFromStoreGroups,
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
    mealPlanId: null,
    mealPlanTitle: null,
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

  it("removes an item from store groups and drops empty groups", () => {
    const existingItem = createFamilyItem({
      name: "Brød",
      sourceKey: "item-1",
    });

    const result = removeProjectedItemFromStoreGroups(
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
      "item-1",
    );

    expect(result).toEqual([]);
  });

  it("patches quantity and checked in store groups without moving the item", () => {
    const existingItem = createFamilyItem({
      name: "Melk",
      quantity: "1",
      quantityLabel: "1",
      sourceKey: "item-1",
    });

    const result = patchProjectedItemInStoreGroups(
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
      "item-1",
      {
        checked: true,
        quantity: "2 liter",
        quantityLabel: "2 liter",
      },
    );

    expect(result[0]?.sections[0]?.items[0]).toMatchObject({
      checked: true,
      quantity: "2 liter",
      quantityLabel: "2 liter",
      sourceKey: "item-1",
    });
    expect(result[0]?.sections[0]?.displayName).toBe("Meieri");
  });

  it("patches an item in section groups", () => {
    const existingItem = createFamilyItem({
      name: "Melk",
      note: null,
      sourceKey: "item-1",
    });

    const result = patchProjectedItemInSectionGroups(
      [
        {
          category: existingItem.category,
          displayName: existingItem.section.displayName,
          items: [existingItem],
        },
      ],
      "item-1",
      { note: "Tine" },
    );

    expect(result[0]?.items[0]?.note).toBe("Tine");
  });

  it("relocates an item into a new store group", () => {
    const existingItem = createFamilyItem({
      name: "Bananer",
      preferredStore: { id: "store-1", name: "Rema" },
      sourceKey: "item-1",
    });
    const updatedItem = createFamilyItem({
      name: "Bananer",
      preferredStore: { id: "store-2", name: "Kiwi" },
      sourceKey: "item-1",
    });

    const result = relocateProjectedItemInStoreGroups(
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
      "item-1",
      updatedItem,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.store?.id).toBe("store-2");
    expect(result[0]?.sections[0]?.items[0]?.sourceKey).toBe("item-1");
  });

  it("filters store groups down to a single source type", () => {
    const familyItem = createFamilyItem({
      name: "Melk",
      sourceKey: "family-1",
    });
    const generatedItem = {
      ...createFamilyItem({
        name: "Kylling",
        sourceKey: "generated-1",
      }),
      amount: null,
      firstDate: "2026-08-17",
      isStockItem: false,
      lastDate: "2026-08-17",
      occurrenceCount: 1,
      occurrences: [],
      postponedUntilDate: null,
      preferredStoreConflict: false,
      recipeCount: 1,
      sourceType: "GENERATED" as const,
      unit: null,
    };

    const result = filterStoreGroupsBySourceType(
      [
        {
          store: familyItem.preferredStore,
          sections: [
            {
              category: familyItem.category,
              displayName: familyItem.section.displayName,
              items: [familyItem, generatedItem],
            },
          ],
        },
      ],
      "FAMILY",
    );

    expect(result[0]?.sections[0]?.items.map((item) => item.sourceKey)).toEqual([
      "family-1",
    ]);
  });

  it("builds an optimistic family placeholder with a temp source key", () => {
    const item = buildOptimisticManualShoppingItem({
      category: { id: "category-1", name: "Meieri" },
      name: "  Melk  ",
      quantity: "1 liter",
      sourceType: "FAMILY",
    });

    expect(item.sourceType).toBe("FAMILY");
    expect(item.name).toBe("Melk");
    expect(item.quantity).toBe("1 liter");
    expect(item.checked).toBe(false);
    expect(item.sourceKey.startsWith("optimistic:")).toBe(true);
  });

  it("drops optimistic placeholders once the loader has a matching name", () => {
    const placeholder = buildOptimisticManualShoppingItem({
      category: { id: "category-1", name: "Meieri" },
      name: "Melk",
      sourceKey: "optimistic:temp",
      sourceType: "FAMILY",
    });
    const loaderItem = createFamilyItem({
      name: "Melk",
      sourceKey: "family-real",
    });

    const result = dropResolvedOptimisticItemsFromStoreGroups(
      [
        {
          store: placeholder.preferredStore,
          sections: [
            {
              category: placeholder.category,
              displayName: placeholder.section.displayName,
              items: [placeholder],
            },
          ],
        },
      ],
      [loaderItem],
    );

    expect(result).toEqual([]);
  });

  it("reads the pending checked value from in-flight form data", () => {
    expect(
      getOptimisticChecked({
        checkedValue: "true",
        isPending: true,
        itemChecked: false,
      }),
    ).toBe(true);
    expect(
      getOptimisticChecked({
        checkedValue: "false",
        isPending: true,
        itemChecked: true,
      }),
    ).toBe(false);
    expect(
      getOptimisticChecked({
        checkedValue: "true",
        isPending: false,
        itemChecked: false,
      }),
    ).toBe(false);
  });

  it("removes a deleted item from the in-flight overlay", () => {
    const existingItem = createFamilyItem({
      name: "Melk",
      sourceKey: "item-1",
    });
    const formData = new FormData();

    const result = applyOptimisticShoppingListFormOverlay({
      categories: [{ displayName: "Meieri", id: "category-1" }],
      formData,
      groups: [
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
      intent: "delete-family-shopping-item",
      sourceKey: "item-1",
      stores: [],
    });

    expect(result).toEqual([]);
  });

  it("patches and relocates an updated item from in-flight form data", () => {
    const existingItem = createFamilyItem({
      name: "Melk",
      sourceKey: "item-1",
    });
    const formData = new FormData();
    formData.set("name", "Lettmelk");
    formData.set("quantity", "2");
    formData.set("categoryId", "category-produce");
    formData.set("note", "Tine");

    const result = applyOptimisticShoppingListFormOverlay({
      categories: [
        { displayName: "Meieri", id: "category-1" },
        { displayName: "Frukt og grønt", id: "category-produce" },
      ],
      formData,
      groups: [
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
      intent: "update-family-shopping-item",
      sourceKey: "item-1",
      stores: [],
    });

    expect(result[0]?.sections[0]?.displayName).toBe("Frukt og grønt");
    expect(result[0]?.sections[0]?.items[0]).toMatchObject({
      name: "Lettmelk",
      note: "Tine",
      quantity: "2",
    });
  });
});
