import {
  partitionStoreModeSections,
  sortStoreModeItemsByName,
  type StoreModeProgress,
} from "./shopping-store-mode-client";

interface CheckedItemLookup<TItem> {
  get(sourceKey: string): TItem | undefined;
}

export function presentStoreModeTrip<
  TItem extends { checked: boolean; name: string; sourceKey: string },
  TSection extends { items: TItem[] },
>({
  checkedItemsBySourceKey,
  deprioritizeBought,
  pendingMarkAsStockSourceKey,
  sections,
  showCategoryHeadings,
  sinkFinishedSections,
}: {
  checkedItemsBySourceKey: CheckedItemLookup<TItem>;
  deprioritizeBought: boolean;
  pendingMarkAsStockSourceKey: string;
  sections: TSection[];
  showCategoryHeadings: boolean;
  sinkFinishedSections: boolean;
}) {
  const overlaidSections = sections.map((section) => ({
    ...section,
    items: overlaySectionItems(
      section.items,
      checkedItemsBySourceKey,
      pendingMarkAsStockSourceKey,
    ),
  }));
  const { activeSections } = partitionStoreModeSections(
    overlaidSections,
    deprioritizeBought,
    showCategoryHeadings && sinkFinishedSections,
  );

  return {
    activeSections,
    hiddenHeadingLists: showCategoryHeadings
      ? null
      : flattenSectionsForHiddenHeadings(activeSections),
    progress: countCheckedRows(overlaidSections.flatMap((section) => section.items)),
    sectionCount: overlaidSections.length,
  };
}

function overlaySectionItems<TItem extends { sourceKey: string }>(
  items: TItem[],
  checkedItemsBySourceKey: CheckedItemLookup<TItem>,
  pendingMarkAsStockSourceKey: string,
) {
  const overlaidItems = items.map(
    (item) => checkedItemsBySourceKey.get(item.sourceKey) ?? item,
  );

  if (!pendingMarkAsStockSourceKey) {
    return overlaidItems;
  }

  return overlaidItems.filter(
    (item) => item.sourceKey !== pendingMarkAsStockSourceKey,
  );
}

function flattenSectionsForHiddenHeadings<
  TItem extends { checked: boolean; name: string; sourceKey: string },
>(sections: Array<{ boughtItems: TItem[]; items: TItem[] }>) {
  const openItems: TItem[] = [];
  const boughtItems: TItem[] = [];

  for (const section of sections) {
    const sectionOpenItems: TItem[] = [];
    const sectionBoughtItems: TItem[] = [];

    for (const item of section.items) {
      if (item.checked) {
        sectionBoughtItems.push(item);
      } else {
        sectionOpenItems.push(item);
      }
    }

    openItems.push(...sortStoreModeItemsByName(sectionOpenItems));
    boughtItems.push(
      ...sortStoreModeItemsByName([
        ...sectionBoughtItems,
        ...section.boughtItems,
      ]),
    );
  }

  return {
    boughtItems,
    openItems,
  };
}

function countCheckedRows(
  items: Array<{ checked: boolean }>,
): StoreModeProgress {
  return {
    checkedCount: items.filter((item) => item.checked).length,
    totalCount: items.length,
  };
}
