-- CreateTable
CREATE TABLE "FamilyShoppingCatalogItem" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "defaultQuantity" TEXT,
    "defaultCategoryId" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyShoppingCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FamilyShoppingCatalogItem_familyId_idx" ON "FamilyShoppingCatalogItem"("familyId");

-- CreateIndex
CREATE INDEX "FamilyShoppingCatalogItem_defaultCategoryId_idx" ON "FamilyShoppingCatalogItem"("defaultCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyShoppingCatalogItem_familyId_nameNormalized_key" ON "FamilyShoppingCatalogItem"("familyId", "nameNormalized");

-- AddForeignKey
ALTER TABLE "FamilyShoppingCatalogItem" ADD CONSTRAINT "FamilyShoppingCatalogItem_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyShoppingCatalogItem" ADD CONSTRAINT "FamilyShoppingCatalogItem_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "IngredientCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill distinct historical custom names (latest updatedAt wins).
INSERT INTO "FamilyShoppingCatalogItem" (
    "id",
    "familyId",
    "displayName",
    "nameNormalized",
    "defaultQuantity",
    "defaultCategoryId",
    "lastUsedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    source."familyId",
    source."displayName",
    source."nameNormalized",
    source."defaultQuantity",
    source."defaultCategoryId",
    source."lastUsedAt",
    source."lastUsedAt",
    source."lastUsedAt"
FROM (
    SELECT DISTINCT ON ("familyId", "nameNormalized")
        "familyId",
        "displayName",
        "nameNormalized",
        "defaultQuantity",
        "defaultCategoryId",
        "lastUsedAt"
    FROM (
        SELECT
            "MealPlan"."familyId" AS "familyId",
            TRIM("ManualShoppingItem"."name") AS "displayName",
            LOWER(TRIM("ManualShoppingItem"."name")) AS "nameNormalized",
            NULLIF(TRIM("ManualShoppingItem"."quantity"), '') AS "defaultQuantity",
            "ManualShoppingItem"."categoryId" AS "defaultCategoryId",
            "ManualShoppingItem"."updatedAt" AS "lastUsedAt"
        FROM "ManualShoppingItem"
        INNER JOIN "MealPlan" ON "MealPlan"."id" = "ManualShoppingItem"."mealPlanId"
        WHERE TRIM("ManualShoppingItem"."name") <> ''

        UNION ALL

        SELECT
            "FamilyShoppingItem"."familyId" AS "familyId",
            TRIM("FamilyShoppingItem"."name") AS "displayName",
            LOWER(TRIM("FamilyShoppingItem"."name")) AS "nameNormalized",
            NULLIF(TRIM("FamilyShoppingItem"."quantity"), '') AS "defaultQuantity",
            "FamilyShoppingItem"."categoryId" AS "defaultCategoryId",
            "FamilyShoppingItem"."updatedAt" AS "lastUsedAt"
        FROM "FamilyShoppingItem"
        WHERE TRIM("FamilyShoppingItem"."name") <> ''
    ) AS combined
    ORDER BY "familyId", "nameNormalized", "lastUsedAt" DESC
) AS source
WHERE NOT EXISTS (
    SELECT 1
    FROM "Ingredient"
    WHERE LOWER("Ingredient"."canonicalName") = source."nameNormalized"
);
