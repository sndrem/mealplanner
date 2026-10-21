import { useMemo, type ComponentProps } from "react";

import { sortStoreModeItemsByName, type StoreModeShoppingView } from "../lib/shopping-store-mode-client";
import { storeModeItemGridClass } from "../lib/store-mode-theme";
import {
  StoreModeShoppingItemCard,
  type StoreModeCategoryUpdateRequest,
} from "./store-mode-shopping-item-card";

export function StoreModeItemGrid<
  TItem extends ComponentProps<typeof StoreModeShoppingItemCard>["item"],
>({
  canMarkAsStock = false,
  categories,
  categoryFetcherError,
  categoryInteractionSourceKey,
  isSavingCategorySourceKey,
  items,
  layout,
  onQuickAddFromCard,
  onUpdateCategory,
  onUpdateQuantity,
  onToggleItem,
  pendingMarkAsStockSourceKey = "",
  preserveOrder = false,
  recentlyAddedSourceKey,
  selectedStoreId,
  showRecipeUrgency = false,
}: {
  canMarkAsStock?: boolean;
  categories: ComponentProps<typeof StoreModeShoppingItemCard>["categories"];
  categoryFetcherError: string | null;
  categoryInteractionSourceKey: string;
  isSavingCategorySourceKey: string | null;
  items: TItem[];
  layout: StoreModeShoppingView;
  onQuickAddFromCard: (item: {
    name: string;
    quantityLabel: string | null;
  }) => void;
  onUpdateCategory: (request: StoreModeCategoryUpdateRequest) => void;
  onUpdateQuantity: (item: {
    expectedUpdatedAt: string;
    mealPlanId?: string | null;
    quantity: string;
    sourceKey: string;
    sourceType: "FAMILY" | "GENERATED";
  }) => void;
  onToggleItem: (item: TItem) => void;
  pendingMarkAsStockSourceKey?: string;
  preserveOrder?: boolean;
  recentlyAddedSourceKey: string | null;
  selectedStoreId?: string;
  showRecipeUrgency?: boolean;
}) {
  const sortedItems = useMemo(
    () => (preserveOrder ? items : sortStoreModeItemsByName(items)),
    [items, preserveOrder],
  );

  return (
    <div
      className={
        layout === "grid" ? storeModeItemGridClass : "mt-4 flex flex-col gap-2"
      }
    >
      {sortedItems.map((item) => (
        <StoreModeShoppingItemCard
          key={item.sourceKey}
          canMarkAsStock={canMarkAsStock}
          categories={categories}
          categoryError={
            categoryInteractionSourceKey === item.sourceKey
              ? categoryFetcherError
              : null
          }
          isPendingMarkAsStock={pendingMarkAsStockSourceKey === item.sourceKey}
          isRecentlyAdded={recentlyAddedSourceKey === item.sourceKey}
          isSavingCategory={isSavingCategorySourceKey === item.sourceKey}
          item={item}
          layout={layout}
          onQuickAddFromCard={onQuickAddFromCard}
          onUpdateCategory={onUpdateCategory}
          onUpdateQuantity={onUpdateQuantity}
          onToggle={() => onToggleItem(item)}
          selectedStoreId={selectedStoreId}
          showRecipeUrgency={showRecipeUrgency}
          solidSurface={preserveOrder}
        />
      ))}
    </div>
  );
}
