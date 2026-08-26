-- CreateEnum
CREATE TYPE "RecipeReminderTimingKind" AS ENUM ('MORNING_OF', 'EVENING_BEFORE', 'HOURS_BEFORE_8', 'HOURS_BEFORE_16', 'HOURS_BEFORE_24');

-- CreateTable
CREATE TABLE "RecipeReminderSuggestion" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "timingKind" "RecipeReminderTimingKind",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeReminderSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipeReminderSuggestion_recipeId_sortOrder_idx" ON "RecipeReminderSuggestion"("recipeId", "sortOrder");

-- AddForeignKey
ALTER TABLE "RecipeReminderSuggestion" ADD CONSTRAINT "RecipeReminderSuggestion_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
