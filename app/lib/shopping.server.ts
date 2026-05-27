import { MealType, Prisma, ShoppingItemSource } from "@prisma/client";

import { db } from "./db.server";
import { requireFamilyMembership } from "./family.server";
import { normalizeIngredientCanonicalName } from "./ingredient-normalize";
import { getMealPlanDateRange } from "./meal-plan.server";
import {
  getFamilyStockMatchSet,
  isStockIngredientMatch,
  type FamilyStockMatchSet,
} from "./stock.server";

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
    excludedFromList: true,
    id: true,
    includeDespiteStock: true,
    note: true,
    postponedUntilDate: true,
    preferredStore: {
      select: storeSummarySelect,
    },
    preferredStoreId: true,
    sourceKey: true,
    sourceType: true,
    updatedAt: true,
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
    updatedAt: true,
  });

const familyShoppingItemSelect =
  Prisma.validator<Prisma.FamilyShoppingItemSelect>()({
    category: {
      select: categorySummarySelect,
    },
    categoryId: true,
    checked: true,
    id: true,
    name: true,
    note: true,
    preferredStore: {
      select: storeSummarySelect,
    },
    preferredStoreId: true,
    quantity: true,
    updatedAt: true,
  });

type FamilyShoppingItemRow = Prisma.FamilyShoppingItemGetPayload<{
  select: typeof familyShoppingItemSelect;
}>;

