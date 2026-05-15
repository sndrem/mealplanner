import { Prisma, RecipeScope } from "@prisma/client";

import { db } from "./db.server";
import { requireFamilyAdmin } from "./family.server";
import { listIngredientCategories } from "./store.server";

export interface FamilyRecipeIngredientValues {
  amount: string;
  categoryId: string;
  displayName: string;
  preferredStoreId: string;
  unit: string;
}

export interface FamilyRecipeValues {
  defaultServings: string;
  description: string;
  ingredients: FamilyRecipeIngredientValues[];
  prepMinutes: string;
  tags: string;
  title: string;
}

export function parseFamilyRecipeValues(formData: FormData): FamilyRecipeValues {
  const indices = formData
    .getAll("ingredientIndex")
    .map((value) => String(value))
    .filter((value) => value.length > 0);
  const uniqueIndices = [...new Set(indices)].sort(
    (left, right) => Number(left) - Number(right),
  );

  return {
    defaultServings: String(formData.get("defaultServings") ?? ""),
    description: String(formData.get("description") ?? ""),
    ingredients: uniqueIndices.map((index) => ({
      amount: String(formData.get(`ingredientAmount:${index}`) ?? ""),
      categoryId: String(formData.get(`ingredientCategoryId:${index}`) ?? ""),
      displayName: String(formData.get(`ingredientDisplayName:${index}`) ?? ""),
      preferredStoreId: String(
        formData.get(`ingredientPreferredStoreId:${index}`) ?? "",
      ),
      unit: String(formData.get(`ingredientUnit:${index}`) ?? ""),
    })),
    prepMinutes: String(formData.get("prepMinutes") ?? ""),
    tags: String(formData.get("tags") ?? ""),
    title: String(formData.get("title") ?? ""),
  };
}

export interface FamilyRecipeFieldErrors {
  defaultServings?: string;
  ingredients?: string;
  ingredientAmounts?: Record<number, string>;
  ingredientCategories?: Record<number, string>;
  ingredientDisplayNames?: Record<number, string>;
  prepMinutes?: string;
  title?: string;
}

function parseOptionalPositiveInt(value: string, fieldLabel: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return {
      ok: true as const,
      value: null,
    };
  }

  const parsed = Number.parseInt(trimmed, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return {
      error: `${fieldLabel} ma vare et positivt heltall.`,
      ok: false as const,
    };
  }

  return {
    ok: true as const,
    value: parsed,
  };
}

function parseTags(tags: string) {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function createFamilyRecipe({
  familyId,
  userId,
  values,
}: {
  familyId: string;
  userId: string;
  values: FamilyRecipeValues;
}) {
  await requireFamilyAdmin({
    familyId,
    userId,
  });

  const validation = await validateFamilyRecipeValues({
    familyId,
    values,
  });

  if (!validation.ok) {
    return {
      fieldErrors: validation.fieldErrors,
      status: "VALIDATION_ERROR" as const,
      values: validation.values,
    };
  }

  const recipe = await db.recipe.create({
    data: {
      createdByUserId: userId,
      defaultServings: validation.parsed.defaultServings,
      description: validation.parsed.description,
      familyId,
      ingredients: {
        create: validation.parsed.ingredients.map((ingredient, index) => ({
          amount: ingredient.amount,
          categoryId: ingredient.categoryId,
          displayName: ingredient.displayName,
          preferredStoreId: ingredient.preferredStoreId,
          sortOrder: index + 1,
          unit: ingredient.unit,
        })),
      },
      prepMinutes: validation.parsed.prepMinutes,
      scope: RecipeScope.FAMILY,
      tags: validation.parsed.tags,
      title: validation.parsed.title,
    },
    select: {
      id: true,
      title: true,
    },
  });

  return {
    recipe,
    status: "CREATED" as const,
  };
}

export async function updateFamilyRecipe({
  familyId,
  recipeId,
  userId,
  values,
}: {
  familyId: string;
  recipeId: string;
  userId: string;
  values: FamilyRecipeValues;
}) {
  await requireFamilyAdmin({
    familyId,
    userId,
  });

  const existingRecipe = await db.recipe.findFirst({
    select: {
      id: true,
    },
    where: {
      familyId,
      id: recipeId,
      scope: RecipeScope.FAMILY,
    },
  });

  if (!existingRecipe) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  const validation = await validateFamilyRecipeValues({
    familyId,
    values,
  });

  if (!validation.ok) {
    return {
      fieldErrors: validation.fieldErrors,
      status: "VALIDATION_ERROR" as const,
      values: validation.values,
    };
  }

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.recipe.update({
      data: {
        defaultServings: validation.parsed.defaultServings,
        description: validation.parsed.description,
        prepMinutes: validation.parsed.prepMinutes,
        tags: validation.parsed.tags,
        title: validation.parsed.title,
      },
      where: {
        id: existingRecipe.id,
      },
    });

    await tx.recipeIngredient.deleteMany({
      where: {
        recipeId: existingRecipe.id,
      },
    });

    await tx.recipeIngredient.createMany({
      data: validation.parsed.ingredients.map((ingredient, index) => ({
        amount: ingredient.amount,
        categoryId: ingredient.categoryId,
        displayName: ingredient.displayName,
        preferredStoreId: ingredient.preferredStoreId,
        recipeId: existingRecipe.id,
        sortOrder: index + 1,
        unit: ingredient.unit,
      })),
    });
  });

  return {
    status: "UPDATED" as const,
  };
}

