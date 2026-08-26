import { Prisma, RecipeScope, type RecipeReminderTimingKind } from "@prisma/client";

import { db } from "./db.server";
import { requireFamilyAdmin } from "./family.server";
import {
  parseRecipeReminderSuggestionRows,
  RECIPE_REMINDER_MAX_COUNT,
  type RecipeReminderSuggestionInput,
} from "./recipe-reminder";
import {
  deleteR2Object,
  isR2Configured,
  RECIPE_COVER_CONTENT_TYPES,
  RECIPE_COVER_MAX_BYTES,
  uploadRecipeCover,
  type RecipeCoverContentType,
} from "./r2.server";
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
  reminderSuggestions: RecipeReminderSuggestionInput[];
  tags: string;
  title: string;
}

export interface FamilyRecipeCoverInput {
  file: File | null;
  remove: boolean;
}

function parseIndexedFormRows(formData: FormData, fieldName: string) {
  const indices = formData
    .getAll(fieldName)
    .map((value) => String(value))
    .filter((value) => value.length > 0);

  return [...new Set(indices)].sort(
    (left, right) => Number(left) - Number(right),
  );
}

export function parseFamilyRecipeValues(formData: FormData): FamilyRecipeValues {
  const uniqueIndices = parseIndexedFormRows(formData, "ingredientIndex");
  const reminderIndices = parseIndexedFormRows(formData, "reminderIndex");

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
    reminderSuggestions: reminderIndices.map((index) => ({
      note: String(formData.get(`reminderNote:${index}`) ?? ""),
      timingKind: String(formData.get(`reminderTimingKind:${index}`) ?? ""),
      title: String(formData.get(`reminderTitle:${index}`) ?? ""),
    })),
    tags: String(formData.get("tags") ?? ""),
    title: String(formData.get("title") ?? ""),
  };
}

export function parseFamilyRecipeCoverInput(
  formData: FormData,
): FamilyRecipeCoverInput {
  const rawFile = formData.get("coverImage");
  const file =
    rawFile instanceof File && rawFile.size > 0 && rawFile.name
      ? rawFile
      : null;
  const removeRaw = String(formData.get("removeCoverImage") ?? "")
    .trim()
    .toLowerCase();

  return {
    file,
    remove: removeRaw === "1" || removeRaw === "true" || removeRaw === "on",
  };
}

