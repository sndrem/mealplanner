import { useCallback, useMemo } from "react";
import type { FetcherWithComponents } from "react-router";

import { useShoppingListCompletionCelebration } from "./use-shopping-list-completion-celebration";
import {
  computeStoreModeProgress,
  flattenStoreModeSectionsForHiddenHeadings,
  partitionStoreModeSections,
} from "./shopping-store-mode-client";
import type { StoreModeActionData } from "./store-mode-action-data";
import { resolveShowCategoryHeadings } from "./store-mode-route-state";

export function useStoreModeShoppingView<
  TItem extends { checked: boolean; name: string; sourceKey: string },
  TSection extends { items: TItem[] },
>({
  categoryHeadingsFetcher,
  deprioritizeBought,
  displayItemsBySourceKey,
  dueSectionGroups,
  loaderDueItems,
  pendingMarkAsStockSourceKey,
  showCategoryHeadings: savedShowCategoryHeadings,
  sinkFinishedSections,
}: {
  categoryHeadingsFetcher: FetcherWithComponents<StoreModeActionData>;
  deprioritizeBought: boolean;
  displayItemsBySourceKey: { get(sourceKey: string): TItem | undefined };
  dueSectionGroups: TSection[];
  loaderDueItems: TItem[];
  pendingMarkAsStockSourceKey: string;
  showCategoryHeadings: boolean;
  sinkFinishedSections: boolean;
}) {
  const displayDueItems = useMemo(
    () =>
      overlayStoreModeItems(
        loaderDueItems,
        displayItemsBySourceKey,
        pendingMarkAsStockSourceKey,
      ),
    [displayItemsBySourceKey, loaderDueItems, pendingMarkAsStockSourceKey],
  );
  const displayProgress = useMemo(
    () => computeStoreModeProgress(displayDueItems),
    [displayDueItems],
  );
  const { isCelebrating } = useShoppingListCompletionCelebration(displayProgress);
  const displaySectionGroups = useMemo(
    () =>
      dueSectionGroups.map((section) => ({
        ...section,
        items: overlayStoreModeItems(
          section.items,
          displayItemsBySourceKey,
          pendingMarkAsStockSourceKey,
        ),
      })),
    [displayItemsBySourceKey, dueSectionGroups, pendingMarkAsStockSourceKey],
  );
  const showCategoryHeadings = resolveShowCategoryHeadings({
    categoryHeadingsFetcher,
    showCategoryHeadings: savedShowCategoryHeadings,
  });
  const { activeSections } = useMemo(
    () =>
      partitionStoreModeSections(
        displaySectionGroups,
        deprioritizeBought,
        showCategoryHeadings && sinkFinishedSections,
      ),
    [
      deprioritizeBought,
      displaySectionGroups,
      showCategoryHeadings,
      sinkFinishedSections,
    ],
  );
  const hiddenHeadingLists = useMemo(
    () =>
      showCategoryHeadings
        ? null
        : flattenStoreModeSectionsForHiddenHeadings(activeSections),
    [activeSections, showCategoryHeadings],
  );
  const handleShowCategoryHeadingsChange = useCallback(
    (nextShowCategoryHeadings: boolean) => {
      const formData = new FormData();
      formData.set("intent", "update-show-category-headings");
      formData.set(
        "showCategoryHeadings",
        nextShowCategoryHeadings ? "true" : "false",
      );
      categoryHeadingsFetcher.submit(formData, { method: "post" });
    },
    [categoryHeadingsFetcher],
  );
  const hasUncheckedDueItems = activeSections.some(
    (section) => section.items.length > 0,
  );

  return {
    activeSections,
    displayProgress,
    displaySectionGroups,
    handleShowCategoryHeadingsChange,
    hasUncheckedDueItems,
    hiddenHeadingLists,
    isCelebrating,
    showCategoryHeadings,
  };
}

function overlayStoreModeItems<TItem extends { sourceKey: string }>(
  items: TItem[],
  displayItemsBySourceKey: { get(sourceKey: string): TItem | undefined },
  pendingMarkAsStockSourceKey: string,
) {
  const displayItems = items.map(
    (item) => displayItemsBySourceKey.get(item.sourceKey) ?? item,
  );

  if (!pendingMarkAsStockSourceKey) {
    return displayItems;
  }

  return displayItems.filter(
    (item) => item.sourceKey !== pendingMarkAsStockSourceKey,
  );
}
