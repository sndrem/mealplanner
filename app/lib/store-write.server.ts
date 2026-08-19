import { Prisma } from "@prisma/client";
import { randomBytes } from "crypto";

import { db } from "./db.server";
import { requireFamilyAdmin, requireFamilyMembership } from "./family.server";
import { listIngredientCategories } from "./store.server";

export interface FamilyStoreSectionValues {
  categoryId: string;
  displayName: string;
}

export interface FamilyStoreValues {
  name: string;
  sections: FamilyStoreSectionValues[];
}

export interface FamilyStoreFieldErrors {
  name?: string;
  sections?: string;
  sectionDisplayNames?: Record<string, string>;
}

export async function createFamilyStore({
  familyId,
  name,
  userId,
}: {
  familyId: string;
  name: string;
  userId: string;
}) {
  await requireFamilyAdmin({
    familyId,
    userId,
  });

  const normalizedName = name.trim();

  if (!normalizedName) {
    return {
      fieldErrors: {
        name: "Skriv inn et butikknavn.",
      },
      status: "VALIDATION_ERROR" as const,
      values: {
        name: normalizedName,
      },
    };
  }

  const [categories, existingStore] = await Promise.all([
    listIngredientCategories(familyId),
    db.store.findFirst({
      select: {
        id: true,
      },
      where: {
        familyId,
        name: normalizedName,
      },
    }),
  ]);

  if (existingStore) {
    return {
      fieldErrors: {
        name: "Butikknavnet brukes allerede i familien.",
      },
      status: "VALIDATION_ERROR" as const,
      values: {
        name: normalizedName,
      },
    };
  }

  const store = await db.store.create({
    data: {
      familyId,
      name: normalizedName,
      sections: {
        create: categories.map((category, index) => ({
          categoryId: category.id,
          displayName: category.displayName,
          sortOrder: index + 1,
        })),
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  return {
    status: "CREATED" as const,
    store,
  };
}

export async function updateFamilyStore({
  familyId,
  storeId,
  userId,
  values,
}: {
  familyId: string;
  storeId: string;
  userId: string;
  values: FamilyStoreValues;
}) {
  await requireFamilyAdmin({
    familyId,
    userId,
  });

  const existingStore = await db.store.findFirst({
    select: {
      id: true,
      sections: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: {
          categoryId: true,
          id: true,
        },
      },
    },
    where: {
      familyId,
      id: storeId,
    },
  });

  if (!existingStore) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  const validation = await validateFamilyStoreValues({
    familyId,
    storeId,
    values,
  });

  if (!validation.ok) {
    return {
      fieldErrors: validation.fieldErrors,
      status: "VALIDATION_ERROR" as const,
      values: validation.values,
    };
  }

  const existingCategoryIds = new Set(
    existingStore.sections.map((s) => s.categoryId),
  );
  const submittedCategoryIds = new Set(
    validation.values.sections.map((s) => s.categoryId),
  );
  const removedCategoryIds = existingStore.sections
    .filter((s) => !submittedCategoryIds.has(s.categoryId))
    .map((s) => s.id);

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.store.update({
      data: { name: validation.values.name },
      where: { id: existingStore.id },
    });

    if (removedCategoryIds.length > 0) {
      await tx.storeSection.deleteMany({
        where: { id: { in: removedCategoryIds } },
      });
    }

    await Promise.all(
      validation.values.sections.map((section, index) => {
        if (existingCategoryIds.has(section.categoryId)) {
          return tx.storeSection.update({
            data: {
              displayName: section.displayName,
              sortOrder: index + 1,
            },
            where: {
              storeId_categoryId: {
                categoryId: section.categoryId,
                storeId: existingStore.id,
              },
            },
          });
        }
        return tx.storeSection.create({
          data: {
            categoryId: section.categoryId,
            displayName: section.displayName,
            sortOrder: index + 1,
            storeId: existingStore.id,
          },
        });
      }),
    );
  });

  return {
    status: "UPDATED" as const,
  };
}

export async function deleteFamilyStore({
  familyId,
  storeId,
  userId,
}: {
  familyId: string;
  storeId: string;
  userId: string;
}) {
  await requireFamilyAdmin({
    familyId,
    userId,
  });

  const store = await db.store.findFirst({
    select: {
      id: true,
    },
    where: {
      familyId,
      id: storeId,
    },
  });

  if (!store) {
    return {
      status: "NOT_FOUND" as const,
    };
  }

  await db.store.delete({
    where: {
      id: store.id,
    },
  });

  return {
    status: "DELETED" as const,
  };
}

export async function updateSelectedStorePreference({
  familyId,
  selectedStoreId,
  userId,
}: {
  familyId: string;
  selectedStoreId: string;
  userId: string;
}) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  const normalizedStoreId = selectedStoreId.trim();

  if (!normalizedStoreId) {
    await db.userStorePreference.deleteMany({
      where: {
        familyId,
        userId,
      },
    });

    return {
      status: "UPDATED" as const,
    };
  }

  const scopedStoreId = await resolveScopedStoreId(normalizedStoreId, familyId);

  if (!scopedStoreId) {
    return {
      fieldErrors: {
        selectedStoreId: "Velg en gyldig butikk for familien.",
      },
      status: "VALIDATION_ERROR" as const,
      values: {
        selectedStoreId: normalizedStoreId,
      },
    };
  }

  await db.userStorePreference.upsert({
    create: {
      familyId,
      selectedStoreId: scopedStoreId,
      userId,
    },
    update: {
      selectedStoreId: scopedStoreId,
    },
    where: {
      userId_familyId: {
        familyId,
        userId,
      },
    },
  });

  return {
    status: "UPDATED" as const,
  };
}

