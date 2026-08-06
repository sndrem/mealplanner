-- CreateEnum
CREATE TYPE "ShoppingCheckEventTarget" AS ENUM ('FAMILY_ITEM', 'MEAL_PLAN_ITEM');

-- CreateTable
CREATE TABLE "ShoppingItemCheckEvent" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "mealPlanId" TEXT,
    "targetType" "ShoppingCheckEventTarget" NOT NULL,
    "targetKey" TEXT NOT NULL,
    "sourceType" "ShoppingItemSource",
    "itemName" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShoppingItemCheckEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShoppingItemCheckEvent_familyId_createdAt_idx" ON "ShoppingItemCheckEvent"("familyId", "createdAt");

-- CreateIndex
CREATE INDEX "ShoppingItemCheckEvent_mealPlanId_createdAt_idx" ON "ShoppingItemCheckEvent"("mealPlanId", "createdAt");

-- CreateIndex
CREATE INDEX "ShoppingItemCheckEvent_actorUserId_idx" ON "ShoppingItemCheckEvent"("actorUserId");

-- AddForeignKey
ALTER TABLE "ShoppingItemCheckEvent" ADD CONSTRAINT "ShoppingItemCheckEvent_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItemCheckEvent" ADD CONSTRAINT "ShoppingItemCheckEvent_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItemCheckEvent" ADD CONSTRAINT "ShoppingItemCheckEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
