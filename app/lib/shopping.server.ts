import { MealType, Prisma, ShoppingItemSource } from "@prisma/client";

import { db } from "./db.server";
import { requireFamilyMembership } from "./family.server";
import { getMealPlanDateRange } from "./meal-plan.server";

const storeSummarySelect = Prisma.validator<Prisma.StoreSelect>()({
  id: true,
  name: true,
});

const categorySummarySelect =
  Prisma.validator<Prisma.IngredientCategorySelect>()({
    displayName: true,
    id: true,
  });

const generatedShoppingRecipeIngredientSelect =
  Prisma.validator<Prisma.RecipeIngredientSelect>()({
    amount: true,
    category: {
      select: categorySummarySelect,
    },
    categoryId: true,
    displayName: true,
    id: true,
    ingredientId: true,
    preferredStore: {
      select: storeSummarySelect,
    },
    preferredStoreId: true,
    sortOrder: true,
    unit: true,
  });

const generatedShoppingRecipeSelect = Prisma.validator<Prisma.RecipeSelect>()({
  id: true,
  ingredients: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: generatedShoppingRecipeIngredientSelect,
  },
  title: true,
});

const generatedShoppingMealPlanEntrySelect =
  Prisma.validator<Prisma.MealPlanEntrySelect>()({
    date: true,
    id: true,
    mealType: true,
    recipe: {
      select: generatedShoppingRecipeSelect,
    },
    recipeId: true,
  });

const shoppingOverrideSelect =
  Prisma.validator<Prisma.ShoppingItemOverrideSelect>()({
    checked: true,
    note: true,
    postponedUntilDate: true,
    preferredStore: {
      select: storeSummarySelect,
    },
    preferredStoreId: true,
    sourceKey: true,
    sourceType: true,
  });

const manualShoppingItemSelect =
  Prisma.validator<Prisma.ManualShoppingItemSelect>()({
    buyOnDate: true,
    category: {
      select: categorySummarySelect,
    },
    categoryId: true,
    id: true,
    name: true,
    note: true,
    preferredStore: {
      select: storeSummarySelect,
    },
    preferredStoreId: true,
    quantity: true,
  });

const shoppingMealPlanSelect = Prisma.validator<Prisma.MealPlanSelect>()({
  activeShoppingDate: true,
  endDate: true,
  entries: {
    orderBy: [{ date: "asc" }, { id: "asc" }],
    select: generatedShoppingMealPlanEntrySelect,
    where: {
      mealType: MealType.DINNER,
    },
  },
  id: true,
  manualShoppingItems: {
    orderBy: [{ buyOnDate: "asc" }, { id: "asc" }],
    select: manualShoppingItemSelect,
  },
  shoppingOverrides: {
    orderBy: [{ sourceType: "asc" }, { sourceKey: "asc" }],
    select: shoppingOverrideSelect,
  },
  startDate: true,
  status: true,
  title: true,
});

const shoppingStoreSelect = Prisma.validator<Prisma.StoreSelect>()({
  familyId: true,
  id: true,
  name: true,
  sections: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      categoryId: true,
      displayName: true,
      id: true,
      sortOrder: true,
    },
  },
});

const shoppingCategorySelect =
  Prisma.validator<Prisma.IngredientCategorySelect>()({
    displayName: true,
    id: true,
  });

type ShoppingMealPlan = Prisma.MealPlanGetPayload<{
  select: typeof shoppingMealPlanSelect;
}>;
type ShoppingStore = Prisma.StoreGetPayload<{
  select: typeof shoppingStoreSelect;
}>;
type ShoppingOverride = Prisma.ShoppingItemOverrideGetPayload<{
  select: typeof shoppingOverrideSelect;
}>;

type StoreSummary = {
  id: string;
  name: string;
} | null;

type StoreSectionSummary = {
  displayName: string;
  sortOrder: number;
};

interface GeneratedProjectionBucket {
  amount: string | null;
  category: {
    id: string;
    name: string;
  };
  name: string;
  occurrences: ProjectedShoppingOccurrence[];
  occurrenceKeys: string[];
  preferredStore: StoreSummary;
  sortAnchor: {
    date: Date;
    ingredientSortOrder: number;
    recipeTitle: string;
  };
  unit: string | null;
}

interface ProjectedShoppingItemBase {
  category: {
    id: string;
    name: string;
  };
  checked: boolean;
  name: string;
  note: string | null;
  preferredStore: StoreSummary;
  quantityLabel: string | null;
  section: StoreSectionSummary;
  sourceKey: string;
  sourceType: ShoppingItemSource;
}

