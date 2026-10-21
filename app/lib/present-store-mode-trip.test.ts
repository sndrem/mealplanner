import { describe, expect, it } from "vitest";

import { presentStoreModeTrip } from "./present-store-mode-trip";

interface TripItem {
  checked: boolean;
  id: string;
  name: string;
  sourceKey: string;
}

interface TripSection {
  displayName: string;
  items: TripItem[];
}

function item(
  id: string,
  name: string,
  checked = false,
): TripItem {
  return {
    checked,
    id,
    name,
    sourceKey: id,
  };
}

function present(
  sections: TripSection[],
  {
    checkedItems = [],
    deprioritizeBought = true,
    pendingMarkAsStockSourceKey = "",
    showCategoryHeadings = true,
    sinkFinishedSections = false,
  }: {
    checkedItems?: TripItem[];
    deprioritizeBought?: boolean;
    pendingMarkAsStockSourceKey?: string;
    showCategoryHeadings?: boolean;
    sinkFinishedSections?: boolean;
  } = {},
) {
  return presentStoreModeTrip({
    checkedItemsBySourceKey: new Map(
      checkedItems.map((checkedItem) => [checkedItem.sourceKey, checkedItem]),
    ),
    deprioritizeBought,
    pendingMarkAsStockSourceKey,
    sections,
    showCategoryHeadings,
    sinkFinishedSections,
  });
}

