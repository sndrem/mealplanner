import { db } from "./db.server";
import { requireFamilyMembership } from "./family.server";
import { normalizeIngredientCanonicalName } from "./ingredient-normalize";
import { findCanonicalIngredientByNormalizedName } from "./shopping-catalog.server";

export interface FamilyShoppingCatalogItemValues {
  categoryId: string;
  name: string;
  quantity: string;
}

export interface FamilyShoppingCatalogItemFieldErrors {
  categoryId?: string;
  name?: string;
}

export async function upsertFamilyShoppingCatalogItem({
  categoryId,
  displayName,
  familyId,
  quantity,
}: {
  categoryId: string;
  displayName: string;
  familyId: string;
  quantity?: string | null;
}) {
  const trimmedName = displayName.trim();
  const nameNormalized = normalizeIngredientCanonicalName(trimmedName);

  if (!nameNormalized || !categoryId) {
    return {
      status: "SKIPPED" as const,
    };
  }

  const canonicalIngredient =
    await findCanonicalIngredientByNormalizedName(nameNormalized);

  if (canonicalIngredient) {
    return {
      status: "SKIPPED" as const,
    };
  }

  const existing = await db.familyShoppingCatalogItem.findUnique({
    select: {
      id: true,
    },
    where: {
      familyId_nameNormalized: {
        familyId,
        nameNormalized,
      },
    },
  });

  if (existing) {
    await db.familyShoppingCatalogItem.update({
      data: {
        lastUsedAt: new Date(),
      },
      where: {
        id: existing.id,
      },
    });

    return {
      catalogItemId: existing.id,
      status: "UPDATED" as const,
    };
  }

  const created = await db.familyShoppingCatalogItem.create({
    data: {
      defaultCategoryId: categoryId,
      defaultQuantity: quantity?.trim() || null,
      displayName: trimmedName,
      familyId,
      lastUsedAt: new Date(),
      nameNormalized,
    },
    select: {
      id: true,
    },
  });

  return {
    catalogItemId: created.id,
    status: "CREATED" as const,
  };
}

export async function upsertFamilyShoppingCatalogItemFromQuickAdd({
  familyId,
  ingredientId,
  item,
}: {
  familyId: string;
  ingredientId?: string;
  item: {
    category: { id: string };
    name: string;
    quantity?: string | null;
  };
}) {
  if (ingredientId?.trim()) {
    return {
      status: "SKIPPED" as const,
    };
  }

  return upsertFamilyShoppingCatalogItem({
    categoryId: item.category.id,
    displayName: item.name,
    familyId,
    quantity: item.quantity,
  });
}

export async function addFamilyShoppingCatalogItem({
  familyId,
  userId,
  values,
}: {
  familyId: string;
  userId: string;
  values: FamilyShoppingCatalogItemValues;
}) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  const validation = await validateFamilyShoppingCatalogItemValues({
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

  const created = await db.familyShoppingCatalogItem.create({
    data: {
      defaultCategoryId: validation.categoryId,
      defaultQuantity: validation.quantity,
      displayName: validation.name,
      familyId,
      lastUsedAt: new Date(),
      nameNormalized: validation.nameNormalized,
    },
    select: {
      id: true,
    },
  });

  return {
    catalogItemId: created.id,
    status: "CREATED" as const,
  };
}

export async function updateFamilyShoppingCatalogItem({
  catalogItemId,
  familyId,
  userId,
  values,
}: {
  catalogItemId: string;
  familyId: string;
  userId: string;
  values: FamilyShoppingCatalogItemValues;
}) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  const validation = await validateFamilyShoppingCatalogItemValues({
    excludeCatalogItemId: catalogItemId,
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

  const updated = await db.familyShoppingCatalogItem.updateMany({
    data: {
      defaultCategoryId: validation.categoryId,
      defaultQuantity: validation.quantity,
      displayName: validation.name,
      nameNormalized: validation.nameNormalized,
    },
    where: {
      familyId,
      id: catalogItemId,
    },
  });

  if (updated.count === 0) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  return {
    status: "UPDATED" as const,
  };
}

export async function deleteFamilyShoppingCatalogItem({
  catalogItemId,
  familyId,
  userId,
}: {
  catalogItemId: string;
  familyId: string;
  userId: string;
}) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  const deleted = await db.familyShoppingCatalogItem.deleteMany({
    where: {
      familyId,
      id: catalogItemId,
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

async function validateFamilyShoppingCatalogItemValues({
  excludeCatalogItemId,
  familyId,
  values,
}: {
  excludeCatalogItemId?: string;
  familyId: string;
  values: FamilyShoppingCatalogItemValues;
}) {
  const name = values.name.trim();
  const quantity = values.quantity.trim() || null;
  const categoryId = values.categoryId.trim();
  const fieldErrors: FamilyShoppingCatalogItemFieldErrors = {};

  if (!name) {
    fieldErrors.name = "Skriv inn et varenavn.";
  }

  if (!categoryId) {
    fieldErrors.categoryId = "Velg en kategori.";
  }

  const nameNormalized = normalizeIngredientCanonicalName(name);

  if (name && !fieldErrors.name) {
    const canonicalIngredient =
      await findCanonicalIngredientByNormalizedName(nameNormalized);

    if (canonicalIngredient) {
      fieldErrors.name =
        "Dette navnet finnes allerede i ingrediensregisteret.";
    }
  }

  if (name && categoryId && !fieldErrors.name) {
    const collision = await db.familyShoppingCatalogItem.findFirst({
      select: {
        id: true,
      },
      where: {
        familyId,
        nameNormalized,
        ...(excludeCatalogItemId
          ? {
              NOT: {
                id: excludeCatalogItemId,
              },
            }
          : {}),
      },
    });

    if (collision) {
      fieldErrors.name = "Det finnes allerede en handlevare med dette navnet.";
    }
  }

  if (categoryId && !fieldErrors.categoryId) {
    const category = await db.ingredientCategory.findUnique({
      select: {
        id: true,
      },
      where: {
        id: categoryId,
      },
    });

    if (!category) {
      fieldErrors.categoryId = "Velg en gyldig kategori.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      ok: false as const,
      values: {
        categoryId,
        name,
        quantity: values.quantity,
      },
    };
  }

  return {
    categoryId,
    name,
    nameNormalized,
    ok: true as const,
    quantity,
  };
}
