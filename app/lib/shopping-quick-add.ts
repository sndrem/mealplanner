import type { FamilyShoppingItemFieldErrors } from "./family-shopping-write.server";
import type { RecentManualShoppingItem } from "./shopping.server";
import type { SerializedProjectedShoppingItem } from "./shopping-serialize";
import type { ManualShoppingItemFieldErrors } from "./shopping-write.server";

export type QuickAddShoppingIntent =
  | "quick-add-manual-shopping-item"
  | "quick-add-family-shopping-item";

export type QuickAddShoppingSuccess = {
  intent: QuickAddShoppingIntent;
  item: SerializedProjectedShoppingItem;
  ok: true;
  recentManualItem: RecentManualShoppingItem;
};

export type QuickAddShoppingError = {
  familyFieldErrors?: FamilyShoppingItemFieldErrors;
  formError?: string;
  intent: QuickAddShoppingIntent;
  manualFieldErrors?: ManualShoppingItemFieldErrors;
};

export type QuickAddShoppingActionData =
  | QuickAddShoppingSuccess
  | QuickAddShoppingError;

export function isQuickAddShoppingSuccess(
  data: QuickAddShoppingActionData | undefined,
): data is QuickAddShoppingSuccess {
  return Boolean(data && "ok" in data && data.ok === true);
}
