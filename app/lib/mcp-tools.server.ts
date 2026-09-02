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
  createOrReplaceMealPlanProposal,
  getMealPlanPlanningData,
  getRecentlyUsedRecipeIds,
  listMealPlansForFamily,
} from "./meal-plan.server";
import type { UpsertRecipeInput } from "./mcp-recipe-schema";
import { buildFamilyMealPlanProposalUrl } from "./mcp-token.server";
import { buildFamilyRecipeUrl } from "./recipe-reminder";
import {
  getAccessibleRecipeDetail,
  getRecipeManagementData,
} from "./recipe.server";
import {
  createFamilyRecipe,
  updateFamilyRecipe,
  type FamilyRecipeFieldErrors,
  type FamilyRecipeIngredientValues,
  type FamilyRecipeValues,
} from "./recipe-write.server";
import { getFamilyShoppingData } from "./shopping.server";
import { listIngredientCategories } from "./store.server";

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

function serializeMcpRecipeDetail(recipe: {
  defaultServings: number | null;
  description: string | null;
  id: string;
  imageUrl: string | null;
  ingredients: Array<{
    amount: string | null;
    category: { displayName: string; id: string; key: string };
    categoryId: string;
    displayName: string;
    preferredStoreId: string | null;
    unit: string | null;
  }>;
  prepMinutes: number | null;
  reminderSuggestions?: Array<{
    note: string | null;
    timingKind: string | null;
    title: string;
  }>;
  scope: "FAMILY" | "GLOBAL";
  tags: string[];
  title: string;
}) {
  return {
    defaultServings: recipe.defaultServings,
    description: recipe.description,
    id: recipe.id,
    imageUrl: recipe.imageUrl,
    ingredients: recipe.ingredients.map((ingredient) => ({
      amount: ingredient.amount,
      category: ingredient.category.displayName,
      categoryId: ingredient.categoryId,
      categoryKey: ingredient.category.key,
      displayName: ingredient.displayName,
      preferredStoreId: ingredient.preferredStoreId,
      unit: ingredient.unit,
    })),
    prepMinutes: recipe.prepMinutes,
    reminderSuggestions: (recipe.reminderSuggestions ?? []).map(
      (suggestion) => ({
        note: suggestion.note,
        timingKind: suggestion.timingKind,
        title: suggestion.title,
      }),
    ),
    scope: recipe.scope,
    tags: recipe.tags,
    title: recipe.title,
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
    recipe: serializeMcpRecipeDetail(result.recipe),
  };
}

