import { db } from "./db.server";
import { requireFamilyAdmin } from "./family.server";
import { normalizeIngredientCanonicalName } from "./ingredient-normalize";

export interface AddFamilyStockIngredientValues {
  displayName: string;
  ingredientId: string;
  note: string;
}

export interface AddFamilyStockIngredientFieldErrors {
  displayName?: string;
  ingredientId?: string;
}

export async function addFamilyStockIngredient({
  familyId,
  userId,
  values,
}: {
  familyId: string;
  userId: string;
  values: AddFamilyStockIngredientValues;
}) {
  await requireFamilyAdmin({
    familyId,
    userId,
  });

  const ingredientId = values.ingredientId.trim();
  const displayName = values.displayName.trim();
  const note = values.note.trim() || null;

  if (!ingredientId && !displayName) {
    return {
      fieldErrors: {
        displayName: "Velg en ingrediens eller skriv inn et navn.",
      },
      status: "VALIDATION_ERROR" as const,
      values: {
        displayName,
        ingredientId,
        note: values.note,
      },
    };
  }

  if (ingredientId) {
    const ingredient = await db.ingredient.findUnique({
      select: {
        id: true,
      },
      where: {
        id: ingredientId,
      },
    });

    if (!ingredient) {
      return {
        fieldErrors: {
          ingredientId: "Fant ikke ingrediensen.",
        },
        status: "VALIDATION_ERROR" as const,
        values: {
          displayName,
          ingredientId,
          note: values.note,
        },
      };
    }

    const existing = await db.familyStockIngredient.findUnique({
      select: {
        id: true,
      },
      where: {
        familyId_ingredientId: {
          familyId,
          ingredientId,
        },
      },
    });

    if (existing) {
      return {
        fieldErrors: {
          ingredientId: "Ingrediensen er allerede lagt til som basisvare.",
        },
        status: "VALIDATION_ERROR" as const,
        values: {
          displayName,
          ingredientId,
          note: values.note,
        },
      };
    }

    const stockIngredient = await db.familyStockIngredient.create({
      data: {
        familyId,
        ingredientId,
        note,
      },
      select: {
        id: true,
      },
    });

    return {
      status: "CREATED" as const,
      stockIngredientId: stockIngredient.id,
    };
  }

  const displayNameNormalized = normalizeIngredientCanonicalName(displayName);

  if (!displayNameNormalized) {
    return {
      fieldErrors: {
        displayName: "Skriv inn et gyldig ingrediensnavn.",
      },
      status: "VALIDATION_ERROR" as const,
      values: {
        displayName,
        ingredientId,
        note: values.note,
      },
    };
  }

  const existing = await db.familyStockIngredient.findUnique({
    select: {
      id: true,
    },
    where: {
      familyId_displayNameNormalized: {
        displayNameNormalized,
        familyId,
      },
    },
  });

  if (existing) {
    return {
      fieldErrors: {
        displayName: "Ingrediensen er allerede lagt til som basisvare.",
      },
      status: "VALIDATION_ERROR" as const,
      values: {
        displayName,
        ingredientId,
        note: values.note,
      },
    };
  }

  const stockIngredient = await db.familyStockIngredient.create({
    data: {
      displayNameNormalized,
      familyId,
      note,
    },
    select: {
      id: true,
    },
  });

  return {
    status: "CREATED" as const,
    stockIngredientId: stockIngredient.id,
  };
}

export async function removeFamilyStockIngredient({
  familyId,
  stockIngredientId,
  userId,
}: {
  familyId: string;
  stockIngredientId: string;
  userId: string;
}) {
  await requireFamilyAdmin({
    familyId,
    userId,
  });

  const deleted = await db.familyStockIngredient.deleteMany({
    where: {
      familyId,
      id: stockIngredientId,
    },
  });

  if (deleted.count === 0) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  return {
    status: "DELETED" as const,
  };
}
