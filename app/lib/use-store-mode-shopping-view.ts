import { useCallback, useMemo } from "react";
import type { FetcherWithComponents } from "react-router";

import { presentStoreModeTrip } from "./present-store-mode-trip";
import type { StoreModeActionData } from "./store-mode-action-data";
import { resolveShowCategoryHeadings } from "./store-mode-route-state";
import { useShoppingListCompletionCelebration } from "./use-shopping-list-completion-celebration";

export function useStoreModeShoppingView<
  TItem extends { checked: boolean; name: string; sourceKey: string },
  TSection extends { items: TItem[] },
>({
  categoryHeadingsFetcher,
  deprioritizeBought,
  displayItemsBySourceKey,
  dueSectionGroups,
  pendingMarkAsStockSourceKey,
  showCategoryHeadings: savedShowCategoryHeadings,
  sinkFinishedSections,
}: {
  categoryHeadingsFetcher: FetcherWithComponents<StoreModeActionData>;
  deprioritizeBought: boolean;
  displayItemsBySourceKey: { get(sourceKey: string): TItem | undefined };
  dueSectionGroups: TSection[];
  pendingMarkAsStockSourceKey: string;
  showCategoryHeadings: boolean;
  sinkFinishedSections: boolean;
}) {
  const showCategoryHeadings = resolveShowCategoryHeadings({
    categoryHeadingsFetcher,
    showCategoryHeadings: savedShowCategoryHeadings,
  });
  const presentedTrip = useMemo(
    () =>
      presentStoreModeTrip({
        checkedItemsBySourceKey: displayItemsBySourceKey,
        deprioritizeBought,
        pendingMarkAsStockSourceKey,
        sections: dueSectionGroups,
        showCategoryHeadings,
        sinkFinishedSections,
      }),
    [
      deprioritizeBought,
      displayItemsBySourceKey,
      dueSectionGroups,
      pendingMarkAsStockSourceKey,
      showCategoryHeadings,
      sinkFinishedSections,
    ],
  );
  const { isCelebrating } = useShoppingListCompletionCelebration(
    presentedTrip.progress,
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
  const hasUncheckedDueItems = presentedTrip.activeSections.some(
    (section) => section.items.length > 0,
  );

  return {
    activeSections: presentedTrip.activeSections,
    handleShowCategoryHeadingsChange,
    hasUncheckedDueItems,
    hiddenHeadingLists: presentedTrip.hiddenHeadingLists,
    isCelebrating,
    progress: presentedTrip.progress,
    sectionCount: presentedTrip.sectionCount,
    showCategoryHeadings,
  };
}
