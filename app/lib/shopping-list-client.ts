import type { RecentManualShoppingItem } from "./shopping.server";
import type { SerializedProjectedShoppingItem } from "./shopping-serialize";

export interface SerializedProjectedShoppingSectionGroup {
  category: {
    id: string;
    name: string;
  };
  displayName: string;
  items: SerializedProjectedShoppingItem[];
}

export interface SerializedProjectedShoppingStoreGroup {
  sections: SerializedProjectedShoppingSectionGroup[];
  store: SerializedProjectedShoppingItem["preferredStore"];
}

function getStoreGroupKey(store: SerializedProjectedShoppingItem["preferredStore"]) {
  return store?.id ?? "__no-store__";
}

function getSectionKey(item: SerializedProjectedShoppingItem) {
  return `${item.category.id}:${item.section.displayName}`;
}

function compareSerializedItemsByName(
  left: SerializedProjectedShoppingItem,
  right: SerializedProjectedShoppingItem,
) {
  const nameComparison = left.name.localeCompare(right.name, "nb");

  if (nameComparison !== 0) {
    return nameComparison;
  }

  return left.sourceKey.localeCompare(right.sourceKey, "nb");
}

function appendItemToSection(
  section: SerializedProjectedShoppingSectionGroup,
  item: SerializedProjectedShoppingItem,
) {
  if (section.items.some((existingItem) => existingItem.sourceKey === item.sourceKey)) {
    return section;
  }

  return {
    ...section,
    items: [...section.items, item].sort(compareSerializedItemsByName),
  };
}

export function insertProjectedItemIntoStoreGroups(
  groups: SerializedProjectedShoppingStoreGroup[],
  item: SerializedProjectedShoppingItem,
): SerializedProjectedShoppingStoreGroup[] {
  const storeKey = getStoreGroupKey(item.preferredStore);
  const sectionKey = getSectionKey(item);
  const existingStoreGroupIndex = groups.findIndex(
    (group) => getStoreGroupKey(group.store) === storeKey,
  );

  if (existingStoreGroupIndex === -1) {
    return [
      ...groups,
      {
        store: item.preferredStore,
        sections: [
          {
            category: item.category,
            displayName: item.section.displayName,
            items: [item],
          },
        ],
      },
    ];
  }

  return groups.map((group, index) => {
    if (index !== existingStoreGroupIndex) {
      return group;
    }

    const existingSectionIndex = group.sections.findIndex(
      (section) =>
        `${section.category.id}:${section.displayName}` === sectionKey,
    );

    if (existingSectionIndex === -1) {
      return {
        ...group,
        sections: [
          ...group.sections,
          {
            category: item.category,
            displayName: item.section.displayName,
            items: [item],
          },
        ],
      };
    }

    return {
      ...group,
      sections: group.sections.map((section, sectionIndex) =>
        sectionIndex === existingSectionIndex
          ? appendItemToSection(section, item)
          : section,
      ),
    };
  });
}

export function removeProjectedItemFromSectionGroups(
  sections: SerializedProjectedShoppingSectionGroup[],
  sourceKey: string,
): SerializedProjectedShoppingSectionGroup[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((existingItem) => existingItem.sourceKey !== sourceKey),
    }))
    .filter((section) => section.items.length > 0);
}

export function relocateProjectedItemInSectionGroups(
  sections: SerializedProjectedShoppingSectionGroup[],
  sourceKey: string,
  updatedItem: SerializedProjectedShoppingItem,
): SerializedProjectedShoppingSectionGroup[] {
  return insertProjectedItemIntoSectionGroups(
    removeProjectedItemFromSectionGroups(sections, sourceKey),
    updatedItem,
  );
}

export function insertProjectedItemIntoSectionGroups(
  sections: SerializedProjectedShoppingSectionGroup[],
  item: SerializedProjectedShoppingItem,
): SerializedProjectedShoppingSectionGroup[] {
  const sectionKey = getSectionKey(item);
  const existingSectionIndex = sections.findIndex(
    (section) => `${section.category.id}:${section.displayName}` === sectionKey,
  );

  if (existingSectionIndex === -1) {
    return [
      ...sections,
      {
        category: item.category,
        displayName: item.section.displayName,
        items: [item],
      },
    ];
  }

  return sections.map((section, index) =>
    index === existingSectionIndex ? appendItemToSection(section, item) : section,
  );
}

export function prependRecentManualItem(
  recents: RecentManualShoppingItem[],
  recentManualItem: RecentManualShoppingItem,
  limit = 10,
): RecentManualShoppingItem[] {
  return [
    recentManualItem,
    ...recents.filter(
      (item) => item.nameNormalized !== recentManualItem.nameNormalized,
    ),
  ].slice(0, limit);
}

export function mergeQuickAddedItemsIntoList<T extends { sourceKey: string }>(
  loaderItems: T[],
  quickAddedItems: T[],
): T[] {
  const mergedItems = [...loaderItems];

  for (const item of quickAddedItems) {
    if (mergedItems.some((existingItem) => existingItem.sourceKey === item.sourceKey)) {
      continue;
    }

    mergedItems.push(item);
  }

  return mergedItems;
}
