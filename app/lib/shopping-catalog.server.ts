import { Prisma } from "@prisma/client";

import { db } from "./db.server";
import { requireFamilyMembership } from "./family.server";
import { normalizeIngredientCanonicalName } from "./ingredient-normalize";
import { searchCanonicalIngredients } from "./stock.server";

const CATALOG_SEARCH_LIMIT = 20;

const familyShoppingCatalogItemSelect =
  Prisma.validator<Prisma.FamilyShoppingCatalogItemSelect>()({
    defaultCategory: {
      select: {
        displayName: true,
        id: true,
      },
    },
    defaultCategoryId: true,
    defaultQuantity: true,
    displayName: true,
    id: true,
    lastUsedAt: true,
    nameNormalized: true,
  });

export type FamilyShoppingCatalogItemRow = Prisma.FamilyShoppingCatalogItemGetPayload<{
  select: typeof familyShoppingCatalogItemSelect;
}>;

export type ShoppingQuickAddSuggestionSource = "catalog" | "register";

export interface ShoppingQuickAddSuggestion {
  canonicalName: string;
  defaultCategoryId: string | null;
  defaultQuantity: string | null;
  id: string;
  source: ShoppingQuickAddSuggestionSource;
}

export async function listFamilyShoppingCatalogItems({
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

  const catalogItems = await db.familyShoppingCatalogItem.findMany({
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    select: familyShoppingCatalogItemSelect,
    where: {
      familyId,
    },
  });

  return {
    catalogItems,
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
    userRole: membership.role,
  };
}

export async function searchFamilyShoppingCatalogItems({
  familyId,
  query,
}: {
  familyId: string;
  query: string;
}) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  return db.familyShoppingCatalogItem.findMany({
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    select: familyShoppingCatalogItemSelect,
    take: CATALOG_SEARCH_LIMIT,
    where: {
      familyId,
      displayName: {
        contains: normalizedQuery,
        mode: "insensitive",
      },
    },
  });
}

export async function getFamilyShoppingCatalogItemForFamily({
  catalogItemId,
  familyId,
}: {
  catalogItemId: string;
  familyId: string;
}) {
  return db.familyShoppingCatalogItem.findFirst({
    select: familyShoppingCatalogItemSelect,
    where: {
      familyId,
      id: catalogItemId,
    },
  });
}

export async function getFamilyShoppingCatalogItemByNormalizedName({
  familyId,
  nameNormalized,
}: {
  familyId: string;
  nameNormalized: string;
}) {
  if (!nameNormalized) {
    return null;
  }

  return db.familyShoppingCatalogItem.findUnique({
    select: familyShoppingCatalogItemSelect,
    where: {
      familyId_nameNormalized: {
        familyId,
        nameNormalized,
      },
    },
  });
}

export async function findCanonicalIngredientByNormalizedName(
  nameNormalized: string,
) {
  if (!nameNormalized) {
    return null;
  }

  return db.ingredient.findFirst({
    select: {
      canonicalName: true,
      id: true,
    },
    where: {
      canonicalName: {
        equals: nameNormalized,
        mode: "insensitive",
      },
    },
  });
}

export async function searchShoppingQuickAddSuggestions({
  familyId,
  query,
}: {
  familyId: string;
  query: string;
}): Promise<ShoppingQuickAddSuggestion[]> {
  const [catalogItems, registerItems] = await Promise.all([
    searchFamilyShoppingCatalogItems({
      familyId,
      query,
    }),
    searchCanonicalIngredients(query),
  ]);

  const suggestions: ShoppingQuickAddSuggestion[] = catalogItems.map(
    (item) => ({
      canonicalName: item.displayName,
      defaultCategoryId: item.defaultCategoryId,
      defaultQuantity: item.defaultQuantity,
      id: item.id,
      source: "catalog" as const,
    }),
  );
  const seen = new Set(
    suggestions.map((item) =>
      normalizeIngredientCanonicalName(item.canonicalName),
    ),
  );

  for (const ingredient of registerItems) {
    const nameNormalized = normalizeIngredientCanonicalName(
      ingredient.canonicalName,
    );

    if (seen.has(nameNormalized)) {
      continue;
    }

    seen.add(nameNormalized);
    suggestions.push({
      canonicalName: ingredient.canonicalName,
      defaultCategoryId: ingredient.defaultCategoryId,
      defaultQuantity: null,
      id: ingredient.id,
      source: "register",
    });
  }

  return suggestions;
}
