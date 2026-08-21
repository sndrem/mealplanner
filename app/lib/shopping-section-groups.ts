export const DEFAULT_SHARED_STORE_NAME = "Rema 1000";

export interface SharedShoppingSnapshotItem {
  categoryId: string;
  categoryName: string;
  id: string;
  name: string;
  note: string | null;
  quantityLabel: string | null;
}

export interface SharedShoppingSnapshotStoreSection {
  categoryId: string;
  displayName: string;
  sortOrder: number;
}

export interface SharedShoppingSnapshotStore {
  id: string;
  name: string;
  sections: SharedShoppingSnapshotStoreSection[];
}

export interface SharedShoppingSnapshot {
  items: SharedShoppingSnapshotItem[];
  stores: SharedShoppingSnapshotStore[];
}

export interface SharedShoppingSectionGroup {
  category: {
    id: string;
    name: string;
  };
  displayName: string;
  items: SharedShoppingSnapshotItem[];
}

export function resolveDefaultSharedStoreId(
  stores: Array<{ id: string; name: string }>,
): string | null {
  if (stores.length === 0) {
    return null;
  }

  const rematch = stores.find(
    (store) =>
      store.name.trim().toLocaleLowerCase("nb") ===
      DEFAULT_SHARED_STORE_NAME.toLocaleLowerCase("nb"),
  );

  return rematch?.id ?? stores[0]?.id ?? null;
}

export function groupSharedShoppingItemsByStore({
  items,
  selectedStoreId,
  stores,
}: {
  items: SharedShoppingSnapshotItem[];
  selectedStoreId: string | null;
  stores: SharedShoppingSnapshotStore[];
}): SharedShoppingSectionGroup[] {
  const selectedStore =
    stores.find((store) => store.id === selectedStoreId) ?? null;
  const sectionsByCategoryId = new Map(
    (selectedStore?.sections ?? []).map((section) => [section.categoryId, section]),
  );
  const groups = new Map<
    string,
    SharedShoppingSectionGroup & { sortOrder: number }
  >();

  for (const item of items) {
    const section = sectionsByCategoryId.get(item.categoryId);
    const displayName = section?.displayName ?? item.categoryName;
    const sortOrder = section?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const groupKey = `${item.categoryId}:${displayName}`;
    const existing = groups.get(groupKey);

    if (existing) {
      existing.items.push(item);
      continue;
    }

    groups.set(groupKey, {
      category: {
        id: item.categoryId,
        name: item.categoryName,
      },
      displayName,
      items: [item],
      sortOrder,
    });
  }

  return [...groups.values()]
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return left.displayName.localeCompare(right.displayName, "nb");
    })
    .map(({ sortOrder: _sortOrder, ...group }) => group);
}