export const shoppingMealPlanSelect = Prisma.validator<Prisma.MealPlanSelect>()({
  activeShoppingDate: true,
  endDate: true,
  updatedAt: true,
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
  displayName: string;
  ingredientId: string | null;
  name: string;
  occurrences: ProjectedShoppingOccurrence[];
  occurrenceKeys: string[];
  preferredStore: StoreSummary;
  preferredStoreConflict: boolean;
  sortAnchor: {
    date: Date;
    ingredientSortOrder: number;
    recipeTitle: string;
  };
  unit: string | null;
}

export interface ProjectedStockIngredientSummary {
  category: {
    id: string;
    name: string;
  };
  isOptedIn: boolean;
  name: string;
  occurrenceCount: number;
  occurrences: ProjectedShoppingOccurrence[];
  quantityLabel: string | null;
  sourceKey: string;
}

interface ProjectedShoppingItemBase {
  category: {
    id: string;
    name: string;
  };
  checked: boolean;
  collaborationVersion: string;
  name: string;
  note: string | null;
  preferredStore: StoreSummary;
  quantityLabel: string | null;
  section: StoreSectionSummary;
  sourceKey: string;
  sourceType: ProjectedShoppingItemSource;
}

export type ProjectedShoppingItemSource = ShoppingItemSource | "FAMILY";

export interface ProjectedShoppingOccurrence {
  amount: string | null;
  date: Date;
  mealPlanEntryId: string;
  quantityLabel: string | null;
  recipeId: string;
  recipeIngredientId: string;
  recipeTitle: string;
  unit: string | null;
}

export interface ProjectedGeneratedShoppingItem extends ProjectedShoppingItemBase {
  amount: string | null;
  firstDate: Date;
  lastDate: Date;
  occurrenceCount: number;
  recipeCount: number;
  occurrences: ProjectedShoppingOccurrence[];
  postponedUntilDate: Date | null;
  preferredStoreConflict: boolean;
  sourceType: "GENERATED";
  unit: string | null;
}

export interface ProjectedManualShoppingItem extends ProjectedShoppingItemBase {
  buyOnDate: Date | null;
  overrideVersion: string;
  quantity: string | null;
  sourceType: "MANUAL";
}

export interface ProjectedFamilyShoppingItem extends ProjectedShoppingItemBase {
  quantity: string | null;
  sourceType: "FAMILY";
}

export type ProjectedShoppingItem =
  | ProjectedGeneratedShoppingItem
  | ProjectedManualShoppingItem
  | ProjectedFamilyShoppingItem;

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

export async function loadShoppingMealPlan({
  familyId,
  mealPlanId,
}: {
  familyId: string;
  mealPlanId: string;
}) {
  return db.mealPlan.findFirst({
    select: shoppingMealPlanSelect,
    where: {
      familyId,
      id: mealPlanId,
    },
  });
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

  const mealPlan = await loadShoppingMealPlan({
    familyId,
    mealPlanId,
  });

  if (!mealPlan) {
    throw new Response("Fant ikke ukeplanen.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  const [stores, categories, stockMatchSet] = await Promise.all([
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
    getFamilyStockMatchSet(familyId),
  ]);

  const includeDespiteStockKeys = buildIncludeDespiteStockKeys(
    mealPlan.shoppingOverrides,
  );
  const generatedItems = projectGeneratedShoppingItems({
    includeDespiteStockKeys,
    mealPlan,
    stockMatchSet,
    stores,
  });
  const stockIngredientsForPlan = getStockIngredientsForMealPlan({
    includeDespiteStockKeys,
    mealPlan,
    stockMatchSet,
  });
  const manualItems = projectManualShoppingItems({
    mealPlan,
    stores,
  });
  const excludedGeneratedItems = projectExcludedGeneratedShoppingItems({
    mealPlan,
    stores,
  });
  const projectedItems = [...generatedItems, ...manualItems].sort(
    compareProjectedItems,
  );
  const uncheckedFamilyItems = await loadFamilyShoppingItems({
    checked: false,
    familyId,
  });
  const familyProjectedItems = projectFamilyShoppingItems({
    items: uncheckedFamilyItems,
    stores,
  });

  return {
    categories,
    excludedGeneratedCount: excludedGeneratedItems.length,
    excludedGeneratedItems,
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
    familyStoreGroups: buildProjectedStoreGroups(familyProjectedItems),
    itemCounts: {
      family: familyProjectedItems.length,
      generated: generatedItems.length,
      manual: manualItems.length,
      total: projectedItems.length + familyProjectedItems.length,
    },
    mealPlan,
    projectedItems,
    stockIngredientCount: stockIngredientsForPlan.length,
    stockIngredientsForPlan,
    storeGroups: buildProjectedStoreGroups(projectedItems),
    stores: stores.map((store) => ({
      id: store.id,
      name: store.name,
    })),
    userRole: membership.role,
    visibleDates: getMealPlanDateRange(mealPlan.startDate, mealPlan.endDate),
  };
}

export const RECENT_MANUAL_SHOPPING_ITEM_LIMIT = 10;

export interface RecentManualShoppingItem {
  categoryId: string;
  displayName: string;
  nameNormalized: string;
  quantity: string;
}

export async function listRecentManualShoppingItemsForFamily({
  familyId,
  limit = RECENT_MANUAL_SHOPPING_ITEM_LIMIT,
}: {
  familyId: string;
  limit?: number;
}) {
  const [manualRows, familyRows] = await Promise.all([
    db.manualShoppingItem.findMany({
      orderBy: [{ updatedAt: "desc" }],
      select: {
        categoryId: true,
        name: true,
        quantity: true,
        updatedAt: true,
      },
      take: 100,
      where: {
        mealPlan: {
          familyId,
        },
      },
    }),
    db.familyShoppingItem.findMany({
      orderBy: [{ updatedAt: "desc" }],
      select: {
        categoryId: true,
        name: true,
        quantity: true,
        updatedAt: true,
      },
      take: 100,
      where: {
        familyId,
      },
    }),
  ]);

  const rows = [...manualRows, ...familyRows].sort(
    (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
  );

  const seen = new Set<string>();
  const recentItems: RecentManualShoppingItem[] = [];

  for (const row of rows) {
    const displayName = row.name.trim();

    if (!displayName) {
      continue;
    }

    const nameNormalized = normalizeIngredientCanonicalName(displayName);

    if (seen.has(nameNormalized)) {
      continue;
    }

    seen.add(nameNormalized);
    recentItems.push({
      categoryId: row.categoryId,
      displayName,
      nameNormalized,
      quantity: row.quantity?.trim() || "1",
    });

    if (recentItems.length >= limit) {
      break;
    }
  }

  return recentItems;
}

export async function loadFamilyShoppingItems({
  checked,
  familyId,
}: {
  checked?: boolean;
  familyId: string;
}) {
  return db.familyShoppingItem.findMany({
    orderBy: [{ checked: "asc" }, { updatedAt: "desc" }, { id: "asc" }],
    select: familyShoppingItemSelect,
    where: {
      familyId,
      ...(checked === undefined ? {} : { checked }),
    },
  });
}

export function projectFamilyShoppingItems({
  items,
  stores,
}: {
  items: FamilyShoppingItemRow[];
  stores: ShoppingStore[];
}) {
  const storeSectionsByStoreId = buildStoreSectionsByStoreId(stores);

  return items.map((item) => {
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
      category: {
        id: item.category.id,
        name: item.category.displayName,
      },
      checked: item.checked,
      collaborationVersion: item.updatedAt.toISOString(),
      name: item.name,
      note: item.note,
      preferredStore,
      quantity: item.quantity,
      quantityLabel: buildManualQuantityLabel(item.quantity),
      section,
      sourceKey: item.id,
      sourceType: "FAMILY",
    } satisfies ProjectedFamilyShoppingItem;
  });
}

export async function getFamilyShoppingData({
  familyId,
  userId,
}: {
  familyId: string;
  userId: string;
}) {
  const membership = await requireFamilyMembership({
    familyId,
    userId,
  });

  const [stores, categories, familyItems] = await Promise.all([
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
    loadFamilyShoppingItems({ familyId }),
  ]);

  const projectedItems = projectFamilyShoppingItems({
    items: familyItems,
    stores,
  }).sort(compareProjectedItems);

  return {
    categories,
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
    itemCounts: {
      checked: projectedItems.filter((item) => item.checked).length,
      total: projectedItems.length,
      unchecked: projectedItems.filter((item) => !item.checked).length,
    },
    projectedItems,
    storeGroups: buildProjectedStoreGroups(projectedItems),
    stores: stores.map((store) => ({
      id: store.id,
      name: store.name,
    })),
    userRole: membership.role,
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

  const [mealPlan, stores, selectedStorePreference, stockMatchSet] =
    await Promise.all([
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
      getFamilyStockMatchSet(familyId),
    ]);

  if (!mealPlan) {
    throw new Response("Fant ikke ukeplanen.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  const includeDespiteStockKeys = buildIncludeDespiteStockKeys(
    mealPlan.shoppingOverrides,
  );
  const generatedItems = projectGeneratedShoppingItems({
    includeDespiteStockKeys,
    mealPlan,
    stockMatchSet,
    stores,
  });
  const manualItems = projectManualShoppingItems({
    mealPlan,
    stores,
  });
  const stockIngredientsForPlan = getStockIngredientsForMealPlan({
    includeDespiteStockKeys,
    mealPlan,
    stockMatchSet,
  });
  const projectedItems = [...generatedItems, ...manualItems];
  const activeShoppingDate = mealPlan.activeShoppingDate ?? mealPlan.startDate;
  const selectedStore = resolveSelectedStoreSummary(
    stores,
    selectedStorePreference?.selectedStoreId ?? null,
  );
  const storeSectionsByStoreId = buildStoreSectionsByStoreId(stores);
  const todayAtUtcMidnight = getUtcToday();
  const dueItems = projectedItems
    .filter((item) =>
      isProjectedItemInStoreModeTrip(
        item,
        activeShoppingDate,
        mealPlan.endDate,
        todayAtUtcMidnight,
      ),
    )
    .sort((left, right) =>
      compareProjectedItemsForStoreMode(
        left,
        right,
        selectedStore,
        storeSectionsByStoreId,
      ),
    );
  const laterItems = projectedItems
    .filter((item) =>
      isProjectedItemBeforeShoppingDate(
        item,
        activeShoppingDate,
        todayAtUtcMidnight,
      ),
    )
    .sort(compareProjectedItemsByRelevantDate);
  const uncheckedFamilyItems = await loadFamilyShoppingItems({
    checked: false,
    familyId,
  });
  const familyDueItems = projectFamilyShoppingItems({
    items: uncheckedFamilyItems,
    stores,
  });
  const mergedDueItems = [...dueItems, ...familyDueItems].sort((left, right) =>
    compareProjectedItemsForStoreMode(
      left,
      right,
      selectedStore,
      storeSectionsByStoreId,
    ),
  );

  return {
    activeShoppingDate,
    dueSectionGroups: buildStoreModeSectionGroups({
      items: mergedDueItems,
      selectedStore,
      storeSectionsByStoreId,
    }),
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
    laterItems,
    mealPlan,
    progress: buildStoreModeProgress(mergedDueItems),
    selectedStore,
    stockIngredientCount: stockIngredientsForPlan.length,
    stockIngredientsForPlan,
    stores: stores.map((store) => ({
      id: store.id,
      name: store.name,
    })),
    userRole: membership.role,
    visibleDates: getMealPlanDateRange(mealPlan.startDate, mealPlan.endDate),
  };
}

export function getStockIngredientsForMealPlan({
  includeDespiteStockKeys,
  mealPlan,
  stockMatchSet,
}: {
  includeDespiteStockKeys: Set<string>;
  mealPlan: ShoppingMealPlan;
  stockMatchSet: FamilyStockMatchSet;
}) {
  const summaries: ProjectedStockIngredientSummary[] = [];

  for (const bucket of buildGeneratedProjectionBuckets(mealPlan)) {
    const sourceKey = buildMergedGeneratedSourceKey(bucket.occurrenceKeys);
    const isStock = isStockIngredientMatch(bucket, stockMatchSet);

    if (!isStock || hasIncludeDespiteStockKey(bucket, includeDespiteStockKeys)) {
      continue;
    }

    const occurrences = [...bucket.occurrences].sort(compareProjectedOccurrences);

    summaries.push({
      category: bucket.category,
      isOptedIn: false,
      name: bucket.name,
      occurrenceCount: occurrences.length,
      occurrences,
      quantityLabel: buildMergedQuantityLabel(occurrences),
      sourceKey,
    });
  }

  return summaries.sort((left, right) => left.name.localeCompare(right.name, "nb"));
}

function projectGeneratedShoppingItems({
  includeDespiteStockKeys,
  mealPlan,
  stockMatchSet,
  stores,
}: {
  includeDespiteStockKeys: Set<string>;
  mealPlan: ShoppingMealPlan;
  stockMatchSet: FamilyStockMatchSet;
  stores: ShoppingStore[];
}) {
  const overrideBySourceKey = buildOverrideMap(
    mealPlan.shoppingOverrides,
    ShoppingItemSource.GENERATED,
  );

  return buildGeneratedProjectionBuckets(mealPlan)
    .filter((bucket) => {
      const override = resolveGeneratedOverride(bucket, overrideBySourceKey);

      if (override?.excludedFromList) {
        return false;
      }

      const isStock = isStockIngredientMatch(bucket, stockMatchSet);

      return !isStock || hasIncludeDespiteStockKey(bucket, includeDespiteStockKeys);
    })
    .map((bucket) =>
      mapGeneratedProjectionBucketToItem({
        bucket,
        overrideBySourceKey,
        stores,
      }),
    );
}

function projectExcludedGeneratedShoppingItems({
  mealPlan,
  stores,
}: {
  mealPlan: ShoppingMealPlan;
  stores: ShoppingStore[];
}) {
  const overrideBySourceKey = buildOverrideMap(
    mealPlan.shoppingOverrides,
    ShoppingItemSource.GENERATED,
  );

  return buildGeneratedProjectionBuckets(mealPlan).flatMap((bucket) => {
    const override = resolveGeneratedOverride(bucket, overrideBySourceKey);

    if (!override?.excludedFromList) {
      return [];
    }

    return [
      mapGeneratedProjectionBucketToItem({
        bucket,
        overrideBySourceKey,
        stores,
      }),
    ];
  });
}

function mapGeneratedProjectionBucketToItem({
  bucket,
  overrideBySourceKey,
  stores,
}: {
  bucket: GeneratedProjectionBucket;
  overrideBySourceKey: Map<string, ShoppingOverride>;
  stores: ShoppingStore[];
}) {
  const storeSectionsByStoreId = buildStoreSectionsByStoreId(stores);
  const sourceKey = buildMergedGeneratedSourceKey(bucket.occurrenceKeys);
  const override = resolveGeneratedOverride(bucket, overrideBySourceKey);
  const preferredStore = override?.preferredStore ?? bucket.preferredStore;
  const section = resolveStoreSection({
    category: bucket.category,
    preferredStore,
    storeSectionsByStoreId,
  });
  const occurrences = [...bucket.occurrences].sort(compareProjectedOccurrences);
  const recipeIds = new Set(occurrences.map((occurrence) => occurrence.recipeId));

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
    recipeCount: recipeIds.size,
    collaborationVersion: override?.updatedAt?.toISOString() ?? "",
    postponedUntilDate: override?.postponedUntilDate ?? null,
    preferredStore,
    preferredStoreConflict: bucket.preferredStoreConflict,
    quantityLabel: buildMergedQuantityLabel(occurrences),
    section,
    sourceKey,
    sourceType: ShoppingItemSource.GENERATED,
    unit: bucket.unit,
  } satisfies ProjectedGeneratedShoppingItem;
}

function buildGeneratedProjectionBuckets(mealPlan: ShoppingMealPlan) {
  const buckets = new Map<string, GeneratedProjectionBucket>();

  for (const entry of mealPlan.entries) {
    const recipe = entry.recipe;

    if (!recipe) {
      continue;
    }

    for (const ingredient of recipe.ingredients) {
      const occurrence: ProjectedShoppingOccurrence = {
        amount: ingredient.amount,
        date: entry.date,
        mealPlanEntryId: entry.id,
        quantityLabel: buildQuantityLabel(ingredient.amount, ingredient.unit),
        recipeId: recipe.id,
        recipeIngredientId: ingredient.id,
        recipeTitle: recipe.title,
        unit: ingredient.unit,
      };
      const occurrenceKey = buildGeneratedOccurrenceKey({
        mealPlanEntryId: entry.id,
        recipeIngredientId: ingredient.id,
      });
      const mergeKey = buildGeneratedMergeKey({
        categoryId: ingredient.categoryId,
        displayName: ingredient.displayName,
        unit: ingredient.unit,
      });
      const existingBucket = buckets.get(mergeKey);
      const incomingStoreId = ingredient.preferredStoreId ?? null;

      if (existingBucket) {
        existingBucket.occurrenceKeys.push(occurrenceKey);
        existingBucket.occurrences.push(occurrence);

        const bucketStoreId = existingBucket.preferredStore?.id ?? null;

        if (incomingStoreId !== bucketStoreId) {
          existingBucket.preferredStoreConflict = true;
        }

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
        displayName: ingredient.displayName,
        ingredientId: ingredient.ingredientId,
        name: ingredient.displayName,
        occurrences: [occurrence],
        occurrenceKeys: [occurrenceKey],
        preferredStore: ingredient.preferredStore,
        preferredStoreConflict: false,
        sortAnchor: {
          date: entry.date,
          ingredientSortOrder: ingredient.sortOrder,
          recipeTitle: recipe.title,
        },
        unit: ingredient.unit,
      });
    }
  }

  return [...buckets.values()];
}

function buildIncludeDespiteStockKeys(overrides: ShoppingOverride[]) {
  return new Set(
    overrides
      .filter(
        (override) =>
          override.sourceType === ShoppingItemSource.GENERATED &&
          override.includeDespiteStock,
      )
      .map((override) => override.sourceKey),
  );
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
      collaborationVersion: item.updatedAt?.toISOString() ?? "",
      name: item.name,
      note: item.note,
      overrideVersion: override?.updatedAt?.toISOString() ?? "",
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
  categoryId,
  displayName,
  unit,
}: {
  categoryId: string;
  displayName: string;
  unit: string | null;
}) {
  return JSON.stringify({
    categoryId,
    displayName: normalizeIngredientCanonicalName(displayName),
    unit: unit?.trim() || null,
  });
}