describe("presentStoreModeTrip", () => {
  it("keeps checked rows in the section when bought items stay visible", () => {
    const result = present(
      [
        {
          displayName: "Produce",
          items: [item("a", "Eple", true), item("b", "Pære")],
        },
      ],
      { deprioritizeBought: false },
    );

    expect(result.sectionCount).toBe(1);
    expect(result.hiddenHeadingLists).toBeNull();
    expect(result.progress).toEqual({ checkedCount: 1, totalCount: 2 });
    expect(result.activeSections).toEqual([
      {
        displayName: "Produce",
        boughtItems: [],
        items: [item("a", "Eple", true), item("b", "Pære")],
      },
    ]);
  });

  it("splits bought rows and leaves finished sections in store order when sinking is off", () => {
    const result = present([
      {
        displayName: "Produce",
        items: [item("apple", "Eple")],
      },
      {
        displayName: "Dairy",
        items: [item("milk", "Melk", true)],
      },
      {
        displayName: "Bakery",
        items: [item("bread", "Brød")],
      },
    ]);

    expect(result.hiddenHeadingLists).toBeNull();
    expect(result.progress).toEqual({ checkedCount: 1, totalCount: 3 });
    expect(result.activeSections).toEqual([
      {
        displayName: "Produce",
        boughtItems: [],
        items: [item("apple", "Eple")],
      },
      {
        displayName: "Dairy",
        boughtItems: [item("milk", "Melk", true)],
        items: [],
      },
      {
        displayName: "Bakery",
        boughtItems: [],
        items: [item("bread", "Brød")],
      },
    ]);
  });

  it("sinks finished sections below open sections when headings are shown", () => {
    const result = present(
      [
        {
          displayName: "Produce",
          items: [item("apple", "Eple"), item("pear", "Pære", true)],
        },
        {
          displayName: "Dairy",
          items: [item("milk", "Melk", true)],
        },
        {
          displayName: "Bakery",
          items: [item("bread", "Brød")],
        },
        {
          displayName: "Frozen",
          items: [item("peas", "Erter", true), item("berries", "Bær", true)],
        },
      ],
      { sinkFinishedSections: true },
    );

    expect(result.activeSections.map((section) => section.displayName)).toEqual([
      "Produce",
      "Bakery",
      "Dairy",
      "Frozen",
    ]);
    expect(result.activeSections[0]).toEqual({
      displayName: "Produce",
      boughtItems: [item("pear", "Pære", true)],
      items: [item("apple", "Eple")],
    });
  });

  it("keeps a partly checked section open when bought items stay visible", () => {
    const result = present(
      [
        {
          displayName: "Produce",
          items: [item("pear", "Pære", true), item("apple", "Eple")],
        },
        {
          displayName: "Dairy",
          items: [item("milk", "Melk", true)],
        },
      ],
      { deprioritizeBought: false, sinkFinishedSections: true },
    );

    expect(result.activeSections).toEqual([
      {
        displayName: "Produce",
        boughtItems: [],
        items: [item("pear", "Pære", true), item("apple", "Eple")],
      },
      {
        displayName: "Dairy",
        boughtItems: [],
        items: [item("milk", "Melk", true)],
      },
    ]);
  });

  it("sinks an empty section when bought items stay visible", () => {
    const result = present(
      [
        { displayName: "Dairy", items: [] },
        { displayName: "Produce", items: [item("apple", "Eple")] },
      ],
      { deprioritizeBought: false, sinkFinishedSections: true },
    );

    expect(result.sectionCount).toBe(2);
    expect(result.activeSections.map((section) => section.displayName)).toEqual([
      "Produce",
      "Dairy",
    ]);
  });

  it("omits an empty section when bought items are split out", () => {
    const result = present(
      [
        { displayName: "Produce", items: [] },
        { displayName: "Dairy", items: [item("milk", "Melk")] },
        { displayName: "Bakery", items: [item("bread", "Brød", true)] },
      ],
      { sinkFinishedSections: true },
    );

    expect(result.sectionCount).toBe(3);
    expect(result.activeSections).toEqual([
      {
        displayName: "Dairy",
        boughtItems: [],
        items: [item("milk", "Melk")],
      },
      {
        displayName: "Bakery",
        boughtItems: [item("bread", "Brød", true)],
        items: [],
      },
    ]);
  });

  it("sorts each section's flat lists and skips sinking when headings are hidden", () => {
    const result = present(
      [
        {
          displayName: "Dairy",
          items: [
            item("milk", "Melk", true),
            item("yogurt", "Yoghurt"),
            item("butter", "Smør"),
          ],
        },
        {
          displayName: "Produce",
          items: [item("apple", "Eple", true), item("pear", "Pære")],
        },
      ],
      { showCategoryHeadings: false, sinkFinishedSections: true },
    );

    expect(result.activeSections.map((section) => section.displayName)).toEqual([
      "Dairy",
      "Produce",
    ]);
    expect(result.hiddenHeadingLists).toEqual({
      boughtItems: [item("milk", "Melk", true), item("apple", "Eple", true)],
      openItems: [
        item("butter", "Smør"),
        item("yogurt", "Yoghurt"),
        item("pear", "Pære"),
      ],
    });
  });

  it("moves checked rows into the flat bought list when bought items stay visible", () => {
    const result = present(
      [
        {
          displayName: "Dairy",
          items: [item("butter", "Smør"), item("milk", "Melk", true)],
        },
      ],
      { deprioritizeBought: false, showCategoryHeadings: false },
    );

    expect(result.activeSections[0]?.boughtItems).toEqual([]);
    expect(result.hiddenHeadingLists).toEqual({
      boughtItems: [item("milk", "Melk", true)],
      openItems: [item("butter", "Smør")],
    });
  });

  it("drops a pending stock row before the count", () => {
    const result = present(
      [
        {
          displayName: "Dairy",
          items: [item("milk", "Melk"), item("yogurt", "Yoghurt", true)],
        },
      ],
      { pendingMarkAsStockSourceKey: "milk" },
    );

    expect(result.sectionCount).toBe(1);
    expect(result.progress).toEqual({ checkedCount: 1, totalCount: 1 });
    expect(result.activeSections).toEqual([
      {
        displayName: "Dairy",
        boughtItems: [item("yogurt", "Yoghurt", true)],
        items: [],
      },
    ]);
  });

  it("moves a section to the finished side when an overlaid check completes it", () => {
    const apple = item("apple", "Eple", true);
    const result = present(
      [
        { displayName: "Dairy", items: [item("milk", "Melk")] },
        { displayName: "Produce", items: [item("apple", "Eple")] },
      ],
      { checkedItems: [apple], sinkFinishedSections: true },
    );

    expect(result.progress).toEqual({ checkedCount: 1, totalCount: 2 });
    expect(result.activeSections).toEqual([
      {
        displayName: "Dairy",
        boughtItems: [],
        items: [item("milk", "Melk")],
      },
      {
        displayName: "Produce",
        boughtItems: [apple],
        items: [],
      },
    ]);
  });

  it("keeps that finished section in store order when headings are hidden", () => {
    const apple = item("apple", "Eple", true);
    const result = present(
      [
        { displayName: "Dairy", items: [item("milk", "Melk")] },
        { displayName: "Produce", items: [item("apple", "Eple")] },
      ],
      {
        checkedItems: [apple],
        showCategoryHeadings: false,
        sinkFinishedSections: true,
      },
    );

    expect(result.activeSections.map((section) => section.displayName)).toEqual([
      "Dairy",
      "Produce",
    ]);
    expect(result.hiddenHeadingLists).toEqual({
      boughtItems: [apple],
      openItems: [item("milk", "Melk")],
    });
  });
});
