export interface ShoppingListProgress {
  checkedCount: number;
  totalCount: number;
}

export const SHOPPING_LIST_COMPLETE_HEADING = "Ferdig! 🛒";
export const SHOPPING_LIST_COMPLETE_BODY =
  "God handletur — alt er krysset av.";

export function getUncheckedCount(progress: ShoppingListProgress): number {
  return Math.max(progress.totalCount - progress.checkedCount, 0);
}

export function detectShoppingListJustCompleted(
  previous: ShoppingListProgress | null,
  current: ShoppingListProgress,
): boolean {
  if (current.totalCount <= 0) {
    return false;
  }

  if (previous === null) {
    return false;
  }

  return (
    getUncheckedCount(previous) > 0 && getUncheckedCount(current) === 0
  );
}
