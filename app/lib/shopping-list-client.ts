import { normalizeIngredientCanonicalName } from "./ingredient-normalize";
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

export const OPTIMISTIC_SOURCE_KEY_PREFIX = "optimistic:";

export type ShoppingItemDisplayPatch = {
  checked?: boolean;
  name?: string;
  note?: string | null;
  quantity?: string | null;
  quantityLabel?: string | null;
};

export function createOptimisticSourceKey() {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${OPTIMISTIC_SOURCE_KEY_PREFIX}${id}`;
}

export function isOptimisticSourceKey(sourceKey: string) {
  return sourceKey.startsWith(OPTIMISTIC_SOURCE_KEY_PREFIX);
}

export function getOptimisticChecked({
  checkedValue,
  isPending,
  itemChecked,
}: {
  checkedValue: FormDataEntryValue | null | undefined;
  isPending: boolean;
  itemChecked: boolean;
}) {
  if (!isPending || checkedValue == null) {
    return itemChecked;
  }

  return String(checkedValue) === "true";
}

export function removeProjectedItemFromStoreGroups(
  groups: SerializedProjectedShoppingStoreGroup[],
  sourceKey: string,
): SerializedProjectedShoppingStoreGroup[] {
  return groups
    .map((group) => ({
      ...group,
      sections: removeProjectedItemFromSectionGroups(group.sections, sourceKey),
    }))
    .filter((group) => group.sections.length > 0);
}

export function patchProjectedItemInSectionGroups(
  sections: SerializedProjectedShoppingSectionGroup[],
  sourceKey: string,
  patch: ShoppingItemDisplayPatch,
): SerializedProjectedShoppingSectionGroup[] {
  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) =>
      item.sourceKey === sourceKey ? { ...item, ...patch } : item,
    ),
  }));
}

export function patchProjectedItemInStoreGroups(
  groups: SerializedProjectedShoppingStoreGroup[],
  sourceKey: string,
  patch: ShoppingItemDisplayPatch,
): SerializedProjectedShoppingStoreGroup[] {
  return groups.map((group) => ({
    ...group,
    sections: patchProjectedItemInSectionGroups(group.sections, sourceKey, patch),
  }));
}

export function relocateProjectedItemInStoreGroups(
  groups: SerializedProjectedShoppingStoreGroup[],
  sourceKey: string,
  updatedItem: SerializedProjectedShoppingItem,
): SerializedProjectedShoppingStoreGroup[] {
  return insertProjectedItemIntoStoreGroups(
    removeProjectedItemFromStoreGroups(groups, sourceKey),
    updatedItem,
  );
}

export function filterStoreGroupsBySourceType(
  groups: SerializedProjectedShoppingStoreGroup[],
  sourceType: SerializedProjectedShoppingItem["sourceType"],
): SerializedProjectedShoppingStoreGroup[] {
  return groups
    .map((group) => ({
      ...group,
      sections: group.sections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => item.sourceType === sourceType),
        }))
        .filter((section) => section.items.length > 0),
    }))
    .filter((group) => group.sections.length > 0);
}

export function dropResolvedOptimisticItemsFromSectionGroups(
  sections: SerializedProjectedShoppingSectionGroup[],
  loaderItems: Array<{ name: string; sourceKey: string }>,
): SerializedProjectedShoppingSectionGroup[] {
  const loaderSourceKeys = new Set(loaderItems.map((item) => item.sourceKey));
  const loaderNames = new Set(
    loaderItems.map((item) => normalizeIngredientCanonicalName(item.name)),
  );

  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!isOptimisticSourceKey(item.sourceKey)) {
          return true;
        }

        return (
          !loaderSourceKeys.has(item.sourceKey) &&
          !loaderNames.has(normalizeIngredientCanonicalName(item.name))
        );
      }),
    }))
    .filter((section) => section.items.length > 0);
}

export function dropResolvedOptimisticItemsFromStoreGroups(
  groups: SerializedProjectedShoppingStoreGroup[],
  loaderItems: Array<{ name: string; sourceKey: string }>,
): SerializedProjectedShoppingStoreGroup[] {
  return groups
    .map((group) => ({
      ...group,
      sections: dropResolvedOptimisticItemsFromSectionGroups(
        group.sections,
        loaderItems,
      ),
    }))
    .filter((group) => group.sections.length > 0);
}

export function buildOptimisticManualShoppingItem({
  buyOnDate = null,
  category,
  mealPlanId = null,
  mealPlanTitle = null,
  name,
  note = null,
  preferredStore = null,
  quantity = null,
  section,
  sourceKey = createOptimisticSourceKey(),
  sourceType,
}: {
  buyOnDate?: string | null;
  category: { id: string; name: string };
  mealPlanId?: string | null;
  mealPlanTitle?: string | null;
  name: string;
  note?: string | null;
  preferredStore?: SerializedProjectedShoppingItem["preferredStore"];
  quantity?: string | null;
  section?: { displayName: string; sortOrder: number };
  sourceKey?: string;
  sourceType: "FAMILY" | "MANUAL";
}): SerializedProjectedShoppingItem {
  const trimmedQuantity = quantity?.trim() || null;
  const resolvedSection = section ?? {
    displayName: category.name,
    sortOrder: 99,
  };
  const base = {
    category,
    checked: false,
    collaborationVersion: "",
    mealPlanId,
    mealPlanTitle,
    name: name.trim(),
    note,
    preferredStore,
    quantity: trimmedQuantity,
    quantityLabel: trimmedQuantity,
    section: resolvedSection,
    sourceKey,
  };

  if (sourceType === "FAMILY") {
    return {
      ...base,
      sourceType: "FAMILY",
    };
  }

  return {
    ...base,
    buyOnDate,
    overrideVersion: "",
    sourceType: "MANUAL",
  };
}

export function findProjectedItemInStoreGroups(
  groups: SerializedProjectedShoppingStoreGroup[],
  sourceKey: string,
) {
  for (const group of groups) {
    for (const section of group.sections) {
      const item = section.items.find(
        (existingItem) => existingItem.sourceKey === sourceKey,
      );

      if (item) {
        return item;
      }
    }
  }

  return null;
}

function applyFormUpdateToShoppingItem({
  categories,
  formData,
  item,
  stores,
}: {
  categories: Array<{ displayName: string; id: string }>;
  formData: FormData;
  item: SerializedProjectedShoppingItem;
  stores: Array<{ id: string; name: string }>;
}): SerializedProjectedShoppingItem {
  const name = String(formData.get("name") ?? item.name).trim() || item.name;
  const quantity = String(formData.get("quantity") ?? item.quantity ?? "");
  const trimmedQuantity = quantity.trim() || null;
  const noteValue = formData.get("note");
  const note =
    noteValue == null ? item.note : String(noteValue).trim() || null;
  const categoryId = String(formData.get("categoryId") ?? item.category.id);
  const categoryName =
    categories.find((entry) => entry.id === categoryId)?.displayName ??
    item.category.name;
  const preferredStoreId = String(
    formData.get("preferredStoreId") ?? item.preferredStore?.id ?? "",
  );
  const preferredStore =
    preferredStoreId === ""
      ? null
      : (stores.find((store) => store.id === preferredStoreId) ??
        item.preferredStore);
  const buyOnDateValue = formData.get("buyOnDate");
  const postponedUntilDateValue = formData.get("postponedUntilDate");

  const nextItem = {
    ...item,
    category: {
      id: categoryId || item.category.id,
      name: categoryName,
    },
    name,
    note,
    preferredStore,
    quantity: trimmedQuantity,
    quantityLabel: trimmedQuantity,
    section: {
      ...item.section,
      displayName: categoryName,
    },
  };

  if (nextItem.sourceType === "MANUAL" && buyOnDateValue != null) {
    return {
      ...nextItem,
      buyOnDate: String(buyOnDateValue).trim() || null,
    };
  }

  if (nextItem.sourceType === "GENERATED" && postponedUntilDateValue != null) {
    return {
      ...nextItem,
      postponedUntilDate: String(postponedUntilDateValue).trim() || null,
    };
  }

  return nextItem;
}

export function applyOptimisticShoppingListFormOverlay({
  categories,
  formData,
  groups,
  intent,
  sourceKey,
  stores,
}: {
  categories: Array<{ displayName: string; id: string }>;
  formData: FormData;
  groups: SerializedProjectedShoppingStoreGroup[];
  intent: FormDataEntryValue | null | undefined;
  sourceKey: string | null;
  stores: Array<{ id: string; name: string }>;
}) {
  if (
    intent === "delete-family-shopping-item" ||
    intent === "delete-manual-shopping-item" ||
    intent === "exclude-generated-shopping-item"
  ) {
    if (!sourceKey) {
      return groups;
    }

    return removeProjectedItemFromStoreGroups(groups, sourceKey);
  }

  if (
    intent === "update-family-shopping-item" ||
    intent === "update-manual-shopping-item" ||
    intent === "update-generated-shopping-item"
  ) {
    if (!sourceKey) {
      return groups;
    }

    const currentItem = findProjectedItemInStoreGroups(groups, sourceKey);

    if (!currentItem) {
      return groups;
    }

    return relocateProjectedItemInStoreGroups(
      groups,
      sourceKey,
      applyFormUpdateToShoppingItem({
        categories,
        formData,
        item: currentItem,
        stores,
      }),
    );
  }

  return groups;
}