export async function listIngredientCategoriesForMcp() {
  const categories = await listIngredientCategories();

  return {
    categories: categories.map((category) => ({
      displayName: category.displayName,
      id: category.id,
      key: category.key,
    })),
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

export async function createMealPlanProposalForMcp({
  dinners,
  familyId,
  origin,
  title,
  userId,
  weekEnd,
  weekStart,
}: McpActor & {
  dinners: {
    date: string;
    freezerItemId?: string;
    note?: string;
    recipeId?: string;
  }[];
  origin: string;
  title?: string;
  weekEnd?: string;
  weekStart?: string;
}) {
  const result = await createOrReplaceMealPlanProposal({
    dinners,
    familyId,
    title,
    userId,
    weekEnd,
    weekStart,
  });

  if (result.status !== "CREATED") {
    return result;
  }

  return {
    dinners: result.dinners,
    proposalId: result.proposalId,
    proposalUrl: buildFamilyMealPlanProposalUrl({
      familyId,
      mealPlanId: result.proposalId,
      origin,
    }),
    status: "CREATED" as const,
    title: result.title,
    weekEnd: result.weekEnd,
    weekStart: result.weekStart,
  };
}

const EMPTY_FAMILY_RECIPE_VALUES: FamilyRecipeValues = {
  defaultServings: "",
  description: "",
  ingredients: [],
  prepMinutes: "",
  reminderSuggestions: [],
  tags: "",
  title: "",
};

function formatFamilyRecipeFieldErrors(fieldErrors: FamilyRecipeFieldErrors) {
  const lines: string[] = [];

  const pushIndexed = (
    records: Record<number, string> | undefined,
    prefix: string,
  ) => {
    if (!records) {
      return;
    }

    for (const [index, message] of Object.entries(records)) {
      lines.push(`${prefix} ${Number(index) + 1}: ${message}`);
    }
  };

  if (fieldErrors.title) {
    lines.push(fieldErrors.title);
  }

  if (fieldErrors.defaultServings) {
    lines.push(fieldErrors.defaultServings);
  }

  if (fieldErrors.prepMinutes) {
    lines.push(fieldErrors.prepMinutes);
  }

  if (fieldErrors.ingredients) {
    lines.push(fieldErrors.ingredients);
  }

  if (fieldErrors.coverImage) {
    lines.push(fieldErrors.coverImage);
  }

  if (fieldErrors.reminderSuggestions) {
    lines.push(fieldErrors.reminderSuggestions);
  }

  pushIndexed(fieldErrors.ingredientDisplayNames, "Ingrediens");
  pushIndexed(fieldErrors.ingredientCategories, "Ingrediens");
  pushIndexed(fieldErrors.ingredientAmounts, "Ingrediens");
  pushIndexed(fieldErrors.reminderTitles, "Påminnelse");
  pushIndexed(fieldErrors.reminderNotes, "Påminnelse");
  pushIndexed(fieldErrors.reminderTimingKinds, "Påminnelse");

  return lines.join(" ");
}

function resolveIngredientCategoryId(
  ingredient: {
    category?: string;
    categoryId?: string;
    categoryKey?: string;
  },
  categories: Array<{ displayName: string; id: string; key: string }>,
): { categoryId: string; ok: true } | { error: string; ok: false } {
  if (ingredient.categoryKey) {
    const match = categories.find(
      (category) => category.key === ingredient.categoryKey,
    );

    if (!match) {
      return {
        error: `Ukjent kategorinøkkel: ${ingredient.categoryKey}`,
        ok: false,
      };
    }

    return { categoryId: match.id, ok: true };
  }

  if (ingredient.categoryId) {
    const match = categories.find(
      (category) => category.id === ingredient.categoryId,
    );

    if (!match) {
      return {
        error: `Ukjent kategori-id: ${ingredient.categoryId}`,
        ok: false,
      };
    }

    return { categoryId: match.id, ok: true };
  }

  const name = ingredient.category?.trim().toLowerCase() ?? "";
  const matches = categories.filter(
    (category) => category.displayName.trim().toLowerCase() === name,
  );

  if (matches.length === 1) {
    return { categoryId: matches[0].id, ok: true };
  }

  if (matches.length > 1) {
    return {
      error: `Kategorinavnet matcher flere kategorier: ${ingredient.category}`,
      ok: false,
    };
  }

  return {
    error: `Ukjent kategori: ${ingredient.category}`,
    ok: false,
  };
}

async function mapUpsertIngredients(
  ingredients: NonNullable<UpsertRecipeInput["ingredients"]>,
): Promise<
  | { ingredients: FamilyRecipeIngredientValues[]; ok: true }
  | { formError: string; ok: false }
> {
  const categories = await listIngredientCategories();
  const mapped: FamilyRecipeIngredientValues[] = [];

  for (const [index, ingredient] of ingredients.entries()) {
    const resolved = resolveIngredientCategoryId(ingredient, categories);

    if (!resolved.ok) {
      return {
        formError: `Ingrediens ${index + 1}: ${resolved.error}`,
        ok: false,
      };
    }

    mapped.push({
      amount: ingredient.amount ?? "",
      categoryId: resolved.categoryId,
      displayName: ingredient.displayName,
      preferredStoreId: ingredient.preferredStoreId ?? "",
      unit: ingredient.unit ?? "",
    });
  }

  return { ingredients: mapped, ok: true };
}

function mapUpsertReminders(
  reminders: NonNullable<UpsertRecipeInput["reminderSuggestions"]>,
) {
  return reminders.map((suggestion) => ({
    note: suggestion.note ?? "",
    timingKind: suggestion.timingKind ?? "",
    title: suggestion.title,
  }));
}

function overlayUpsertOnFamilyValues({
  base,
  input,
  resolvedIngredients,
}: {
  base: FamilyRecipeValues;
  input: UpsertRecipeInput;
  resolvedIngredients?: FamilyRecipeIngredientValues[];
}): FamilyRecipeValues {
  return {
    defaultServings:
      input.defaultServings !== undefined
        ? String(input.defaultServings)
        : base.defaultServings,
    description:
      input.description !== undefined ? input.description : base.description,
    ingredients: resolvedIngredients ?? base.ingredients,
    prepMinutes:
      input.prepMinutes !== undefined
        ? String(input.prepMinutes)
        : base.prepMinutes,
    reminderSuggestions:
      input.reminderSuggestions !== undefined
        ? mapUpsertReminders(input.reminderSuggestions)
        : base.reminderSuggestions,
    tags: input.tags !== undefined ? input.tags.join(", ") : base.tags,
    title: input.title !== undefined ? input.title : base.title,
  };
}

function storedRecipeToFamilyValues(recipe: {
  defaultServings: number | null;
  description: string | null;
  ingredients: Array<{
    amount: string | null;
    categoryId: string;
    displayName: string;
    preferredStoreId: string | null;
    unit: string | null;
  }>;
  prepMinutes: number | null;
  reminderSuggestions: Array<{
    note: string | null;
    timingKind: string | null;
    title: string;
  }>;
  tags: string[];
  title: string;
}): FamilyRecipeValues {
  return {
    defaultServings:
      recipe.defaultServings != null ? String(recipe.defaultServings) : "",
    description: recipe.description ?? "",
    ingredients: recipe.ingredients.map((ingredient) => ({
      amount: ingredient.amount ?? "",
      categoryId: ingredient.categoryId,
      displayName: ingredient.displayName,
      preferredStoreId: ingredient.preferredStoreId ?? "",
      unit: ingredient.unit ?? "",
    })),
    prepMinutes: recipe.prepMinutes != null ? String(recipe.prepMinutes) : "",
    reminderSuggestions: recipe.reminderSuggestions.map((suggestion) => ({
      note: suggestion.note ?? "",
      timingKind: suggestion.timingKind ?? "",
      title: suggestion.title,
    })),
    tags: recipe.tags.join(", "),
    title: recipe.title,
  };
}

async function buildUpsertSuccessResult({
  action,
  familyId,
  origin,
  recipeId,
  title,
  userId,
}: McpActor & {
  action: "created" | "updated";
  origin: string;
  recipeId: string;
  title: string;
}) {
  const detail = await getRecipeForMcp({ familyId, recipeId, userId });

  return {
    action,
    recipe: detail?.recipe ?? {
      defaultServings: null,
      description: null,
      id: recipeId,
      imageUrl: null,
      ingredients: [],
      prepMinutes: null,
      reminderSuggestions: [],
      scope: "FAMILY" as const,
      tags: [],
      title,
    },
    recipeId,
    recipeUrl: buildFamilyRecipeUrl({ familyId, origin, recipeId }),
    status: action === "created" ? ("CREATED" as const) : ("UPDATED" as const),
    title: detail?.recipe.title ?? title,
  };
}

export async function upsertRecipeForMcp({
  familyId,
  origin,
  userId,
  ...input
}: McpActor & { origin: string } & UpsertRecipeInput) {
  let resolvedIngredients: FamilyRecipeIngredientValues[] | undefined;

  if (input.ingredients) {
    const mapped = await mapUpsertIngredients(input.ingredients);

    if (!mapped.ok) {
      return {
        formError: mapped.formError,
        status: "VALIDATION_ERROR" as const,
      };
    }

    resolvedIngredients = mapped.ingredients;
  }

  if (!input.recipeId) {
    const values = overlayUpsertOnFamilyValues({
      base: EMPTY_FAMILY_RECIPE_VALUES,
      input,
      resolvedIngredients,
    });
    const result = await createFamilyRecipe({
      familyId,
      userId,
      values,
    });

    if (result.status !== "CREATED") {
      return {
        formError: formatFamilyRecipeFieldErrors(result.fieldErrors),
        status: "VALIDATION_ERROR" as const,
      };
    }

    return buildUpsertSuccessResult({
      action: "created",
      familyId,
      origin,
      recipeId: result.recipe.id,
      title: result.recipe.title,
      userId,
    });
  }

  const existing = await getAccessibleRecipeDetail({
    familyId,
    recipeId: input.recipeId,
    userId,
  });

  if (
    existing.status !== "FOUND" ||
    existing.recipe.scope !== "FAMILY" ||
    existing.recipe.familyId !== familyId
  ) {
    return {
      formError: "Fant ikke oppskriften.",
      status: "NOT_FOUND" as const,
    };
  }

  const values = overlayUpsertOnFamilyValues({
    base: storedRecipeToFamilyValues({
      ...existing.recipe,
      reminderSuggestions: existing.recipe.reminderSuggestions ?? [],
    }),
    input,
    resolvedIngredients,
  });
  const result = await updateFamilyRecipe({
    familyId,
    recipeId: input.recipeId,
    userId,
    values,
  });

  if (result.status === "NOT_FOUND") {
    return {
      formError: "Fant ikke oppskriften.",
      status: "NOT_FOUND" as const,
    };
  }

  if (result.status !== "UPDATED") {
    return {
      formError: formatFamilyRecipeFieldErrors(result.fieldErrors),
      status: "VALIDATION_ERROR" as const,
    };
  }

  return buildUpsertSuccessResult({
    action: "updated",
    familyId,
    origin,
    recipeId: input.recipeId,
    title: values.title,
    userId,
  });
}
