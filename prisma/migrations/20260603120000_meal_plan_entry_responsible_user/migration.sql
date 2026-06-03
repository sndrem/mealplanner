-- AlterTable
ALTER TABLE "MealPlanEntry" ADD COLUMN "responsibleUserId" TEXT;

-- CreateIndex
CREATE INDEX "MealPlanEntry_responsibleUserId_idx" ON "MealPlanEntry"("responsibleUserId");

-- AddForeignKey
ALTER TABLE "MealPlanEntry" ADD CONSTRAINT "MealPlanEntry_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
