-- CreateTable
CREATE TABLE "MealPlanExtraMeal" (
    "id" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlanExtraMeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealPlanExtraMeal_mealPlanId_sortOrder_idx" ON "MealPlanExtraMeal"("mealPlanId", "sortOrder");

-- CreateIndex
CREATE INDEX "MealPlanExtraMeal_recipeId_idx" ON "MealPlanExtraMeal"("recipeId");

-- AddForeignKey
ALTER TABLE "MealPlanExtraMeal" ADD CONSTRAINT "MealPlanExtraMeal_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanExtraMeal" ADD CONSTRAINT "MealPlanExtraMeal_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