async function validateFamilyStoreValues({
  familyId,
  storeId,
  values,
}: {
  familyId: string;
  storeId: string;
  values: FamilyStoreValues;
}) {
  const normalizedValues = {
    name: values.name.trim(),
    sections: values.sections.map((section) => ({
      categoryId: section.categoryId.trim(),
      displayName: section.displayName.trim(),
    })),
  };
  const fieldErrors: FamilyStoreFieldErrors = {};
  const sectionDisplayNames: Record<string, string> = {};

  if (!normalizedValues.name) {
    fieldErrors.name = "Skriv inn et butikknavn.";
  }

  const categories = await listIngredientCategories(familyId);
  const validCategoryIds = new Set(categories.map((category) => category.id));
  const submittedCategoryIds = normalizedValues.sections.map((section) => section.categoryId);
  const uniqueCategoryIds = new Set(submittedCategoryIds);

  if (uniqueCategoryIds.size !== normalizedValues.sections.length) {
    fieldErrors.sections = "Butikken kan ikke ha flere seksjoner for samme kategori.";
  } else if (submittedCategoryIds.some((categoryId) => !validCategoryIds.has(categoryId))) {
    fieldErrors.sections = "Én eller flere seksjoner refererer til en ukjent kategori.";
  } else if (normalizedValues.sections.length === 0) {
    fieldErrors.sections = "Butikken må ha minst én seksjon.";
  }

  for (const section of normalizedValues.sections) {
    if (!section.displayName) {
      sectionDisplayNames[section.categoryId] = "Skriv inn et seksjonsnavn.";
    }
  }

  if (Object.keys(sectionDisplayNames).length > 0) {
    fieldErrors.sectionDisplayNames = sectionDisplayNames;
  }

  const duplicateStore = normalizedValues.name
    ? await db.store.findFirst({
        select: {
          id: true,
        },
        where: {
          familyId,
          id: {
            not: storeId,
          },
          name: normalizedValues.name,
        },
      })
    : null;

  if (duplicateStore) {
    fieldErrors.name = "Butikknavnet brukes allerede i familien.";
  }

  if (fieldErrors.name || fieldErrors.sections || fieldErrors.sectionDisplayNames) {
    return {
      fieldErrors,
      ok: false as const,
      values: normalizedValues,
    };
  }

  return {
    ok: true as const,
    values: normalizedValues,
  };
}

export async function createFamilyCategory({
  familyId,
  displayName,
  userId,
}: {
  familyId: string;
  displayName: string;
  userId: string;
}) {
  await requireFamilyAdmin({ familyId, userId });

  const normalized = displayName.trim();
  if (!normalized) {
    return {
      fieldErrors: { displayName: "Skriv inn et kategorinavn." },
      status: "VALIDATION_ERROR" as const,
    };
  }

  const key = `family-${familyId}-${normalized.toLowerCase().replace(/\s+/g, "-")}-${randomBytes(4).toString("hex")}`;

  const category = await db.ingredientCategory.create({
    data: {
      displayName: normalized,
      familyId,
      key,
    },
    select: { id: true, displayName: true },
  });

  return { status: "CREATED" as const, category };
}

export async function deleteFamilyCategory({
  categoryId,
  familyId,
  userId,
}: {
  categoryId: string;
  familyId: string;
  userId: string;
}) {
  await requireFamilyAdmin({ familyId, userId });

  const category = await db.ingredientCategory.findFirst({
    where: { id: categoryId, familyId },
    select: { id: true },
  });

  if (!category) {
    return { status: "NOT_FOUND" as const };
  }

  const usageCount = await db.recipeIngredient.count({
    where: { categoryId },
  });

  if (usageCount > 0) {
    return {
      status: "IN_USE" as const,
      message: "Kategorien er i bruk av oppskrifter og kan ikke slettes.",
    };
  }

  await db.$transaction(async (tx) => {
    await tx.storeSection.deleteMany({ where: { categoryId } });
    await tx.ingredientCategory.delete({ where: { id: categoryId } });
  });

  return { status: "DELETED" as const };
}

async function resolveScopedStoreId(storeId: string, familyId: string) {
  const store = await db.store.findFirst({
    select: {
      id: true,
    },
    where: {
      id: storeId,
      OR: [{ familyId: null }, { familyId }],
    },
  });

  return store?.id ?? null;
}
