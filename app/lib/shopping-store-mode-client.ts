import { ShoppingItemSource } from "@prisma/client";

export type StoreModeItemSource = ShoppingItemSource | "FAMILY";

export interface StoreModeToggleOp {
  checked: boolean;
  expectedUpdatedAt: string;
  mealPlanId?: string | null;
  sourceKey: string;
  sourceType: StoreModeItemSource;
}

export interface StoreModeToggleItem {
  checked: boolean;
  collaborationVersion: string;
  mealPlanId?: string | null;
  overrideVersion?: string;
  sourceKey: string;
  sourceType: StoreModeItemSource;
}

export interface StoreModeProgress {
  checkedCount: number;
  totalCount: number;
}

export type StoreModeShoppingView = "list" | "grid";

export const DEFAULT_STORE_MODE_SHOPPING_VIEW: StoreModeShoppingView = "grid";

const STORE_MODE_QUEUE_KEY_PREFIX = "mealplanner:store-mode-queue:v1";
const STORE_MODE_VIEW_KEY_PREFIX = "mealplanner:store-mode-view:v1";
const STORE_MODE_DEPRIORITIZE_BOUGHT_KEY_PREFIX =
  "mealplanner:store-mode-deprioritize-bought:v1";

export function buildStoreModeViewStorageKey({
  familyId,
}: {
  familyId: string;
}) {
  return `${STORE_MODE_VIEW_KEY_PREFIX}:${familyId}`;
}

export function readStoreModeShoppingView(
  storageKey: string,
): StoreModeShoppingView {
  if (typeof window === "undefined") {
    return DEFAULT_STORE_MODE_SHOPPING_VIEW;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (raw === "grid" || raw === "list") {
      return raw;
    }

    return DEFAULT_STORE_MODE_SHOPPING_VIEW;
  } catch {
    return DEFAULT_STORE_MODE_SHOPPING_VIEW;
  }
}

export function writeStoreModeShoppingView(
  storageKey: string,
  view: StoreModeShoppingView,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, view);
  } catch {
    // Private mode or quota exceeded — in-session state still works.
  }
}

export function buildStoreModeDeprioritizeBoughtStorageKey({
  familyId,
}: {
  familyId: string;
}) {
  return `${STORE_MODE_DEPRIORITIZE_BOUGHT_KEY_PREFIX}:${familyId}`;
}

export function readStoreModeDeprioritizeBought(storageKey: string): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (raw === "false") {
      return false;
    }

    if (raw === "true") {
      return true;
    }

    return true;
  } catch {
    return true;
  }
}

export function writeStoreModeDeprioritizeBought(
  storageKey: string,
  enabled: boolean,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, enabled ? "true" : "false");
  } catch {
    // Private mode or quota exceeded — in-session state still works.
  }
}

export function compareStoreModeItemsByName(
  left: { name: string; sourceKey: string },
  right: { name: string; sourceKey: string },
) {
  const nameComparison = left.name.localeCompare(right.name, "nb");

  if (nameComparison !== 0) {
    return nameComparison;
  }

  return left.sourceKey.localeCompare(right.sourceKey, "nb");
}

export function sortStoreModeItemsByName<
  TItem extends { name: string; sourceKey: string },
>(items: TItem[]): TItem[] {
  return [...items].sort(compareStoreModeItemsByName);
}

export function partitionStoreModeSections<
  TItem extends { checked: boolean },
  TSection extends { items: TItem[] },
>(
  sections: TSection[],
  deprioritizeBought: boolean,
): { activeSections: TSection[]; boughtItems: TItem[] } {
  if (!deprioritizeBought) {
    return {
      activeSections: sections,
      boughtItems: [],
    };
  }

  const activeSections: TSection[] = [];
  const boughtItems: TItem[] = [];

  for (const section of sections) {
    const uncheckedItems: TItem[] = [];
    const checkedItems: TItem[] = [];

    for (const item of section.items) {
      if (item.checked) {
        checkedItems.push(item);
      } else {
        uncheckedItems.push(item);
      }
    }

    if (uncheckedItems.length > 0) {
      activeSections.push({
        ...section,
        items: uncheckedItems,
      });
    }

    boughtItems.push(...checkedItems);
  }

  return {
    activeSections,
    boughtItems,
  };
}

