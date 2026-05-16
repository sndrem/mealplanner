-- AlterTable
ALTER TABLE "ShoppingItemOverride" ADD COLUMN     "includeDespiteStock" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "FamilyStockIngredient" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "ingredientId" TEXT,
    "displayNameNormalized" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyStockIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FamilyStockIngredient_familyId_idx" ON "FamilyStockIngredient"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyStockIngredient_familyId_ingredientId_key" ON "FamilyStockIngredient"("familyId", "ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyStockIngredient_familyId_displayNameNormalized_key" ON "FamilyStockIngredient"("familyId", "displayNameNormalized");

-- AddForeignKey
ALTER TABLE "FamilyStockIngredient" ADD CONSTRAINT "FamilyStockIngredient_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyStockIngredient" ADD CONSTRAINT "FamilyStockIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
