-- CreateEnum
CREATE TYPE "FamilyShoppingListMode" AS ENUM ('GLOBAL', 'COMBINED');

-- CreateTable
CREATE TABLE "UserFamilyShoppingPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "listMode" "FamilyShoppingListMode" NOT NULL DEFAULT 'GLOBAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFamilyShoppingPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserFamilyShoppingPreference_userId_familyId_key" ON "UserFamilyShoppingPreference"("userId", "familyId");

-- CreateIndex
CREATE INDEX "UserFamilyShoppingPreference_userId_idx" ON "UserFamilyShoppingPreference"("userId");

-- CreateIndex
CREATE INDEX "UserFamilyShoppingPreference_familyId_idx" ON "UserFamilyShoppingPreference"("familyId");

-- AddForeignKey
ALTER TABLE "UserFamilyShoppingPreference" ADD CONSTRAINT "UserFamilyShoppingPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFamilyShoppingPreference" ADD CONSTRAINT "UserFamilyShoppingPreference_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