function resolveGeneratedOverride(
  bucket: GeneratedProjectionBucket,
  overrideBySourceKey: Map<string, ShoppingOverride>,
) {
  const mergedKey = buildMergedGeneratedSourceKey(bucket.occurrenceKeys);
  const directOverride = overrideBySourceKey.get(mergedKey);

  if (directOverride) {
    return directOverride;
  }

  // Legacy overrides may still be keyed by a single occurrence before merge.
  let fallbackOverride: ShoppingOverride | undefined;

  for (const occurrenceKey of bucket.occurrenceKeys) {
    const candidate = overrideBySourceKey.get(occurrenceKey);

    if (!candidate) {
      continue;
    }

    if (
      !fallbackOverride ||
      candidate.updatedAt.getTime() > fallbackOverride.updatedAt.getTime()
    ) {
      fallbackOverride = candidate;
    }
  }

  return fallbackOverride;
}

function hasIncludeDespiteStockKey(
  bucket: GeneratedProjectionBucket,
  includeDespiteStockKeys: Set<string>,
) {
  const mergedKey = buildMergedGeneratedSourceKey(bucket.occurrenceKeys);

  if (includeDespiteStockKeys.has(mergedKey)) {
    return true;
  }

  return bucket.occurrenceKeys.some((occurrenceKey) =>
    includeDespiteStockKeys.has(occurrenceKey),
  );
}

