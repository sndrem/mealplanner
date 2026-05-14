import { MealType, Prisma, ShoppingItemSource } from "@prisma/client";

import { db } from "./db.server";
import { requireFamilyMembership } from "./family.server";
import { getMealPlanDateRange } from "./meal-plan.server";

const generatedShoppingRecipeIngredientSelect = Prisma.validator<Prisma.RecipeIngredientSelect>()({
  amount: true,
  category: {
    select: {
      displayName: true,
      id: true,
    },
  },
  categoryId: true,
  displayName: true,
  id: true,
  ingredientId: true,
  preferredStore: {
    select: {
      id: true,
      name: true,
    },
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

const generatedShoppingMealPlanEntrySelect = Prisma.validator<Prisma.MealPlanEntrySelect>()({
  date: true,
  id: true,
  mealType: true,
  recipe: {
    select: generatedShoppingRecipeSelect,
  },
  recipeId: true,
});

const generatedShoppingOverrideSelect = Prisma.validator<Prisma.ShoppingItemOverrideSelect>()({
  checked: true,
  note: true,
  postponedUntilDate: true,
  preferredStore: {
    select: {
      id: true,
      name: true,
    },
  },
  preferredStoreId: true,
  sourceKey: true,
  sourceType: true,
});

const shoppingMealPlanSelect = Prisma.validator<Prisma.MealPlanSelect>()({
  endDate: true,
  entries: {
    orderBy: [{ date: "asc" }, { id: "asc" }],
    select: generatedShoppingMealPlanEntrySelect,
    where: {
      mealType: MealType.DINNER,
    },
  },
  id: true,
  shoppingOverrides: {
    orderBy: [{ sourceKey: "asc" }],
    select: generatedShoppingOverrideSelect,
    where: {
      sourceType: ShoppingItemSource.GENERATED,
    },
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

type ShoppingMealPlan = Prisma.MealPlanGetPayload<{
  select: typeof shoppingMealPlanSelect;
}>;
type ShoppingStore = Prisma.StoreGetPayload<{
  select: typeof shoppingStoreSelect;
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

export interface ProjectedShoppingOccurrence {
  date: Date;
  mealPlanEntryId: string;
  recipeId: string;
  recipeIngredientId: string;
  recipeTitle: string;
}

export interface ProjectedShoppingItem {
  amount: string | null;
  category: {
    id: string;
    name: string;
  };
  checked: boolean;
  firstDate: Date;
  lastDate: Date;
  name: string;
  note: string | null;
  occurrenceCount: number;
  occurrences: ProjectedShoppingOccurrence[];
  postponedUntilDate: Date | null;
  preferredStore: StoreSummary;
  quantityLabel: string | null;
  section: StoreSectionSummary;
  sourceKey: string;
  sourceType: "GENERATED";
  unit: string | null;
}

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

  const stores = await db.store.findMany({
    orderBy: [{ name: "asc" }],
    select: shoppingStoreSelect,
    where: {
      OR: [{ familyId: null }, { familyId }],
    },
  });

  const projectedItems = projectGeneratedShoppingItems({
    mealPlan,
    stores,
  });

  return {
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
    mealPlan,
    projectedItems,
    storeGroups: buildProjectedStoreGroups(projectedItems),
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
  const storeSectionsByStoreId = new Map(
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
  const overrideBySourceKey = new Map(
    mealPlan.shoppingOverrides.map((override) => [override.sourceKey, override]),
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

        if (compareProjectionAnchors(existingBucket.sortAnchor, {
          date: entry.date,
          ingredientSortOrder: ingredient.sortOrder,
          recipeTitle: recipe.title,
        }) > 0) {
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
          name: ingredient.category.displayName,
          id: ingredient.category.id,
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

  return [...buckets.values()]
    .map((bucket) => {
      const sourceKey = buildMergedGeneratedSourceKey(bucket.occurrenceKeys);
      const override = overrideBySourceKey.get(sourceKey);
      const preferredStore = override?.preferredStore ?? bucket.preferredStore;
      const section = resolveStoreSection({
        category: bucket.category,
        preferredStore,
        storeSectionsByStoreId,
      });
      const occurrences = [...bucket.occurrences].sort(compareProjectedOccurrences);

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
      } satisfies ProjectedShoppingItem;
    })
    .sort(compareProjectedItems);
}

function buildProjectedStoreGroups(items: ProjectedShoppingItem[]): ProjectedShoppingStoreGroup[] {
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

function buildQuantityLabel(amount: string | null, unit: string | null) {
  const parts = [amount, unit].filter((value) => value && value.trim().length > 0);

  return parts.length ? parts.join(" ") : null;
}

function compareProjectedOccurrences(left: ProjectedShoppingOccurrence, right: ProjectedShoppingOccurrence) {
  if (left.date.getTime() !== right.date.getTime()) {
    return left.date.getTime() - right.date.getTime();
  }

  const recipeTitleComparison = left.recipeTitle.localeCompare(right.recipeTitle, "nb");

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

function compareProjectedItems(left: ProjectedShoppingItem, right: ProjectedShoppingItem) {
  const storeComparison = compareStoreSummaries(left.preferredStore, right.preferredStore);

  if (storeComparison !== 0) {
    return storeComparison;
  }

  if (left.section.sortOrder !== right.section.sortOrder) {
    return left.section.sortOrder - right.section.sortOrder;
  }

  const sectionComparison = left.section.displayName.localeCompare(right.section.displayName, "nb");

  if (sectionComparison !== 0) {
    return sectionComparison;
  }

  if (left.firstDate.getTime() !== right.firstDate.getTime()) {
    return left.firstDate.getTime() - right.firstDate.getTime();
  }

  const nameComparison = left.name.localeCompare(right.name, "nb");

  if (nameComparison !== 0) {
    return nameComparison;
  }

  return left.sourceKey.localeCompare(right.sourceKey, "nb");
}
