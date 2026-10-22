import type { QuickAddShoppingSuccess } from "./shopping-quick-add";

export type StoreModeNotice =
  | "family-shopping-item-added"
  | "generated-shopping-item-marked-as-stock"
  | "selected-store-updated"
  | "shopping-item-check-state-updated"
  | "stock-shopping-items-opted-in"
  | "store-mode-trip-focus-updated"
  | "shopping-grocery-grouping-updated";

export type StoreModeIntent =
  | "quick-add-family-shopping-item"
  | "mark-family-shopping-item-as-stock"
  | "mark-generated-shopping-item-as-stock"
  | "opt-in-stock-shopping-item"
  | "opt-in-stock-shopping-items"
  | "update-family-shopping-item-category"
  | "update-family-shopping-item-quantity"
  | "update-generated-shopping-item-quantity"
  | "update-manual-shopping-item-category"
  | "toggle-family-shopping-item-checked"
  | "toggle-shopping-item-checked"
  | "update-selected-store"
  | "update-shopping-grocery-grouping"
  | "update-show-category-headings"
  | "update-store-mode-trip-focus";

export interface StoreModeActionData {
  categoryFieldErrors?: {
    categoryId?: string;
  };
  formError?: string;
  intent?: StoreModeIntent;
  item?: QuickAddShoppingSuccess["item"];
  ok?: boolean;
  selectedStoreFieldErrors?: {
    selectedStoreId?: string;
  };
  selectedStoreValue?: string;
  showCategoryHeadings?: boolean;
  tripFocusFieldErrors?: {
    tripFocus?: string;
  };
  tripFocusValue?: string;
}