function buildMergedQuantityLabel(occurrences: ProjectedShoppingOccurrence[]) {
  if (occurrences.length === 0) {
    return null;
  }

  if (occurrences.length === 1) {
    return occurrences[0]!.quantityLabel;
  }

  const summedLabel = buildSummedQuantityLabel(occurrences);

  if (summedLabel) {
    return summedLabel;
  }

  const labels = occurrences.map((occurrence) => occurrence.quantityLabel);
  const definedLabels = labels.filter(
    (label): label is string => label !== null,
  );

  if (definedLabels.length === 0) {
    return null;
  }

  const firstLabel = definedLabels[0]!;

  if (definedLabels.every((label) => label === firstLabel)) {
    return `${occurrences.length} × ${firstLabel}`;
  }

  return null;
}

function buildSummedQuantityLabel(occurrences: ProjectedShoppingOccurrence[]) {
  const unit = occurrences[0]?.unit?.trim() ?? "";

  if (!unit || !occurrences.every((occurrence) => (occurrence.unit?.trim() ?? "") === unit)) {
    return null;
  }

  let total = 0;

  for (const occurrence of occurrences) {
    const parsedAmount = parseIngredientAmount(occurrence.amount);

    if (parsedAmount === null) {
      return null;
    }

    total += parsedAmount;
  }

  return buildQuantityLabel(formatSummedAmount(total), unit);
}