export interface ProjectedShoppingOccurrence {
  date: Date;
  mealPlanEntryId: string;
  recipeId: string;
  recipeIngredientId: string;
  recipeTitle: string;
}

export interface ProjectedGeneratedShoppingItem extends ProjectedShoppingItemBase {
  amount: string | null;
  firstDate: Date;
  lastDate: Date;
  occurrenceCount: number;
  occurrences: ProjectedShoppingOccurrence[];
  postponedUntilDate: Date | null;
  sourceType: "GENERATED";
  unit: string | null;
}

export interface ProjectedManualShoppingItem extends ProjectedShoppingItemBase {
  buyOnDate: Date | null;
  quantity: string | null;
  sourceType: "MANUAL";
}

export type ProjectedShoppingItem =
  | ProjectedGeneratedShoppingItem
  | ProjectedManualShoppingItem;

export interface ProjectedShoppingSectionGroup {
  category: {
    id: string;
    name: string;
  };
  displayName: string;
  items: ProjectedShoppingItem[];
}

export interface ProjectedShoppingStoreGroup {
  sections: ProjectedShoppingSectionGroup[];
  store: StoreSummary;
}

export interface StoreModeProgress {
  checkedCount: number;
  totalCount: number;
}

export async function getMealPlanShoppingData({
  familyId,
  mealPlanId,
  userId,
}: {
  familyId: string;
  mealPlanId: string;
  userId: string;
}) {
  const membership = await requireFamilyMembership({
    familyId,
    userId,
  });

  const mealPlan = await db.mealPlan.findFirst({
    select: shoppingMealPlanSelect,
    where: {
      familyId,
      id: mealPlanId,
    },
  });

  if (!mealPlan) {
    throw new Response("Fant ikke ukeplanen.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  const [stores, categories] = await Promise.all([
    db.store.findMany({
      orderBy: [{ name: "asc" }],
      select: shoppingStoreSelect,
      where: {
        OR: [{ familyId: null }, { familyId }],
      },
    }),
    db.ingredientCategory.findMany({
      orderBy: [{ displayName: "asc" }],
      select: shoppingCategorySelect,
    }),
  ]);

  const generatedItems = projectGeneratedShoppingItems({
    mealPlan,
    stores,
  });
  const manualItems = projectManualShoppingItems({
    mealPlan,
    stores,
  });
  const projectedItems = [...generatedItems, ...manualItems].sort(
    compareProjectedItems,
  );

  return {
    categories,
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
    itemCounts: {
      generated: generatedItems.length,
      manual: manualItems.length,
      total: projectedItems.length,
    },
    mealPlan,
    projectedItems,
    storeGroups: buildProjectedStoreGroups(projectedItems),
    stores: stores.map((store) => ({
      id: store.id,
      name: store.name,
    })),
    userRole: membership.role,
    visibleDates: getMealPlanDateRange(mealPlan.startDate, mealPlan.endDate),
  };
}

export async function getMealPlanStoreModeData({
  familyId,
  mealPlanId,
  userId,
}: {
  familyId: string;
  mealPlanId: string;
  userId: string;
}) {
  const membership = await requireFamilyMembership({
    familyId,
    userId,
  });

  const [mealPlan, stores, selectedStorePreference] = await Promise.all([
    db.mealPlan.findFirst({
      select: shoppingMealPlanSelect,
      where: {
        familyId,
        id: mealPlanId,
      },
    }),
    db.store.findMany({
      orderBy: [{ name: "asc" }],
      select: shoppingStoreSelect,
      where: {
        OR: [{ familyId: null }, { familyId }],
      },
    }),
    db.userStorePreference.findUnique({
      select: {
        selectedStoreId: true,
      },
      where: {
        userId_familyId: {
          familyId,
          userId,
        },
      },
    }),
  ]);

  if (!mealPlan) {
    throw new Response("Fant ikke ukeplanen.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  const generatedItems = projectGeneratedShoppingItems({
    mealPlan,
    stores,
  });
  const manualItems = projectManualShoppingItems({
    mealPlan,
    stores,
  });
  const projectedItems = [...generatedItems, ...manualItems];
  const activeShoppingDate = mealPlan.activeShoppingDate ?? mealPlan.startDate;
  const selectedStore = resolveSelectedStoreSummary(
    stores,
    selectedStorePreference?.selectedStoreId ?? null,
  );
  const storeSectionsByStoreId = buildStoreSectionsByStoreId(stores);
  const dueItems = projectedItems
    .filter((item) => isProjectedItemDueBy(item, activeShoppingDate))
    .sort((left, right) =>
      compareProjectedItemsForStoreMode(
        left,
        right,
        selectedStore,
        storeSectionsByStoreId,
      ),
    );
  const laterItems = projectedItems
    .filter((item) => !isProjectedItemDueBy(item, activeShoppingDate))
    .sort(compareProjectedItemsByRelevantDate);

  return {
    activeShoppingDate,
    dueSectionGroups: buildStoreModeSectionGroups({
      items: dueItems,
      selectedStore,
      storeSectionsByStoreId,
    }),
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
    laterItems,
    mealPlan,
    progress: buildStoreModeProgress(dueItems),
    selectedStore,
    stores: stores.map((store) => ({
      id: store.id,
      name: store.name,
    })),
    userRole: membership.role,
    visibleDates: getMealPlanDateRange(mealPlan.startDate, mealPlan.endDate),
  };
}

