import { Prisma } from "@prisma/client";

import { db } from "./db.server";

const REVISION_PARTS = [
  "mealPlan",
  "mealPlanEntry",
  "extraMeal",
  "manualItem",
  "shoppingOverride",
  "familyItem",
  "checkEvent",
  "stockIngredient",
  "offerBriefing",
  "store",
  "storeSection",
] as const;

type RevisionPartName = (typeof REVISION_PARTS)[number];

export type StoreModeTripRevisionPart = {
  count: number;
  max: Date | null;
};

export type StoreModeTripRevisionSnapshot = Record<
  RevisionPartName,
  StoreModeTripRevisionPart
>;

type RawRevisionRow = {
  checkEventCount: number | bigint | null;
  checkEventMax: Date | string | null;
  extraMealCount: number | bigint | null;
  extraMealMax: Date | string | null;
  familyItemCount: number | bigint | null;
  familyItemMax: Date | string | null;
  manualItemCount: number | bigint | null;
  manualItemMax: Date | string | null;
  mealPlanCount: number | bigint | null;
  mealPlanEntryCount: number | bigint | null;
  mealPlanEntryMax: Date | string | null;
  mealPlanMax: Date | string | null;
  offerBriefingCount: number | bigint | null;
  offerBriefingMax: Date | string | null;
  shoppingOverrideCount: number | bigint | null;
  shoppingOverrideMax: Date | string | null;
  stockIngredientCount: number | bigint | null;
  stockIngredientMax: Date | string | null;
  storeCount: number | bigint | null;
  storeMax: Date | string | null;
  storeSectionCount: number | bigint | null;
  storeSectionMax: Date | string | null;
};

function liveMealPlanStatusSql() {
  return Prisma.sql`('APPROVED'::"MealPlanStatus", 'DRAFT'::"MealPlanStatus")`;
}

export function buildStoreModeTripRevisionToken(
  snapshot: StoreModeTripRevisionSnapshot,
) {
  return REVISION_PARTS.map((partName) => {
    const part = snapshot[partName];
    const max = part.max ? part.max.toISOString() : "";

    return `${partName}:${max}:${part.count}`;
  }).join("|");
}

export function normalizeStoreModeTripRevisionRow(
  row: RawRevisionRow | undefined,
): StoreModeTripRevisionSnapshot {
  return {
    checkEvent: part(row?.checkEventMax, row?.checkEventCount),
    extraMeal: part(row?.extraMealMax, row?.extraMealCount),
    familyItem: part(row?.familyItemMax, row?.familyItemCount),
    manualItem: part(row?.manualItemMax, row?.manualItemCount),
    mealPlan: part(row?.mealPlanMax, row?.mealPlanCount),
    mealPlanEntry: part(row?.mealPlanEntryMax, row?.mealPlanEntryCount),
    offerBriefing: part(row?.offerBriefingMax, row?.offerBriefingCount),
    shoppingOverride: part(
      row?.shoppingOverrideMax,
      row?.shoppingOverrideCount,
    ),
    stockIngredient: part(row?.stockIngredientMax, row?.stockIngredientCount),
    store: part(row?.storeMax, row?.storeCount),
    storeSection: part(row?.storeSectionMax, row?.storeSectionCount),
  };
}

