import { MealType } from "@prisma/client";

import { db } from "./db.server";
import { listFamilyFreezerItems } from "./freezer.server";
import { findMealPlanCoveringDate } from "./meal-plan-for-date.server";
import { formatDateOnly } from "./meal-plan-dates";
import {
  getCalendarWeekBounds,
  getCalendarWeekDates,
} from "./meal-plan-week";
import {
  getMealPlanPlanningData,
  getRecentlyUsedRecipeIds,
  listMealPlansForFamily,
} from "./meal-plan.server";
import {
  getAccessibleRecipeDetail,
  getRecipeManagementData,
} from "./recipe.server";
import { getFamilyShoppingData } from "./shopping.server";

const NO_CURRENT_MEAL_PLAN_ID = "__none__";

type McpActor = {
  familyId: string;
  userId: string;
};

function serializeRecipeSummary(recipe: {
  defaultServings: number | null;
  description: string | null;
  id: string;
  imageUrl: string | null;
  prepMinutes: number | null;
  scope: "FAMILY" | "GLOBAL";
  tags: string[];
  title: string;
}) {
  return {
    defaultServings: recipe.defaultServings,
    description: recipe.description,
    id: recipe.id,
    imageUrl: recipe.imageUrl,
    prepMinutes: recipe.prepMinutes,
    scope: recipe.scope,
    tags: recipe.tags,
    title: recipe.title,
  };
}

export async function listRecipesForMcp({ familyId, userId }: McpActor) {
  const data = await getRecipeManagementData({ familyId, userId });

  return {
    recipes: [
      ...data.familyRecipes.map(serializeRecipeSummary),
      ...data.globalRecipes.map(serializeRecipeSummary),
    ],
  };
}

export async function getRecipeForMcp({
  familyId,
  recipeId,
  userId,
}: McpActor & { recipeId: string }) {
  const result = await getAccessibleRecipeDetail({
    familyId,
    recipeId,
    userId,
  });

  if (result.status !== "FOUND") {
    return null;
  }

  return {
    recipe: {
      defaultServings: result.recipe.defaultServings,
      description: result.recipe.description,
      id: result.recipe.id,
      imageUrl: result.recipe.imageUrl,
      ingredients: result.recipe.ingredients.map((ingredient) => ({
        amount: ingredient.amount,
        category: ingredient.category.displayName,
        displayName: ingredient.displayName,
        unit: ingredient.unit,
      })),
      prepMinutes: result.recipe.prepMinutes,
      scope: result.recipe.scope,
      tags: result.recipe.tags,
      title: result.recipe.title,
    },
  };
}

export async function getCurrentWeekMealPlanForMcp({
  familyId,
  userId,
}: McpActor) {
  const weekBounds = getCalendarWeekBounds();
  const weekDates = getCalendarWeekDates(weekBounds);
  const coveringPlan = await findMealPlanCoveringDate({ familyId });

  if (!coveringPlan) {
    return {
      dinners: weekDates.map((date) => ({
        date,
        description: null,
        freezerLabel: null,
        imageUrl: null,
        note: null,
        recipeId: null,
        title: null,
      })),
      mealPlan: null,
      weekEnd: weekBounds.weekEnd,
      weekStart: weekBounds.weekStart,
    };
  }

  const planning = await getMealPlanPlanningData({
    familyId,
    mealPlanId: coveringPlan.id,
    userId,
  });
  const dinnerByDate = new Map(
    planning.mealPlan.entries
      .filter((entry) => entry.mealType === MealType.DINNER)
      .map((entry) => [
        formatDateOnly(entry.date),
        {
          date: formatDateOnly(entry.date),
          description: entry.recipe?.description ?? null,
          freezerLabel: entry.freezerItem?.label ?? null,
          imageUrl: entry.recipe?.imageUrl ?? null,
          note: entry.note,
          recipeId: entry.recipeId,
          title: entry.recipe?.title ?? null,
        },
      ]),
  );

  return {
    dinners: weekDates.map(
      (date) =>
        dinnerByDate.get(date) ?? {
          date,
          description: null,
          freezerLabel: null,
          imageUrl: null,
          note: null,
          recipeId: null,
          title: null,
        },
    ),
    mealPlan: {
      endDate: formatDateOnly(planning.mealPlan.endDate),
      id: planning.mealPlan.id,
      startDate: formatDateOnly(planning.mealPlan.startDate),
      status: planning.mealPlan.status,
      title: planning.mealPlan.title,
    },
    weekEnd: weekBounds.weekEnd,
    weekStart: weekBounds.weekStart,
  };
}

export async function listMealPlansForMcp({ familyId, userId }: McpActor) {
  const data = await listMealPlansForFamily({ familyId, userId });

  return {
    mealPlans: data.mealPlans.map((mealPlan) => ({
      endDate: formatDateOnly(mealPlan.endDate),
      id: mealPlan.id,
      startDate: formatDateOnly(mealPlan.startDate),
      status: mealPlan.status,
      title: mealPlan.title,
    })),
  };
}

export async function getShoppingListForMcp({ familyId, userId }: McpActor) {
  const data = await getFamilyShoppingData({ familyId, userId });

  return {
    activeListMode: data.activeListMode,
    itemCounts: data.itemCounts,
    items: data.projectedItems.map((item) => ({
      category: item.category.name,
      checked: item.checked,
      name: item.name,
      quantity: item.quantityLabel,
      sourceType: item.sourceType,
      store: item.preferredStore?.name ?? null,
    })),
  };
}

export async function getRecentDinnersForMcp({ familyId }: McpActor) {
  const coveringPlan = await findMealPlanCoveringDate({ familyId });
  const recipeIds = [
    ...(await getRecentlyUsedRecipeIds({
      beforeDate: coveringPlan?.startDate ?? new Date(),
      currentMealPlanId: coveringPlan?.id ?? NO_CURRENT_MEAL_PLAN_ID,
      familyId,
    })),
  ];

  if (recipeIds.length === 0) {
    return { recipes: [] };
  }

  const recipes = await db.recipe.findMany({
    orderBy: [{ title: "asc" }],
    select: {
      id: true,
      title: true,
    },
    where: {
      id: {
        in: recipeIds,
      },
    },
  });

  return {
    recipes,
  };
}

export async function listFreezerItemsForMcp({ familyId, userId }: McpActor) {
  const data = await listFamilyFreezerItems({ familyId, userId });

  return {
    freezerItems: data.freezerItems,
  };
}