function projectGeneratedShoppingItems({
  mealPlan,
  stores,
}: {
  mealPlan: ShoppingMealPlan;
  stores: ShoppingStore[];
}) {
  const storeSectionsByStoreId = buildStoreSectionsByStoreId(stores);
  const overrideBySourceKey = buildOverrideMap(
    mealPlan.shoppingOverrides,
    ShoppingItemSource.GENERATED,
  );
  const buckets = new Map<string, GeneratedProjectionBucket>();

  for (const entry of mealPlan.entries) {
    const recipe = entry.recipe;

    if (!recipe) {
      continue;
    }

    for (const ingredient of recipe.ingredients) {
      const occurrence: ProjectedShoppingOccurrence = {
        date: entry.date,
        mealPlanEntryId: entry.id,
        recipeId: recipe.id,
        recipeIngredientId: ingredient.id,
        recipeTitle: recipe.title,
      };
      const occurrenceKey = buildGeneratedOccurrenceKey({
        mealPlanEntryId: entry.id,
        recipeIngredientId: ingredient.id,
      });
      const mergeKey = buildGeneratedMergeKey({
        amount: ingredient.amount,
        categoryId: ingredient.categoryId,
        displayName: ingredient.displayName,
        ingredientId: ingredient.ingredientId,
        preferredStoreId: ingredient.preferredStoreId,
        unit: ingredient.unit,
      });
      const existingBucket = buckets.get(mergeKey);

      if (existingBucket) {
        existingBucket.occurrenceKeys.push(occurrenceKey);
        existingBucket.occurrences.push(occurrence);

        if (
          compareProjectionAnchors(existingBucket.sortAnchor, {
            date: entry.date,
            ingredientSortOrder: ingredient.sortOrder,
            recipeTitle: recipe.title,
          }) > 0
        ) {
          existingBucket.sortAnchor = {
            date: entry.date,
            ingredientSortOrder: ingredient.sortOrder,
            recipeTitle: recipe.title,
          };
        }

        continue;
      }

      buckets.set(mergeKey, {
        amount: ingredient.amount,
        category: {
          id: ingredient.category.id,
          name: ingredient.category.displayName,
        },
        name: ingredient.displayName,
        occurrences: [occurrence],
        occurrenceKeys: [occurrenceKey],
        preferredStore: ingredient.preferredStore,
        sortAnchor: {
          date: entry.date,
          ingredientSortOrder: ingredient.sortOrder,
          recipeTitle: recipe.title,
        },
        unit: ingredient.unit,
      });
    }
  }

  return [...buckets.values()].map((bucket) => {
    const sourceKey = buildMergedGeneratedSourceKey(bucket.occurrenceKeys);
    const override = overrideBySourceKey.get(sourceKey);
    const preferredStore = override?.preferredStore ?? bucket.preferredStore;
    const section = resolveStoreSection({
      category: bucket.category,
      preferredStore,
      storeSectionsByStoreId,
    });
    const occurrences = [...bucket.occurrences].sort(
      compareProjectedOccurrences,
    );

    return {
      amount: bucket.amount,
      category: bucket.category,
      checked: override?.checked ?? false,
      firstDate: occurrences[0]!.date,
      lastDate: occurrences[occurrences.length - 1]!.date,
      name: bucket.name,
      note: override?.note ?? null,
      occurrenceCount: occurrences.length,
      occurrences,
      postponedUntilDate: override?.postponedUntilDate ?? null,
      preferredStore,
      quantityLabel: buildQuantityLabel(bucket.amount, bucket.unit),
      section,
      sourceKey,
      sourceType: ShoppingItemSource.GENERATED,
      unit: bucket.unit,
    } satisfies ProjectedGeneratedShoppingItem;
  });
}

