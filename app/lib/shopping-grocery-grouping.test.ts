import { describe, expect, it } from "vitest";

import {
  buildShoppingGroceryGroupKey,
  groupGeneratedShoppingItemsForDisplay,
  isGroupedShoppingItem,
} from "./shopping-grocery-grouping";

function buildGeneratedItem(overrides: {
  checked?: boolean;
  mealPlanId?: string;
  name?: string;
  quantityLabel?: string | null;
  sourceKey: string;
  unitLabel?: string;
  recipeTitle?: string;
  date?: string;
}) {
  const date = new Date(`${overrides.date ?? "2026-05-15"}T00:00:00.000Z`);

  return {
    category: { id: "category-produce", name: "Frukt og gront" },
    checked: overrides.checked ?? false,
    collaborationVersion: "2026-05-01T12:00:00.000Z",
    firstDate: date,
    lastDate: date,
    mealPlanId: overrides.mealPlanId ?? "meal-plan-1",
    name: overrides.name ?? "Hvitlok",
    note: null,
    occurrenceCount: 1,
    occurrences: [
      {
        date,
        quantityLabel: overrides.quantityLabel ?? overrides.unitLabel ?? "1 fedd",
        recipeId: overrides.sourceKey,
        recipeTitle: overrides.recipeTitle ?? "Pasta",
      },
    ],
    preferredStore: null,
    preferredStoreConflict: false,
    quantity: null,
    quantityLabel: overrides.quantityLabel ?? overrides.unitLabel ?? "1 fedd",
    recipeCount: 1,
    sourceKey: overrides.sourceKey,
    sourceType: "GENERATED" as const,
  };
}

describe("shopping-grocery-grouping", () => {
  it("leaves items unchanged in split mode", () => {
    const items = [
      buildGeneratedItem({ sourceKey: "a", unitLabel: "1 fedd" }),
      buildGeneratedItem({ sourceKey: "b", unitLabel: "2 stk" }),
    ];

    expect(groupGeneratedShoppingItemsForDisplay(items, "SPLIT")).toEqual(items);
  });

  it("collapses mixed units of the same grocery within a meal plan", () => {
    const clove = buildGeneratedItem({
      quantityLabel: "1 fedd",
      recipeTitle: "Pasta",
      sourceKey: "entry-1:ingredient-1",
    });
    const bulb = buildGeneratedItem({
      date: "2026-05-16",
      quantityLabel: "1 stk",
      recipeTitle: "Taco",
      sourceKey: "entry-2:ingredient-2",
    });
    const milk = {
      ...buildGeneratedItem({
        name: "Melk",
        quantityLabel: "1 l",
        sourceKey: "family-milk",
      }),
      sourceType: "FAMILY" as const,
    };

    const grouped = groupGeneratedShoppingItemsForDisplay(
      [clove, milk, bulb],
      "GROUPED",
    );

    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toEqual(
      expect.objectContaining({
        checked: false,
        name: "Hvitlok",
        quantityLabel: null,
        recipeCount: 2,
        sourceKey: "entry-1:ingredient-1|entry-2:ingredient-2",
      }),
    );
    expect(isGroupedShoppingItem(grouped[0])).toBe(true);
    if (!isGroupedShoppingItem(grouped[0])) {
      throw new Error("Expected grouped garlic card.");
    }
    expect(grouped[0].groupingMembers.map((member) => member.sourceKey)).toEqual(
      ["entry-1:ingredient-1", "entry-2:ingredient-2"],
    );
    expect(grouped[0]?.occurrences.map((occurrence) => occurrence.quantityLabel)).toEqual(
      ["1 fedd", "1 stk"],
    );
    expect(grouped[1]).toEqual(milk);
  });

  it("keeps the same grocery on different meal plans as separate cards", () => {
    const thisWeek = buildGeneratedItem({
      mealPlanId: "meal-plan-1",
      sourceKey: "plan-1-garlic",
    });
    const nextWeek = buildGeneratedItem({
      mealPlanId: "meal-plan-2",
      sourceKey: "plan-2-garlic",
    });

    const grouped = groupGeneratedShoppingItemsForDisplay(
      [thisWeek, nextWeek],
      "GROUPED",
    );

    expect(grouped).toHaveLength(2);
    expect(grouped.map((item) => item.sourceKey)).toEqual([
      "plan-1-garlic",
      "plan-2-garlic",
    ]);
  });

  it("does not merge different grocery names", () => {
    const garlic = buildGeneratedItem({
      name: "Hvitlok",
      sourceKey: "garlic",
    });
    const onion = buildGeneratedItem({
      name: "Løk",
      sourceKey: "onion",
    });

    expect(
      groupGeneratedShoppingItemsForDisplay([garlic, onion], "GROUPED"),
    ).toHaveLength(2);
  });

  it("marks a group checked only when every member is checked", () => {
    const unchecked = buildGeneratedItem({
      sourceKey: "entry-1:ingredient-1",
    });
    const checked = buildGeneratedItem({
      checked: true,
      quantityLabel: "2 stk",
      sourceKey: "entry-2:ingredient-2",
    });

    const [grouped] = groupGeneratedShoppingItemsForDisplay(
      [unchecked, checked],
      "GROUPED",
    );

    expect(grouped?.checked).toBe(false);

    const [allChecked] = groupGeneratedShoppingItemsForDisplay(
      [
        { ...unchecked, checked: true },
        checked,
      ],
      "GROUPED",
    );

    expect(allChecked?.checked).toBe(true);
  });

  it("keeps a shared quantity label when every member uses the same amount", () => {
    const first = buildGeneratedItem({
      quantityLabel: "1 stk",
      sourceKey: "entry-1:ingredient-1",
    });
    const second = buildGeneratedItem({
      quantityLabel: "1 stk",
      sourceKey: "entry-2:ingredient-2",
    });

    const [grouped] = groupGeneratedShoppingItemsForDisplay(
      [first, second],
      "GROUPED",
    );

    expect(grouped?.quantityLabel).toBe("1 stk");
  });

  it("builds group keys from meal plan, category, and normalized name", () => {
    expect(
      buildShoppingGroceryGroupKey({
        category: { id: "produce" },
        mealPlanId: "plan-1",
        name: " Hvitløk ",
      }),
    ).toBe(
      JSON.stringify({
        categoryId: "produce",
        mealPlanId: "plan-1",
        name: "hvitløk",
      }),
    );
  });
});
