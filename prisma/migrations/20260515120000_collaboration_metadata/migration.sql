-- AlterTable
ALTER TABLE "MealPlan" ADD COLUMN "updatedByUserId" TEXT;

-- AlterTable
ALTER TABLE "MealPlanEntry" ADD COLUMN "updatedByUserId" TEXT;

-- AlterTable
ALTER TABLE "ManualShoppingItem" ADD COLUMN "updatedByUserId" TEXT;

-- AlterTable
ALTER TABLE "ShoppingItemOverride" ADD COLUMN "updatedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "MealPlan_updatedByUserId_idx" ON "MealPlan"("updatedByUserId");

-- CreateIndex
CREATE INDEX "MealPlanEntry_updatedByUserId_idx" ON "MealPlanEntry"("updatedByUserId");

-- CreateIndex
CREATE INDEX "ManualShoppingItem_updatedByUserId_idx" ON "ManualShoppingItem"("updatedByUserId");

-- CreateIndex
CREATE INDEX "ShoppingItemOverride_updatedByUserId_idx" ON "ShoppingItemOverride"("updatedByUserId");

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanEntry" ADD CONSTRAINT "MealPlanEntry_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualShoppingItem" ADD CONSTRAINT "ManualShoppingItem_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItemOverride" ADD CONSTRAINT "ShoppingItemOverride_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