export async function getStoreModeTripRevision(familyId: string) {
  const [row] = await db.$queryRaw<RawRevisionRow[]>`
    SELECT
      (
        SELECT MAX("updatedAt")
        FROM "MealPlan"
        WHERE "familyId" = ${familyId}
          AND "status" IN ${liveMealPlanStatusSql()}
      ) AS "mealPlanMax",
      (
        SELECT COUNT(*)::int
        FROM "MealPlan"
        WHERE "familyId" = ${familyId}
          AND "status" IN ${liveMealPlanStatusSql()}
      ) AS "mealPlanCount",
      (
        SELECT MAX(entry."updatedAt")
        FROM "MealPlanEntry" entry
        INNER JOIN "MealPlan" plan ON plan."id" = entry."mealPlanId"
        WHERE plan."familyId" = ${familyId}
          AND plan."status" IN ${liveMealPlanStatusSql()}
      ) AS "mealPlanEntryMax",
      (
        SELECT COUNT(*)::int
        FROM "MealPlanEntry" entry
        INNER JOIN "MealPlan" plan ON plan."id" = entry."mealPlanId"
        WHERE plan."familyId" = ${familyId}
          AND plan."status" IN ${liveMealPlanStatusSql()}
      ) AS "mealPlanEntryCount",
      (
        SELECT MAX(extra."updatedAt")
        FROM "MealPlanExtraMeal" extra
        INNER JOIN "MealPlan" plan ON plan."id" = extra."mealPlanId"
        WHERE plan."familyId" = ${familyId}
          AND plan."status" IN ${liveMealPlanStatusSql()}
      ) AS "extraMealMax",
      (
        SELECT COUNT(*)::int
        FROM "MealPlanExtraMeal" extra
        INNER JOIN "MealPlan" plan ON plan."id" = extra."mealPlanId"
        WHERE plan."familyId" = ${familyId}
          AND plan."status" IN ${liveMealPlanStatusSql()}
      ) AS "extraMealCount",
      (
        SELECT MAX(item."updatedAt")
        FROM "ManualShoppingItem" item
        INNER JOIN "MealPlan" plan ON plan."id" = item."mealPlanId"
        WHERE plan."familyId" = ${familyId}
          AND plan."status" IN ${liveMealPlanStatusSql()}
      ) AS "manualItemMax",
      (
        SELECT COUNT(*)::int
        FROM "ManualShoppingItem" item
        INNER JOIN "MealPlan" plan ON plan."id" = item."mealPlanId"
        WHERE plan."familyId" = ${familyId}
          AND plan."status" IN ${liveMealPlanStatusSql()}
      ) AS "manualItemCount",
      (
        SELECT MAX(override."updatedAt")
        FROM "ShoppingItemOverride" override
        INNER JOIN "MealPlan" plan ON plan."id" = override."mealPlanId"
        WHERE plan."familyId" = ${familyId}
          AND plan."status" IN ${liveMealPlanStatusSql()}
      ) AS "shoppingOverrideMax",
      (
        SELECT COUNT(*)::int
        FROM "ShoppingItemOverride" override
        INNER JOIN "MealPlan" plan ON plan."id" = override."mealPlanId"
        WHERE plan."familyId" = ${familyId}
          AND plan."status" IN ${liveMealPlanStatusSql()}
      ) AS "shoppingOverrideCount",
      (
        SELECT MAX("updatedAt")
        FROM "FamilyShoppingItem"
        WHERE "familyId" = ${familyId}
      ) AS "familyItemMax",
      (
        SELECT COUNT(*)::int
        FROM "FamilyShoppingItem"
        WHERE "familyId" = ${familyId}
      ) AS "familyItemCount",
      (
        SELECT MAX("createdAt")
        FROM "ShoppingItemCheckEvent"
        WHERE "familyId" = ${familyId}
      ) AS "checkEventMax",
      (
        SELECT COUNT(*)::int
        FROM "ShoppingItemCheckEvent"
        WHERE "familyId" = ${familyId}
      ) AS "checkEventCount",
      (
        SELECT MAX("updatedAt")
        FROM "FamilyStockIngredient"
        WHERE "familyId" = ${familyId}
      ) AS "stockIngredientMax",
      (
        SELECT COUNT(*)::int
        FROM "FamilyStockIngredient"
        WHERE "familyId" = ${familyId}
      ) AS "stockIngredientCount",
      (
        SELECT MAX("updatedAt")
        FROM "StoreOfferBriefing"
        WHERE "familyId" = ${familyId}
      ) AS "offerBriefingMax",
      (
        SELECT COUNT(*)::int
        FROM "StoreOfferBriefing"
        WHERE "familyId" = ${familyId}
      ) AS "offerBriefingCount",
      (
        SELECT MAX("updatedAt")
        FROM "Store"
        WHERE "familyId" IS NULL OR "familyId" = ${familyId}
      ) AS "storeMax",
      (
        SELECT COUNT(*)::int
        FROM "Store"
        WHERE "familyId" IS NULL OR "familyId" = ${familyId}
      ) AS "storeCount",
      (
        SELECT MAX(section."updatedAt")
        FROM "StoreSection" section
        INNER JOIN "Store" store ON store."id" = section."storeId"
        WHERE store."familyId" IS NULL OR store."familyId" = ${familyId}
      ) AS "storeSectionMax",
      (
        SELECT COUNT(*)::int
        FROM "StoreSection" section
        INNER JOIN "Store" store ON store."id" = section."storeId"
        WHERE store."familyId" IS NULL OR store."familyId" = ${familyId}
      ) AS "storeSectionCount"
  `;

  return buildStoreModeTripRevisionToken(
    normalizeStoreModeTripRevisionRow(row),
  );
}

function part(
  max: Date | string | null | undefined,
  count: number | bigint | null | undefined,
): StoreModeTripRevisionPart {
  return {
    count: readRevisionCount(count),
    max: readRevisionInstant(max),
  };
}

function readRevisionInstant(value: Date | string | null | undefined) {
  if (value == null) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function readRevisionCount(value: number | bigint | null | undefined) {
  if (value == null) {
    return 0;
  }

  return Number(value);
}