export async function deleteFamilyRecipe({
  familyId,
  recipeId,
  userId,
}: {
  familyId: string;
  recipeId: string;
  userId: string;
}) {
  await requireFamilyAdmin({
    familyId,
    userId,
  });

  const recipe = await db.recipe.findFirst({
    select: {
      id: true,
      title: true,
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

  if (recipe._count.mealPlanEntries > 0) {
    return {
      entryCount: recipe._count.mealPlanEntries,
      status: "IN_USE" as const,
      title: recipe.title,
    };
  }

  await db.recipe.delete({
    where: {
      id: recipe.id,
    },
  });

  return {
    status: "DELETED" as const,
  };
}

async function validateFamilyRecipeValues({
  familyId,
  values,
}: {
  familyId: string;
  values: FamilyRecipeValues;
}) {
  const normalizedValues: FamilyRecipeValues = {
    defaultServings: values.defaultServings.trim(),
    description: values.description.trim(),
    ingredients: values.ingredients.map((ingredient) => ({
      amount: ingredient.amount.trim(),
      categoryId: ingredient.categoryId.trim(),
      displayName: ingredient.displayName.trim(),
      preferredStoreId: ingredient.preferredStoreId.trim(),
      unit: ingredient.unit.trim(),
    })),
    prepMinutes: values.prepMinutes.trim(),
    tags: values.tags.trim(),
    title: values.title.trim(),
  };
  const fieldErrors: FamilyRecipeFieldErrors = {};
  const ingredientDisplayNames: Record<number, string> = {};
  const ingredientCategories: Record<number, string> = {};

  if (!normalizedValues.title) {
    fieldErrors.title = "Skriv inn en tittel.";
  }

  const servingsResult = parseOptionalPositiveInt(
    normalizedValues.defaultServings,
    "Antall porsjoner",
  );

  if (!servingsResult.ok) {
    fieldErrors.defaultServings = servingsResult.error;
  }

  const prepResult = parseOptionalPositiveInt(
    normalizedValues.prepMinutes,
    "Tilberedningstid",
  );

  if (!prepResult.ok) {
    fieldErrors.prepMinutes = prepResult.error;
  }

  if (normalizedValues.ingredients.length === 0) {
    fieldErrors.ingredients = "Legg til minst en ingrediens.";
  }

  const categories = await listIngredientCategories();
  const validCategoryIds = new Set(categories.map((category) => category.id));
  const familyStores = await db.store.findMany({
    select: {
      id: true,
    },
    where: {
      familyId,
    },
  });
  const validFamilyStoreIds = new Set(familyStores.map((store) => store.id));

  normalizedValues.ingredients.forEach((ingredient, index) => {
    if (!ingredient.displayName) {
      ingredientDisplayNames[index] = "Skriv inn et ingrediensnavn.";
    }

    if (!ingredient.categoryId || !validCategoryIds.has(ingredient.categoryId)) {
      ingredientCategories[index] = "Velg en gyldig kategori.";
    }

    if (
      ingredient.preferredStoreId &&
      !validFamilyStoreIds.has(ingredient.preferredStoreId)
    ) {
      ingredientCategories[index] =
        "Foretrukket butikk ma tilhore familien.";
    }
  });

  if (Object.keys(ingredientDisplayNames).length > 0) {
    fieldErrors.ingredientDisplayNames = ingredientDisplayNames;
  }

  if (Object.keys(ingredientCategories).length > 0) {
    fieldErrors.ingredientCategories = ingredientCategories;
  }

  if (
    fieldErrors.title ||
    fieldErrors.defaultServings ||
    fieldErrors.prepMinutes ||
    fieldErrors.ingredients ||
    fieldErrors.ingredientDisplayNames ||
    fieldErrors.ingredientCategories
  ) {
    return {
      fieldErrors,
      ok: false as const,
      values: normalizedValues,
    };
  }

  return {
    ok: true as const,
    parsed: {
      defaultServings: servingsResult.ok ? servingsResult.value : null,
      description: normalizedValues.description || null,
      ingredients: normalizedValues.ingredients.map((ingredient) => ({
        amount: ingredient.amount || null,
        categoryId: ingredient.categoryId,
        displayName: ingredient.displayName,
        preferredStoreId: ingredient.preferredStoreId || null,
        unit: ingredient.unit || null,
      })),
      prepMinutes: prepResult.ok ? prepResult.value : null,
      tags: parseTags(normalizedValues.tags),
      title: normalizedValues.title,
    },
    values: normalizedValues,
  };
}