function parseIngredientAmount(amount: string | null) {
  if (!amount) {
    return null;
  }

  const trimmed = amount.trim().replace(",", ".");

  if (!trimmed) {
    return null;
  }

  if (trimmed === "½" || trimmed === "1/2") {
    return 0.5;
  }

  if (trimmed === "¼" || trimmed === "1/4") {
    return 0.25;
  }

  if (trimmed === "¾" || trimmed === "3/4") {
    return 0.75;
  }

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) ? parsed : null;
}

function formatSummedAmount(total: number) {
  if (Number.isInteger(total)) {
    return String(total);
  }

  return String(total).replace(".", ",");
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

function getUtcToday(referenceDate = new Date()) {
  return new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
    ),
  );
}

function isProjectedItemPast(
  item: ProjectedShoppingItem,
  todayAtUtcMidnight: Date,
) {
  const relevantDate = getProjectedItemRelevantDate(item);

  if (!relevantDate) {
    return false;
  }

  return relevantDate.getTime() < todayAtUtcMidnight.getTime();
}

function isProjectedItemInStoreModeTrip(
  item: ProjectedShoppingItem,
  activeShoppingDate: Date,
  endDate: Date,
  todayAtUtcMidnight: Date,
) {
  if (isProjectedItemPast(item, todayAtUtcMidnight)) {
    return false;
  }

  const relevantDate = getProjectedItemRelevantDate(item);

  if (!relevantDate) {
    return true;
  }

  return (
    relevantDate.getTime() >= activeShoppingDate.getTime() &&
    relevantDate.getTime() <= endDate.getTime()
  );
}

function isProjectedItemBeforeShoppingDate(
  item: ProjectedShoppingItem,
  activeShoppingDate: Date,
  todayAtUtcMidnight: Date,
) {
  if (isProjectedItemPast(item, todayAtUtcMidnight)) {
    return false;
  }

  const relevantDate = getProjectedItemRelevantDate(item);

  if (!relevantDate) {
    return false;
  }

  return relevantDate.getTime() < activeShoppingDate.getTime();
}

function getProjectedItemRelevantDate(item: ProjectedShoppingItem) {
  if (item.sourceType === "FAMILY") {
    return null;
  }

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

  if (item.sourceType === "MANUAL") {
    return item.buyOnDate ? item.buyOnDate.getTime() : Number.MIN_SAFE_INTEGER;
  }

  return Number.MIN_SAFE_INTEGER;
}

function getProjectedItemRelevantTimestamp(item: ProjectedShoppingItem) {
  return getProjectedItemRelevantDate(item)?.getTime() ?? Number.MIN_SAFE_INTEGER;
}
