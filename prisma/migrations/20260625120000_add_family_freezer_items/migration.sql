-- CreateTable
CREATE TABLE "FamilyFreezerItem" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyFreezerItem_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "MealPlanEntry" ADD COLUMN "freezerItemId" TEXT;

-- CreateIndex
CREATE INDEX "FamilyFreezerItem_familyId_idx" ON "FamilyFreezerItem"("familyId");

-- CreateIndex
CREATE INDEX "MealPlanEntry_freezerItemId_idx" ON "MealPlanEntry"("freezerItemId");

-- AddForeignKey
ALTER TABLE "FamilyFreezerItem" ADD CONSTRAINT "FamilyFreezerItem_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanEntry" ADD CONSTRAINT "MealPlanEntry_freezerItemId_fkey" FOREIGN KEY ("freezerItemId") REFERENCES "FamilyFreezerItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
