import { Prisma, RecipeScope } from "@prisma/client";

import { db } from "./db.server";
import { requireFamilyMembership } from "./family.server";
import { getRecipeImageUrl } from "./r2.server";
import { listIngredientCategories } from "./store.server";

export const recipeIngredientSelect =
  Prisma.validator<Prisma.RecipeIngredientSelect>()({
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

export const managedRecipeSelect = Prisma.validator<Prisma.RecipeSelect>()({
  createdAt: true,
  defaultServings: true,
  description: true,
  familyId: true,
  id: true,
  imageKey: true,
  ingredients: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: recipeIngredientSelect,
  },
  prepMinutes: true,
  scope: true,
  tags: true,
  title: true,
  updatedAt: true,
});

export const recipeListSummarySelect = Prisma.validator<Prisma.RecipeSelect>()({
  defaultServings: true,
  description: true,
  familyId: true,
  id: true,
  imageKey: true,
  prepMinutes: true,
  scope: true,
  tags: true,
  title: true,
  updatedAt: true,
  _count: {
    select: {
      ingredients: true,
      mealPlanEntries: true,
    },
  },
});

export type ManagedRecipe = Prisma.RecipeGetPayload<{
  select: typeof managedRecipeSelect;
}>;

export type RecipeListSummary = Prisma.RecipeGetPayload<{
  select: typeof recipeListSummarySelect;
}>;

export async function listFamilyStoresForRecipes(familyId: string) {
  return db.store.findMany({
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
    },
    where: {
      familyId,
    },
  });
}

export async function getRecipeManagementData({
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
  const [categories, familyStores, familyRecipes, globalRecipes] = await Promise.all([
    listIngredientCategories(),
    listFamilyStoresForRecipes(familyId),
    db.recipe.findMany({
      orderBy: [{ title: "asc" }],
      select: recipeListSummarySelect,
      where: {
        familyId,
        scope: RecipeScope.FAMILY,
      },
    }),
    db.recipe.findMany({
      orderBy: [{ title: "asc" }],
      select: recipeListSummarySelect,
      where: {
        scope: RecipeScope.GLOBAL,
      },
    }),
  ]);

  return {
    categories,
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
    familyRecipes: familyRecipes.map(withRecipeImageUrl),
    familyStores,
    globalRecipes: globalRecipes.map(withRecipeImageUrl),
    userRole: membership.role,
  };
}

export async function getFamilyRecipeDetail({
  familyId,
  recipeId,
  userId,
}: {
  familyId: string;
  recipeId: string;
  userId: string;
}) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  const recipe = await db.recipe.findFirst({
    select: {
      ...managedRecipeSelect,
      _count: {
        select: {
          mealPlanEntries: true,
        },
      },
    },
    where: {
      familyId,
      id: recipeId,
      scope: RecipeScope.FAMILY,
    },
  });

  if (!recipe) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  const [categories, familyStores] = await Promise.all([
    listIngredientCategories(),
    listFamilyStoresForRecipes(familyId),
  ]);

  return {
    categories,
    familyStores,
    mealPlanEntryCount: recipe._count.mealPlanEntries,
    recipe: {
      createdAt: recipe.createdAt,
      defaultServings: recipe.defaultServings,
      description: recipe.description,
      familyId: recipe.familyId,
      id: recipe.id,
      imageUrl: getRecipeImageUrl(recipe.imageKey),
      ingredients: recipe.ingredients,
      prepMinutes: recipe.prepMinutes,
      scope: recipe.scope,
      tags: recipe.tags,
      title: recipe.title,
      updatedAt: recipe.updatedAt,
    },
    status: "FOUND" as const,
  };
}

function withRecipeImageUrl<T extends { imageKey: string | null }>(recipe: T) {
  const { imageKey, ...rest } = recipe;
  return {
    ...rest,
    imageUrl: getRecipeImageUrl(imageKey),
  };
}
