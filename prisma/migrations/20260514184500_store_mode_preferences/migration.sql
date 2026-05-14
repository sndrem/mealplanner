-- AlterTable
ALTER TABLE "MealPlan"
ADD COLUMN "activeShoppingDate" DATE;

-- CreateTable
CREATE TABLE "UserStorePreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "selectedStoreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStorePreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserStorePreference_userId_familyId_key" ON "UserStorePreference"("userId", "familyId");

-- CreateIndex
CREATE INDEX "UserStorePreference_userId_idx" ON "UserStorePreference"("userId");

-- CreateIndex
CREATE INDEX "UserStorePreference_familyId_idx" ON "UserStorePreference"("familyId");

-- CreateIndex
CREATE INDEX "UserStorePreference_selectedStoreId_idx" ON "UserStorePreference"("selectedStoreId");

-- AddForeignKey
ALTER TABLE "UserStorePreference"
ADD CONSTRAINT "UserStorePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStorePreference"
ADD CONSTRAINT "UserStorePreference_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStorePreference"
ADD CONSTRAINT "UserStorePreference_selectedStoreId_fkey" FOREIGN KEY ("selectedStoreId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