function projectManualShoppingItems({
  mealPlan,
  stores,
}: {
  mealPlan: ShoppingMealPlan;
  stores: ShoppingStore[];
}) {
  const storeSectionsByStoreId = buildStoreSectionsByStoreId(stores);
  const overrideBySourceKey = buildOverrideMap(
    mealPlan.shoppingOverrides,
    ShoppingItemSource.MANUAL,
  );

  return mealPlan.manualShoppingItems.map((item) => {
    const override = overrideBySourceKey.get(item.id);
    const preferredStore = item.preferredStore;
    const section = resolveStoreSection({
      category: {
        id: item.category.id,
        name: item.category.displayName,
      },
      preferredStore,
      storeSectionsByStoreId,
    });

    return {
      buyOnDate: item.buyOnDate,
      category: {
        id: item.category.id,
        name: item.category.displayName,
      },
      checked: override?.checked ?? false,
      name: item.name,
      note: item.note,
      preferredStore,
      quantity: item.quantity,
      quantityLabel: buildManualQuantityLabel(item.quantity),
      section,
      sourceKey: item.id,
      sourceType: ShoppingItemSource.MANUAL,
    } satisfies ProjectedManualShoppingItem;
  });
}

function buildProjectedStoreGroups(
  items: ProjectedShoppingItem[],
): ProjectedShoppingStoreGroup[] {
  const groupMap = new Map<
    string,
    {
      sections: Map<string, ProjectedShoppingSectionGroup>;
      store: StoreSummary;
    }
  >();

  for (const item of items) {
    const storeKey = item.preferredStore?.id ?? "__no-store__";
    const existingStoreGroup = groupMap.get(storeKey);

    if (!existingStoreGroup) {
      groupMap.set(storeKey, {
        sections: new Map(),
        store: item.preferredStore,
      });
    }

    const storeGroup = groupMap.get(storeKey)!;
    const sectionKey = `${item.category.id}:${item.section.displayName}`;
    const existingSection = storeGroup.sections.get(sectionKey);

    if (!existingSection) {
      storeGroup.sections.set(sectionKey, {
        category: item.category,
        displayName: item.section.displayName,
        items: [item],
      });

      continue;
    }

    existingSection.items.push(item);
  }

  return [...groupMap.values()]
    .map((group) => {
      const sections = [...group.sections.values()]
        .map((section) => ({
          ...section,
          items: [...section.items].sort(compareProjectedItems),
        }))
        .sort((left, right) => {
          const leftItem = left.items[0]!;
          const rightItem = right.items[0]!;

          if (leftItem.section.sortOrder !== rightItem.section.sortOrder) {
            return leftItem.section.sortOrder - rightItem.section.sortOrder;
          }

          return left.displayName.localeCompare(right.displayName, "nb");
        });

      return {
        sections,
        store: group.store,
      };
    })
    .sort((left, right) => compareStoreSummaries(left.store, right.store));
}

function buildStoreModeSectionGroups({
  items,
  selectedStore,
  storeSectionsByStoreId,
}: {
  items: ProjectedShoppingItem[];
  selectedStore: StoreSummary;
  storeSectionsByStoreId: Map<string, Map<string, StoreSectionSummary>>;
}) {
  const sectionMap = new Map<
    string,
    ProjectedShoppingSectionGroup & {
      sortOrder: number;
    }
  >();

  for (const item of items) {
    const section = resolveStoreSection({
      category: item.category,
      preferredStore: selectedStore,
      storeSectionsByStoreId,
    });
    const sectionKey = `${item.category.id}:${section.displayName}`;
    const existingSection = sectionMap.get(sectionKey);

    if (!existingSection) {
      sectionMap.set(sectionKey, {
        category: item.category,
        displayName: section.displayName,
        items: [item],
        sortOrder: section.sortOrder,
      });
      continue;
    }

    existingSection.items.push(item);
  }

  return [...sectionMap.values()]
    .map((section) => ({
      category: section.category,
      displayName: section.displayName,
      items: [...section.items],
      sortOrder: section.sortOrder,
    }))
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return left.displayName.localeCompare(right.displayName, "nb");
    })
    .map(({ sortOrder: _sortOrder, ...section }) => section);
}

