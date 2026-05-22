import { ShoppingItemSource } from "@prisma/client";

export interface StoreModeToggleOp {
  checked: boolean;
  expectedUpdatedAt: string;
  sourceKey: string;
  sourceType: ShoppingItemSource;
}

export interface StoreModeToggleItem {
  checked: boolean;
  collaborationVersion: string;
  overrideVersion?: string;
  sourceKey: string;
  sourceType: ShoppingItemSource;
}

export interface StoreModeProgress {
  checkedCount: number;
  totalCount: number;
}

const STORE_MODE_QUEUE_KEY_PREFIX = "mealplanner:store-mode-queue:v1";

export function buildStoreModeQueueStorageKey({
  activeShoppingDate,
  familyId,
  mealPlanId,
}: {
  activeShoppingDate: string;
  familyId: string;
  mealPlanId: string;
}) {
  return `${STORE_MODE_QUEUE_KEY_PREFIX}:${familyId}:${mealPlanId}:${activeShoppingDate}`;
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
      op.expectedUpdatedAt === other.expectedUpdatedAt
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
      return true;
    }

    return loaderItem.checked !== op.checked;
  });
}

export function getToggleExpectedVersion(item: {
  collaborationVersion: string;
  overrideVersion?: string;
  sourceType: ShoppingItemSource;
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
      op.sourceType === ShoppingItemSource.MANUAL) &&
    typeof op.checked === "boolean" &&
    typeof op.expectedUpdatedAt === "string"
  );
}
