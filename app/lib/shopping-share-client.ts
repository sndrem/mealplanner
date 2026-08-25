const SHARE_CHECKS_KEY_PREFIX = "mealplanner:shopping-share-checks:v1";
const SHARE_STORE_KEY_PREFIX = "mealplanner:shopping-share-store:v1";

export function buildShoppingShareChecksStorageKey(token: string) {
  return `${SHARE_CHECKS_KEY_PREFIX}:${token}`;
}

export function buildShoppingShareStoreStorageKey(token: string) {
  return `${SHARE_STORE_KEY_PREFIX}:${token}`;
}

export function readShoppingShareCheckedIds(storageKey: string): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

export function writeShoppingShareCheckedIds(
  storageKey: string,
  checkedIds: string[],
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (checkedIds.length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(checkedIds));
  } catch {
    // Private mode or quota exceeded — in-session state still works.
  }
}

export function readShoppingShareSelectedStoreId(
  storageKey: string,
): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw || raw.trim().length === 0) {
      return null;
    }

    return raw;
  } catch {
    return null;
  }
}

export function writeShoppingShareSelectedStoreId(
  storageKey: string,
  storeId: string,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, storeId);
  } catch {
    // Private mode or quota exceeded — in-session state still works.
  }
}