function buildStoreModeProgress(items: ProjectedShoppingItem[]): StoreModeProgress {
  return {
    checkedCount: items.filter((item) => item.checked).length,
    totalCount: items.length,
  };
}

function buildStoreSectionsByStoreId(stores: ShoppingStore[]) {
  return new Map(
    stores.map((store) => [
      store.id,
      new Map(
        store.sections.map((section) => [
          section.categoryId,
          {
            displayName: section.displayName,
            sortOrder: section.sortOrder,
          },
        ]),
      ),
    ]),
  );
}

function buildOverrideMap(
  overrides: ShoppingOverride[],
  sourceType: ShoppingItemSource,
) {
  return new Map(
    overrides
      .filter((override) => override.sourceType === sourceType)
      .map((override) => [override.sourceKey, override]),
  );
}

function buildGeneratedOccurrenceKey({
  mealPlanEntryId,
  recipeIngredientId,
}: {
  mealPlanEntryId: string;
  recipeIngredientId: string;
}) {
  return `${mealPlanEntryId}:${recipeIngredientId}`;
}

function buildMergedGeneratedSourceKey(occurrenceKeys: string[]) {
  return occurrenceKeys.slice().sort().join("|");
}

function buildGeneratedMergeKey({
  amount,
  categoryId,
  displayName,
  ingredientId,
  preferredStoreId,
  unit,
}: {
  amount: string | null;
  categoryId: string;
  displayName: string;
  ingredientId: string | null;
  preferredStoreId: string | null;
  unit: string | null;
}) {
  return JSON.stringify({
    amount: amount ?? null,
    categoryId,
    displayName: ingredientId ? null : displayName,
    ingredientId,
    preferredStoreId: preferredStoreId ?? null,
    unit: unit ?? null,
  });
}

function resolveStoreSection({
  category,
  preferredStore,
  storeSectionsByStoreId,
}: {
  category: {
    id: string;
    name: string;
  };
  preferredStore: StoreSummary;
  storeSectionsByStoreId: Map<string, Map<string, StoreSectionSummary>>;
}) {
  if (!preferredStore) {
    return {
      displayName: category.name,
      sortOrder: Number.MAX_SAFE_INTEGER,
    };
  }

  const storeSections = storeSectionsByStoreId.get(preferredStore.id);
  const section = storeSections?.get(category.id);

  if (!section) {
    return {
      displayName: category.name,
      sortOrder: Number.MAX_SAFE_INTEGER,
    };
  }

  return section;
}

function resolveSelectedStoreSummary(
  stores: ShoppingStore[],
  selectedStoreId: string | null,
): StoreSummary {
  if (selectedStoreId) {
    const matchingStore = stores.find((store) => store.id === selectedStoreId);

    if (matchingStore) {
      return {
        id: matchingStore.id,
        name: matchingStore.name,
      };
    }
  }

  const fallbackStore = stores[0];

  if (!fallbackStore) {
    return null;
  }

  return {
    id: fallbackStore.id,
    name: fallbackStore.name,
  };
}

function isProjectedItemDueBy(item: ProjectedShoppingItem, activeShoppingDate: Date) {
  const relevantDate = getProjectedItemRelevantDate(item);

  if (!relevantDate) {
    return true;
  }

  return relevantDate.getTime() <= activeShoppingDate.getTime();
}

function getProjectedItemRelevantDate(item: ProjectedShoppingItem) {
  if (item.sourceType === "GENERATED") {
    return item.postponedUntilDate ?? item.firstDate;
  }

  return item.buyOnDate;
}

function buildQuantityLabel(amount: string | null, unit: string | null) {
  const parts = [amount, unit].filter(
    (value) => value && value.trim().length > 0,
  );

  return parts.length ? parts.join(" ") : null;
}

function buildManualQuantityLabel(quantity: string | null) {
  const trimmedQuantity = quantity?.trim() ?? "";

  return trimmedQuantity.length > 0 ? trimmedQuantity : null;
}

function compareProjectedOccurrences(
  left: ProjectedShoppingOccurrence,
  right: ProjectedShoppingOccurrence,
) {
  if (left.date.getTime() !== right.date.getTime()) {
    return left.date.getTime() - right.date.getTime();
  }

  const recipeTitleComparison = left.recipeTitle.localeCompare(
    right.recipeTitle,
    "nb",
  );

  if (recipeTitleComparison !== 0) {
    return recipeTitleComparison;
  }

  return left.recipeIngredientId.localeCompare(right.recipeIngredientId, "nb");
}

