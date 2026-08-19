import { Prisma } from "@prisma/client";

import { db } from "./db.server";
import { requireFamilyMembership } from "./family.server";

export const storeCategorySelect =
  Prisma.validator<Prisma.IngredientCategorySelect>()({
    displayName: true,
    familyId: true,
    id: true,
  });

export const managedStoreSectionSelect =
  Prisma.validator<Prisma.StoreSectionSelect>()({
    categoryId: true,
    displayName: true,
    id: true,
    sortOrder: true,
  });

export const managedStoreSelect = Prisma.validator<Prisma.StoreSelect>()({
  familyId: true,
  id: true,
  key: true,
  name: true,
  sections: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: managedStoreSectionSelect,
  },
});

export type StoreCategory = Prisma.IngredientCategoryGetPayload<{
  select: typeof storeCategorySelect;
}>;

export type ManagedStore = Prisma.StoreGetPayload<{
  select: typeof managedStoreSelect;
}>;

export async function listIngredientCategories(familyId?: string) {
  return db.ingredientCategory.findMany({
    orderBy: [{ displayName: "asc" }],
    select: storeCategorySelect,
    where: familyId
      ? { OR: [{ familyId: null }, { familyId }] }
      : { familyId: null },
  });
}

export async function listScopedStores(familyId: string) {
  return db.store.findMany({
    orderBy: [{ name: "asc" }],
    select: managedStoreSelect,
    where: {
      OR: [{ familyId: null }, { familyId }],
    },
  });
}

export async function getStoreManagementData({
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
  const [categories, stores] = await Promise.all([
    listIngredientCategories(familyId),
    listScopedStores(familyId),
  ]);

  return {
    categories,
    family: {
      id: membership.family.id,
      name: membership.family.name,
    },
    globalStores: stores.filter((store) => store.familyId === null),
    familyStores: stores.filter((store) => store.familyId === familyId),
    userRole: membership.role,
  };
}
