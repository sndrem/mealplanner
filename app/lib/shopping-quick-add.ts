import type { FamilyShoppingItemFieldErrors } from "./family-shopping-write.server";
import type { SerializedProjectedShoppingItem } from "./shopping-serialize";
import type { ManualShoppingItemFieldErrors } from "./shopping-write.server";

export type QuickAddShoppingIntent =
  | "quick-add-manual-shopping-item"
  | "quick-add-family-shopping-item";

export type QuickAddShoppingSuccess = {
  intent: QuickAddShoppingIntent;
  item: SerializedProjectedShoppingItem;
  ok: true;
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

export interface OptimisticQuickAddDraft {
  categoryId?: string | null;
  name: string;
  quantity: string;
  sourceKey: string;
}

export interface QuickAddNameMatch {
  canonicalName: string;
  defaultCategoryId: string | null;
  defaultQuantity?: string | null;
  id: string;
  source?: "catalog" | "register";
}

export function resolveTypedQuickAddTarget(
  name: string,
  results: readonly QuickAddNameMatch[],
): QuickAddNameMatch | null {
  const normalized = name.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  return (
    results.find(
      (result) => result.canonicalName.trim().toLowerCase() === normalized,
    ) ?? null
  );
}