function compareProjectionAnchors(
  left: { date: Date; ingredientSortOrder: number; recipeTitle: string },
  right: { date: Date; ingredientSortOrder: number; recipeTitle: string },
) {
  if (left.date.getTime() !== right.date.getTime()) {
    return left.date.getTime() - right.date.getTime();
  }

  if (left.ingredientSortOrder !== right.ingredientSortOrder) {
    return left.ingredientSortOrder - right.ingredientSortOrder;
  }

  return left.recipeTitle.localeCompare(right.recipeTitle, "nb");
}

function compareStoreSummaries(left: StoreSummary, right: StoreSummary) {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return left.name.localeCompare(right.name, "nb");
}

function compareProjectedItems(
  left: ProjectedShoppingItem,
  right: ProjectedShoppingItem,
) {
  const storeComparison = compareStoreSummaries(
    left.preferredStore,
    right.preferredStore,
  );

  if (storeComparison !== 0) {
    return storeComparison;
  }

  if (left.section.sortOrder !== right.section.sortOrder) {
    return left.section.sortOrder - right.section.sortOrder;
  }

  const sectionComparison = left.section.displayName.localeCompare(
    right.section.displayName,
    "nb",
  );

  if (sectionComparison !== 0) {
    return sectionComparison;
  }

  const leftSortTimestamp = getProjectedItemSortTimestamp(left);
  const rightSortTimestamp = getProjectedItemSortTimestamp(right);

  if (leftSortTimestamp !== rightSortTimestamp) {
    return leftSortTimestamp - rightSortTimestamp;
  }

  const nameComparison = left.name.localeCompare(right.name, "nb");

  if (nameComparison !== 0) {
    return nameComparison;
  }

  return left.sourceKey.localeCompare(right.sourceKey, "nb");
}

function compareProjectedItemsForStoreMode(
  left: ProjectedShoppingItem,
  right: ProjectedShoppingItem,
  selectedStore: StoreSummary,
  storeSectionsByStoreId: Map<string, Map<string, StoreSectionSummary>>,
) {
  const leftSection = resolveStoreSection({
    category: left.category,
    preferredStore: selectedStore,
    storeSectionsByStoreId,
  });
  const rightSection = resolveStoreSection({
    category: right.category,
    preferredStore: selectedStore,
    storeSectionsByStoreId,
  });

  if (leftSection.sortOrder !== rightSection.sortOrder) {
    return leftSection.sortOrder - rightSection.sortOrder;
  }

  const sectionComparison = leftSection.displayName.localeCompare(
    rightSection.displayName,
    "nb",
  );

  if (sectionComparison !== 0) {
    return sectionComparison;
  }

  const leftRelevantTimestamp = getProjectedItemRelevantTimestamp(left);
  const rightRelevantTimestamp = getProjectedItemRelevantTimestamp(right);

  if (leftRelevantTimestamp !== rightRelevantTimestamp) {
    return leftRelevantTimestamp - rightRelevantTimestamp;
  }

  const leftPreferredStoreComparison = compareStoreSummaries(
    left.preferredStore,
    right.preferredStore,
  );

  if (leftPreferredStoreComparison !== 0) {
    return leftPreferredStoreComparison;
  }

  const nameComparison = left.name.localeCompare(right.name, "nb");

  if (nameComparison !== 0) {
    return nameComparison;
  }

  return left.sourceKey.localeCompare(right.sourceKey, "nb");
}

function compareProjectedItemsByRelevantDate(
  left: ProjectedShoppingItem,
  right: ProjectedShoppingItem,
) {
  const leftRelevantTimestamp = getProjectedItemRelevantTimestamp(left);
  const rightRelevantTimestamp = getProjectedItemRelevantTimestamp(right);

  if (leftRelevantTimestamp !== rightRelevantTimestamp) {
    return leftRelevantTimestamp - rightRelevantTimestamp;
  }

  const nameComparison = left.name.localeCompare(right.name, "nb");

  if (nameComparison !== 0) {
    return nameComparison;
  }

  return left.sourceKey.localeCompare(right.sourceKey, "nb");
}

function getProjectedItemSortTimestamp(item: ProjectedShoppingItem) {
  if (item.sourceType === "GENERATED") {
    return item.firstDate.getTime();
  }

  return item.buyOnDate ? item.buyOnDate.getTime() : Number.MIN_SAFE_INTEGER;
}

function getProjectedItemRelevantTimestamp(item: ProjectedShoppingItem) {
  return getProjectedItemRelevantDate(item)?.getTime() ?? Number.MIN_SAFE_INTEGER;
}
