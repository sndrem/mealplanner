import { normalizeIngredientCanonicalName } from "./ingredient-normalize";

export const SHOPPING_GROCERY_GROUPING_VALUES = ["GROUPED", "SPLIT"] as const;

export type ShoppingGroceryGroupingValue =
  (typeof SHOPPING_GROCERY_GROUPING_VALUES)[number];

export const DEFAULT_SHOPPING_GROCERY_GROUPING: ShoppingGroceryGroupingValue =
  "GROUPED";

export interface ShoppingGroceryGroupingMember {
  checked: boolean;
  collaborationVersion: string;
  mealPlanId: string | null;
  quantity: string | null;
  quantityLabel: string | null;
  sourceKey: string;
}

export function isGroupedShoppingItem(item: unknown): item is {
  groupingMembers: ShoppingGroceryGroupingMember[];
} {
  if (!item || typeof item !== "object") {
    return false;
  }

  const groupingMembers = (item as { groupingMembers?: unknown }).groupingMembers;

  return Array.isArray(groupingMembers) && groupingMembers.length > 1;
}

export function buildShoppingGroceryGroupKey(item: {
  category: { id: string };
  mealPlanId?: string | null;
  name: string;
}) {
  return JSON.stringify({
    categoryId: item.category.id,
    mealPlanId: item.mealPlanId ?? null,
    name: normalizeIngredientCanonicalName(item.name),
  });
}

export interface GroupableGeneratedShoppingItem {
  category: { id: string };
  checked: boolean;
  collaborationVersion: string;
  firstDate: Date | string;
  groupingMembers?: ShoppingGroceryGroupingMember[];
  isStockItem?: boolean;
  lastDate: Date | string;
  mealPlanId?: string | null;
  name: string;
  note: string | null;
  occurrenceCount: number;
  occurrences: Array<{
    date: Date | string;
    quantityLabel: string | null;
    recipeId?: string;
    recipeTitle: string;
  }>;
  postponedUntilDate?: Date | string | null;
  preferredStore?: { id: string } | null;
  preferredStoreConflict?: boolean;
  quantity?: string | null;
  quantityLabel: string | null;
  recipeCount: number;
  sourceKey: string;
  sourceType: string;
}

export function groupGeneratedShoppingItemsForDisplay<
  T extends {
    category: { id: string };
    checked: boolean;
    collaborationVersion: string;
    mealPlanId?: string | null;
    name: string;
    quantity?: string | null;
    quantityLabel: string | null;
    sourceKey: string;
    sourceType: string;
  },
>(items: T[], grouping: ShoppingGroceryGroupingValue): T[] {
  if (grouping !== "GROUPED") {
    return items;
  }

  const generatedByKey = new Map<string, T[]>();

  for (const item of items) {
    if (item.sourceType !== "GENERATED") {
      continue;
    }

    const key = buildShoppingGroceryGroupKey(item);
    const existing = generatedByKey.get(key);

    if (existing) {
      existing.push(item);
      continue;
    }

    generatedByKey.set(key, [item]);
  }

  const emittedKeys = new Set<string>();
  const groupedItems: T[] = [];

  for (const item of items) {
    if (item.sourceType !== "GENERATED") {
      groupedItems.push(item);
      continue;
    }

    const key = buildShoppingGroceryGroupKey(item);

    if (emittedKeys.has(key)) {
      continue;
    }

    emittedKeys.add(key);
    const members = generatedByKey.get(key) ?? [item];
    groupedItems.push(
      members.length === 1
        ? members[0]!
        : foldGeneratedShoppingItems(
            members as Array<T & GroupableGeneratedShoppingItem>,
          ),
    );
  }

  return groupedItems;
}

function foldGeneratedShoppingItems<T extends GroupableGeneratedShoppingItem>(
  members: T[],
): T {
  const first = members[0]!;
  const occurrences = members
    .flatMap((member) => member.occurrences)
    .slice()
    .sort(compareGroupableOccurrences);
  const recipeIds = new Set(
    occurrences.map(
      (occurrence) => occurrence.recipeId ?? occurrence.recipeTitle,
    ),
  );
  const preferredStoreIds = new Set(
    members.map((member) => member.preferredStore?.id ?? ""),
  );
  const groupingMembers = members
    .map((member) => ({
      checked: member.checked,
      collaborationVersion: member.collaborationVersion,
      mealPlanId: member.mealPlanId ?? null,
      quantity: member.quantity ?? null,
      quantityLabel: member.quantityLabel,
      sourceKey: member.sourceKey,
    }))
    .sort((left, right) => left.sourceKey.localeCompare(right.sourceKey, "nb"));

  return {
    ...first,
    checked: members.every((member) => member.checked),
    firstDate: members.reduce(
      (earliest, member) =>
        toOccurrenceTime(member.firstDate) < toOccurrenceTime(earliest)
          ? member.firstDate
          : earliest,
      first.firstDate,
    ),
    groupingMembers,
    isStockItem: members.some((member) => member.isStockItem),
    lastDate: members.reduce(
      (latest, member) =>
        toOccurrenceTime(member.lastDate) > toOccurrenceTime(latest)
          ? member.lastDate
          : latest,
      first.lastDate,
    ),
    note: members.find((member) => member.note)?.note ?? null,
    occurrenceCount: occurrences.length,
    occurrences,
    postponedUntilDate:
      members.find((member) => member.postponedUntilDate)?.postponedUntilDate ??
      null,
    preferredStoreConflict:
      members.some((member) => member.preferredStoreConflict) ||
      preferredStoreIds.size > 1,
    quantity: null,
    quantityLabel: buildGroupedQuantityLabel(members),
    recipeCount: recipeIds.size,
    sourceKey: groupingMembers.map((member) => member.sourceKey).join("|"),
  };
}

function buildGroupedQuantityLabel(
  members: Array<{ quantityLabel: string | null }>,
) {
  const labels = members.map((member) => member.quantityLabel);
  const definedLabels = labels.filter(
    (label): label is string => label !== null && label.trim().length > 0,
  );

  if (definedLabels.length === 0 || definedLabels.length !== members.length) {
    return null;
  }

  const firstLabel = definedLabels[0]!;

  if (definedLabels.every((label) => label === firstLabel)) {
    return firstLabel;
  }

  return null;
}

function compareGroupableOccurrences(
  left: { date: Date | string; recipeTitle: string },
  right: { date: Date | string; recipeTitle: string },
) {
  const dateComparison = toOccurrenceTime(left.date) - toOccurrenceTime(right.date);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  return left.recipeTitle.localeCompare(right.recipeTitle, "nb");
}

function toOccurrenceTime(value: Date | string) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}
