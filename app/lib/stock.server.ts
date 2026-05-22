import { Prisma } from "@prisma/client";

import { db } from "./db.server";
import { requireFamilyMembership } from "./family.server";
import { normalizeIngredientCanonicalName } from "./ingredient-normalize";

const familyStockIngredientSelect =
  Prisma.validator<Prisma.FamilyStockIngredientSelect>()({
    displayNameNormalized: true,
    id: true,
    ingredient: {
      select: {
        canonicalName: true,
        id: true,
      },
    },
    ingredientId: true,
    note: true,
  });

export type FamilyStockIngredientRow = Prisma.FamilyStockIngredientGetPayload<{
  select: typeof familyStockIngredientSelect;
}>;

export interface FamilyStockMatchSet {
  ingredientIds: Set<string>;
  displayNameNormalized: Set<string>;
}

export interface StockMatchableIngredient {
  displayName: string;
  ingredientId: string | null;
}

export async function listFamilyStockIngredients({
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

  const stockIngredients = await db.familyStockIngredient.findMany({
    orderBy: [
      { ingredient: { canonicalName: "asc" } },
      { displayNameNormalized: "asc" },
    ],
    select: familyStockIngredientSelect,
    where: {
      familyId,
    },
  });

  return {
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
    stockIngredients: stockIngredients.map(formatFamilyStockIngredient),
    userRole: membership.role,
  };
}

export async function getFamilyStockMatchSet(
  familyId: string,
): Promise<FamilyStockMatchSet> {
  const rows = await db.familyStockIngredient.findMany({
    select: {
      displayNameNormalized: true,
      ingredientId: true,
    },
    where: {
      familyId,
    },
  });

  const ingredientIds = new Set<string>();
  const displayNameNormalized = new Set<string>();

  for (const row of rows) {
    if (row.ingredientId) {
      ingredientIds.add(row.ingredientId);
    }

    if (row.displayNameNormalized) {
      displayNameNormalized.add(row.displayNameNormalized);
    }
  }

  return {
    displayNameNormalized,
    ingredientIds,
  };
}

export function isStockIngredientMatch(
  ingredient: StockMatchableIngredient,
  matchSet: FamilyStockMatchSet,
) {
  if (
    ingredient.ingredientId &&
    matchSet.ingredientIds.has(ingredient.ingredientId)
  ) {
    return true;
  }

  const normalizedDisplayName = normalizeIngredientCanonicalName(
    ingredient.displayName,
  );

  return matchSet.displayNameNormalized.has(normalizedDisplayName);
}

export async function searchCanonicalIngredients(query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  return db.ingredient.findMany({
    orderBy: [{ canonicalName: "asc" }],
    select: {
      canonicalName: true,
      defaultCategoryId: true,
      id: true,
    },
    take: 20,
    where: {
      canonicalName: {
        contains: normalizedQuery,
        mode: "insensitive",
      },
    },
  });
}

function formatFamilyStockIngredient(row: FamilyStockIngredientRow) {
  return {
    displayLabel: row.ingredient?.canonicalName ?? row.displayNameNormalized ?? "",
    displayNameNormalized: row.displayNameNormalized,
    id: row.id,
    ingredientId: row.ingredientId,
    note: row.note,
  };
}
