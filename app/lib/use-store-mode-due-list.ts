import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FetcherWithComponents } from "react-router";

import type { StoreModeCategoryUpdateRequest } from "../components/store-mode-shopping-item-card";
import {
  buildOptimisticManualShoppingItem,
  dropResolvedOptimisticItemsFromSectionGroups,
  insertProjectedItemIntoSectionGroups,
  patchProjectedItemInSectionGroups,
  relocateProjectedItemInSectionGroups,
  removeProjectedItemFromSectionGroups,
  resolveQuickAddPlaceholderPlacement,
  type SerializedProjectedShoppingSectionGroup,
} from "./shopping-list-client";
import type {
  OptimisticQuickAddDraft,
  QuickAddShoppingSuccess,
} from "./shopping-quick-add";
import { scrollToShoppingItem } from "./shopping-quick-add-feedback.client";
import type { StoreModeActionData } from "./store-mode-action-data";

interface StoreModeCategoryOption {
  displayName: string;
  id: string;
  key: string | null;
}

export function useStoreModeDueList({
  categories,
  categoryFetcher,
  initialSections,
  quantityFetcher,
  scheduleRevalidate,
}: {
  categories: StoreModeCategoryOption[];
  categoryFetcher: FetcherWithComponents<StoreModeActionData>;
  initialSections: SerializedProjectedShoppingSectionGroup[];
  quantityFetcher: FetcherWithComponents<StoreModeActionData>;
  scheduleRevalidate: () => void;
}) {
  const [dueSectionGroups, setDueSectionGroups] = useState(initialSections);
  const [quickAddPrefillRequest, setQuickAddPrefillRequest] = useState<{
    id: string;
    name: string;
    quantity: string | null;
  } | null>(null);
  const [recentlyAddedSourceKey, setRecentlyAddedSourceKey] = useState<
    string | null
  >(null);
  const quantityRollbackRef = useRef(initialSections);
  const categoryRollbackRef = useRef(initialSections);
  const fallbackCategory = useMemo(
    () =>
      categories[0] ?? {
        displayName: "Annet",
        id: "uncategorized",
        key: "other",
      },
    [categories],
  );
  const loaderDueItems = useMemo(
    () => dueSectionGroups.flatMap((section) => section.items),
    [dueSectionGroups],
  );

  useEffect(() => {
    setDueSectionGroups(
      dropResolvedOptimisticItemsFromSectionGroups(
        initialSections,
        initialSections.flatMap((section) => section.items),
      ),
    );
  }, [initialSections]);

  const handleQuickAddSubmit = useCallback(
    (draft: OptimisticQuickAddDraft) => {
      setDueSectionGroups((currentSections) => {
        const placement = resolveQuickAddPlaceholderPlacement({
          categories: categories.map(toQuickAddCategory),
          categoryId: draft.categoryId,
          fallbackCategory: toQuickAddCategory(fallbackCategory),
          sections: currentSections,
        });

        return insertProjectedItemIntoSectionGroups(
          currentSections,
          buildOptimisticManualShoppingItem({
            category: placement.category,
            name: draft.name,
            quantity: draft.quantity,
            section: placement.section,
            sourceKey: draft.sourceKey,
            sourceType: "FAMILY",
          }),
        );
      });
      setRecentlyAddedSourceKey(draft.sourceKey);
    },
    [categories, fallbackCategory],
  );

  const handleQuickAddSuccess = useCallback(
    (payload: QuickAddShoppingSuccess) => {
      setDueSectionGroups((currentSections) =>
        insertProjectedItemIntoSectionGroups(
          dropResolvedOptimisticItemsFromSectionGroups(currentSections, [
            payload.item,
          ]),
          payload.item,
        ),
      );
      setRecentlyAddedSourceKey(payload.item.sourceKey);
      setQuickAddPrefillRequest(null);
      scheduleRevalidate();
    },
    [scheduleRevalidate],
  );

  const handleQuickAddError = useCallback((sourceKey: string) => {
    setDueSectionGroups((currentSections) =>
      removeProjectedItemFromSectionGroups(currentSections, sourceKey),
    );
  }, []);

  const handleQuickAddFromCard = useCallback(
    (item: { name: string; quantityLabel: string | null }) => {
      setQuickAddPrefillRequest({
        id: `${Date.now()}-${item.name}`,
        name: item.name,
        quantity: item.quantityLabel,
      });
    },
    [],
  );

  const handleUpdateQuantity = useCallback(
    ({
      expectedUpdatedAt,
      mealPlanId,
      quantity,
      sourceKey,
      sourceType,
    }: {
      expectedUpdatedAt: string;
      mealPlanId?: string | null;
      quantity: string;
      sourceKey: string;
      sourceType: "FAMILY" | "GENERATED";
    }) => {
      const formData = new FormData();
      formData.set(
        "intent",
        sourceType === "GENERATED"
          ? "update-generated-shopping-item-quantity"
          : "update-family-shopping-item-quantity",
      );
      formData.set("sourceKey", sourceKey);
      formData.set("expectedUpdatedAt", expectedUpdatedAt);
      formData.set("quantity", quantity);

      if (sourceType === "GENERATED" && mealPlanId) {
        formData.set("itemMealPlanId", mealPlanId);
      }

      const trimmedQuantity = quantity.trim() || null;
      setDueSectionGroups((currentSections) => {
        quantityRollbackRef.current = currentSections;
        return patchProjectedItemInSectionGroups(currentSections, sourceKey, {
          quantity: trimmedQuantity,
          quantityLabel: trimmedQuantity,
        });
      });
      quantityFetcher.submit(formData, { method: "post" });
    },
    [quantityFetcher],
  );

  useEffect(() => {
    if (quantityFetcher.state !== "idle") {
      return;
    }

    const data = quantityFetcher.data;

    if (
      data?.intent !== "update-family-shopping-item-quantity" &&
      data?.intent !== "update-generated-shopping-item-quantity"
    ) {
      return;
    }

    if (!data.ok) {
      setDueSectionGroups(quantityRollbackRef.current);
      return;
    }

    scheduleRevalidate();
  }, [quantityFetcher.data, quantityFetcher.state, scheduleRevalidate]);

  const handleUpdateCategory = useCallback(
    (request: StoreModeCategoryUpdateRequest) => {
      const formData = new FormData();
      formData.set(
        "intent",
        request.sourceType === "FAMILY"
          ? "update-family-shopping-item-category"
          : "update-manual-shopping-item-category",
      );
      formData.set("sourceKey", request.sourceKey);
      formData.set("expectedUpdatedAt", request.expectedUpdatedAt);
      formData.set("categoryId", request.categoryId);
      formData.set("name", request.name);
      formData.set("note", request.note);
      formData.set("preferredStoreId", request.preferredStoreId);
      formData.set("quantity", request.quantity);

      if (request.sourceType === "MANUAL") {
        formData.set("buyOnDate", request.buyOnDate);
        formData.set("itemMealPlanId", request.mealPlanId);
      }

      const nextCategory = categories.find(
        (category) => category.id === request.categoryId,
      );
      const trimmedNote = request.note.trim() || null;

      setDueSectionGroups((currentSections) => {
        categoryRollbackRef.current = currentSections;
        const currentItem = currentSections
          .flatMap((section) => section.items)
          .find((item) => item.sourceKey === request.sourceKey);

        if (!currentItem || !nextCategory) {
          return currentSections;
        }

        return relocateProjectedItemInSectionGroups(
          currentSections,
          request.sourceKey,
          {
            ...currentItem,
            category: {
              id: nextCategory.id,
              ...(nextCategory.key ? { key: nextCategory.key } : {}),
              name: nextCategory.displayName,
            },
            note: trimmedNote,
            section: {
              ...currentItem.section,
              displayName: nextCategory.displayName,
            },
          },
        );
      });
      setRecentlyAddedSourceKey(request.sourceKey);
      categoryFetcher.submit(formData, { method: "post" });
    },
    [categories, categoryFetcher],
  );

  useEffect(() => {
    if (categoryFetcher.state !== "idle") {
      return;
    }

    const data = categoryFetcher.data;

    if (
      data?.intent !== "update-family-shopping-item-category" &&
      data?.intent !== "update-manual-shopping-item-category"
    ) {
      return;
    }

    if (!data.ok) {
      setDueSectionGroups(categoryRollbackRef.current);
      return;
    }

    const updatedItem = data.item;

    if (updatedItem) {
      setDueSectionGroups((currentSections) =>
        relocateProjectedItemInSectionGroups(
          currentSections,
          updatedItem.sourceKey,
          updatedItem,
        ),
      );
      setRecentlyAddedSourceKey(updatedItem.sourceKey);
    }

    scheduleRevalidate();
  }, [categoryFetcher.data, categoryFetcher.state, scheduleRevalidate]);

  useEffect(() => {
    if (!recentlyAddedSourceKey) {
      return;
    }

    scrollToShoppingItem(recentlyAddedSourceKey);

    const clearHighlightTimeoutId = window.setTimeout(() => {
      setRecentlyAddedSourceKey((current) =>
        current === recentlyAddedSourceKey ? null : current,
      );
    }, 900);

    return () => {
      window.clearTimeout(clearHighlightTimeoutId);
    };
  }, [dueSectionGroups, recentlyAddedSourceKey]);

  return {
    dueSectionGroups,
    handleQuickAddError,
    handleQuickAddFromCard,
    handleQuickAddSubmit,
    handleQuickAddSuccess,
    handleUpdateCategory,
    handleUpdateQuantity,
    loaderDueItems,
    quickAddPrefillRequest,
    recentlyAddedSourceKey,
  };
}

function toQuickAddCategory(category: StoreModeCategoryOption) {
  return {
    displayName: category.displayName,
    id: category.id,
    ...(category.key ? { key: category.key } : {}),
  };
}