export interface FamilyRecipeFieldErrors {
  coverImage?: string;
  defaultServings?: string;
  ingredients?: string;
  ingredientAmounts?: Record<number, string>;
  ingredientCategories?: Record<number, string>;
  ingredientDisplayNames?: Record<number, string>;
  prepMinutes?: string;
  reminderNotes?: Record<number, string>;
  reminderSuggestions?: string;
  reminderTimingKinds?: Record<number, string>;
  reminderTitles?: Record<number, string>;
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
      error: `${fieldLabel} må være et positivt heltall.`,
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

function isRecipeCoverContentType(
  value: string,
): value is RecipeCoverContentType {
  return (RECIPE_COVER_CONTENT_TYPES as readonly string[]).includes(value);
}

export function validateRecipeCoverFile(file: File | null) {
  if (!file) {
    return { ok: true as const, file: null };
  }

  if (!isR2Configured()) {
    return {
      error:
        "Bildeopplasting er ikke konfigurert. Sett Cloudflare R2-miljøvariabler.",
      ok: false as const,
    };
  }

  if (!isRecipeCoverContentType(file.type)) {
    return {
      error: "Coverbildet må være JPEG, PNG eller WebP.",
      ok: false as const,
    };
  }

  if (file.size > RECIPE_COVER_MAX_BYTES) {
    return {
      error: "Coverbildet kan være maks 2 MB.",
      ok: false as const,
    };
  }

  return {
    ok: true as const,
    file,
  };
}

async function readFileBytes(file: File) {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function createFamilyRecipe({
  cover,
  familyId,
  userId,
  values,
}: {
  cover?: FamilyRecipeCoverInput;
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
  const coverValidation = validateRecipeCoverFile(cover?.file ?? null);

  if (!validation.ok || !coverValidation.ok) {
    return {
      fieldErrors: {
        ...(validation.ok ? {} : validation.fieldErrors),
        ...(!coverValidation.ok ? { coverImage: coverValidation.error } : {}),
      },
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

  if (coverValidation.file) {
    try {
      const bytes = await readFileBytes(coverValidation.file);
      const imageKey = await uploadRecipeCover({
        bytes,
        contentType: coverValidation.file.type as RecipeCoverContentType,
        familyId,
        recipeId: recipe.id,
      });
      await db.recipe.update({
        data: { imageKey },
        where: { id: recipe.id },
      });
    } catch (error) {
      console.error("Failed to upload recipe cover after create", {
        error,
        recipeId: recipe.id,
      });
      return {
        fieldErrors: {
          coverImage:
            "Oppskriften ble opprettet, men coverbildet kunne ikke lastes opp. Prøv igjen fra redigering.",
        },
        recipe,
        status: "VALIDATION_ERROR" as const,
        values: validation.values,
      };
    }
  }

  return {
    recipe,
    status: "CREATED" as const,
  };
}

export async function updateFamilyRecipe({
  cover,
  familyId,
  recipeId,
  userId,
  values,
}: {
  cover?: FamilyRecipeCoverInput;
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
      imageKey: true,
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
  const coverValidation = validateRecipeCoverFile(cover?.file ?? null);

  if (!validation.ok || !coverValidation.ok) {
    return {
      fieldErrors: {
        ...(validation.ok ? {} : validation.fieldErrors),
        ...(!coverValidation.ok ? { coverImage: coverValidation.error } : {}),
      },
      status: "VALIDATION_ERROR" as const,
      values: validation.values,
    };
  }

  let nextImageKey: string | null | undefined = undefined;
  let uploadedKey: string | null = null;
  const previousImageKey = existingRecipe.imageKey;

  if (cover?.remove && !coverValidation.file) {
    nextImageKey = null;
  } else if (coverValidation.file) {
    try {
      const bytes = await readFileBytes(coverValidation.file);
      uploadedKey = await uploadRecipeCover({
        bytes,
        contentType: coverValidation.file.type as RecipeCoverContentType,
        familyId,
        recipeId: existingRecipe.id,
      });
      nextImageKey = uploadedKey;
    } catch (error) {
      console.error("Failed to upload recipe cover on update", {
        error,
        recipeId: existingRecipe.id,
      });
      return {
        fieldErrors: {
          coverImage: "Coverbildet kunne ikke lastes opp. Prøv igjen.",
        },
        status: "VALIDATION_ERROR" as const,
        values: validation.values,
      };
    }
  }

  try {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.recipe.update({
        data: {
          defaultServings: validation.parsed.defaultServings,
          description: validation.parsed.description,
          ...(nextImageKey !== undefined ? { imageKey: nextImageKey } : {}),
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

      await tx.recipeReminderSuggestion.deleteMany({
        where: {
          recipeId: existingRecipe.id,
        },
      });

      if (validation.parsed.reminderSuggestions.length > 0) {
        await tx.recipeReminderSuggestion.createMany({
          data: validation.parsed.reminderSuggestions.map(
            (suggestion, index) => ({
              note: suggestion.note,
              recipeId: existingRecipe.id,
              sortOrder: index + 1,
              timingKind: suggestion.timingKind,
              title: suggestion.title,
            }),
          ),
        });
      }
    });
  } catch (error) {
    if (uploadedKey) {
      await deleteR2Object(uploadedKey);
    }
    throw error;
  }

  if (
    nextImageKey !== undefined &&
    previousImageKey &&
    previousImageKey !== nextImageKey
  ) {
    await deleteR2Object(previousImageKey);
  }

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
      imageKey: true,
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

  await deleteR2Object(recipe.imageKey);

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
    reminderSuggestions: (values.reminderSuggestions ?? []).map(
      (suggestion) => ({
        note: suggestion.note,
        timingKind: suggestion.timingKind,
        title: suggestion.title,
      }),
    ),
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
        "Foretrukket butikk må tilhøre familien.";
    }
  });

  if (Object.keys(ingredientDisplayNames).length > 0) {
    fieldErrors.ingredientDisplayNames = ingredientDisplayNames;
  }

  if (Object.keys(ingredientCategories).length > 0) {
    fieldErrors.ingredientCategories = ingredientCategories;
  }

  const reminderParse = parseRecipeReminderSuggestionRows(
    normalizedValues.reminderSuggestions,
  );

  if (reminderParse.tooMany) {
    fieldErrors.reminderSuggestions = `Du kan legge til maks ${RECIPE_REMINDER_MAX_COUNT} påminnelser.`;
  }

  if (reminderParse.errors.titles) {
    fieldErrors.reminderTitles = reminderParse.errors.titles;
  }

  if (reminderParse.errors.notes) {
    fieldErrors.reminderNotes = reminderParse.errors.notes;
  }

  if (reminderParse.errors.timingKinds) {
    fieldErrors.reminderTimingKinds = reminderParse.errors.timingKinds;
  }

  if (
    fieldErrors.title ||
    fieldErrors.defaultServings ||
    fieldErrors.prepMinutes ||
    fieldErrors.ingredients ||
    fieldErrors.ingredientDisplayNames ||
    fieldErrors.ingredientCategories ||
    fieldErrors.reminderSuggestions ||
    fieldErrors.reminderTitles ||
    fieldErrors.reminderNotes ||
    fieldErrors.reminderTimingKinds
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
      defaultServings: servingsResult.ok ? (servingsResult.value ?? 2) : null,
      description: normalizedValues.description || null,
      ingredients: normalizedValues.ingredients.map((ingredient) => ({
        amount: ingredient.amount || null,
        categoryId: ingredient.categoryId,
        displayName: ingredient.displayName,
        preferredStoreId: ingredient.preferredStoreId || null,
        unit: ingredient.unit || null,
      })),
      prepMinutes: prepResult.ok ? (prepResult.value ?? 45) : null,
      reminderSuggestions: reminderParse.suggestions.map((suggestion) => ({
        note: suggestion.note,
        timingKind: suggestion.timingKind as RecipeReminderTimingKind | null,
        title: suggestion.title,
      })),
      tags: parseTags(normalizedValues.tags),
      title: normalizedValues.title,
    },
    values: normalizedValues,
  };
}
