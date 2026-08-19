-- AlterTable
ALTER TABLE "IngredientCategory" ADD COLUMN     "familyId" TEXT;

-- CreateIndex
CREATE INDEX "IngredientCategory_familyId_idx" ON "IngredientCategory"("familyId");

-- AddForeignKey
ALTER TABLE "IngredientCategory" ADD CONSTRAINT "IngredientCategory_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