export function buildStoreModeQueueStorageKey({
  activeShoppingDate,
  familyId,
}: {
  activeShoppingDate: string;
  familyId: string;
}) {
  return `${STORE_MODE_QUEUE_KEY_PREFIX}:${familyId}:${activeShoppingDate}`;
}

export function readStoreModeToggleQueue(storageKey: string): StoreModeToggleOp[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isStoreModeToggleOp);
  } catch {
    return [];
  }
}

export function writeStoreModeToggleQueue(
  storageKey: string,
  queue: StoreModeToggleOp[],
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (queue.length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(queue));
  } catch {
    // Private mode or quota exceeded — in-session optimistic state still works.
  }
}

export function upsertToggleOp(
  queue: StoreModeToggleOp[],
  op: StoreModeToggleOp,
): StoreModeToggleOp[] {
  const withoutExisting = queue.filter((entry) => entry.sourceKey !== op.sourceKey);
  return [...withoutExisting, op];
}

export function removeToggleOp(queue: StoreModeToggleOp[], sourceKey: string) {
  return queue.filter((entry) => entry.sourceKey !== sourceKey);
}

export function applyToggleOpsToItems<T extends StoreModeToggleItem>(
  items: T[],
  ops: StoreModeToggleOp[],
): T[] {
  if (ops.length === 0) {
    return items;
  }

  const opBySourceKey = new Map(ops.map((op) => [op.sourceKey, op]));

  return items.map((item) => {
    const op = opBySourceKey.get(item.sourceKey);

    if (!op) {
      return item;
    }

    return {
      ...item,
      checked: op.checked,
    };
  });
}

export function computeStoreModeProgress(
  items: Pick<StoreModeToggleItem, "checked">[],
): StoreModeProgress {
  return {
    checkedCount: items.filter((item) => item.checked).length,
    totalCount: items.length,
  };
}

export function areToggleQueuesEqual(
  left: StoreModeToggleOp[],
  right: StoreModeToggleOp[],
) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((op, index) => {
    const other = right[index];

    return (
      op.sourceKey === other.sourceKey &&
      op.sourceType === other.sourceType &&
      op.checked === other.checked &&
      op.expectedUpdatedAt === other.expectedUpdatedAt &&
      (op.mealPlanId ?? null) === (other.mealPlanId ?? null)
    );
  });
}

export function reconcileToggleQueue({
  loaderItems,
  queue,
}: {
  loaderItems: StoreModeToggleItem[];
  queue: StoreModeToggleOp[];
}): StoreModeToggleOp[] {
  if (queue.length === 0) {
    return queue;
  }

  const loaderBySourceKey = new Map(
    loaderItems.map((item) => [item.sourceKey, item]),
  );

  return queue.filter((op) => {
    const loaderItem = loaderBySourceKey.get(op.sourceKey);

    if (!loaderItem) {
      // Family items leave the store-mode loader once checked (only unchecked
      // items are loaded). Drop fulfilled check ops; keep uncheck ops pending.
      return !op.checked;
    }

    return loaderItem.checked !== op.checked;
  });
}

export function getToggleExpectedVersion(item: {
  collaborationVersion: string;
  overrideVersion?: string;
  sourceType: StoreModeItemSource;
}) {
  if (item.sourceType === ShoppingItemSource.MANUAL) {
    return item.overrideVersion ?? "";
  }

  return item.collaborationVersion;
}

function isStoreModeToggleOp(value: unknown): value is StoreModeToggleOp {
  if (!value || typeof value !== "object") {
    return false;
  }

  const op = value as Partial<StoreModeToggleOp>;

  return (
    typeof op.sourceKey === "string" &&
    op.sourceKey.length > 0 &&
    (op.sourceType === ShoppingItemSource.GENERATED ||
      op.sourceType === ShoppingItemSource.MANUAL ||
      op.sourceType === "FAMILY") &&
    typeof op.checked === "boolean" &&
    typeof op.expectedUpdatedAt === "string"
  );
}
