-- CreateTable
CREATE TABLE "FamilyShoppingItem" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" TEXT,
    "categoryId" TEXT NOT NULL,
    "preferredStoreId" TEXT,
    "note" TEXT,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyShoppingItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FamilyShoppingItem_familyId_idx" ON "FamilyShoppingItem"("familyId");

-- CreateIndex
CREATE INDEX "FamilyShoppingItem_familyId_checked_idx" ON "FamilyShoppingItem"("familyId", "checked");

-- CreateIndex
CREATE INDEX "FamilyShoppingItem_updatedByUserId_idx" ON "FamilyShoppingItem"("updatedByUserId");

-- CreateIndex
CREATE INDEX "FamilyShoppingItem_categoryId_idx" ON "FamilyShoppingItem"("categoryId");

-- CreateIndex
CREATE INDEX "FamilyShoppingItem_preferredStoreId_idx" ON "FamilyShoppingItem"("preferredStoreId");

-- AddForeignKey
ALTER TABLE "FamilyShoppingItem" ADD CONSTRAINT "FamilyShoppingItem_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyShoppingItem" ADD CONSTRAINT "FamilyShoppingItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "IngredientCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyShoppingItem" ADD CONSTRAINT "FamilyShoppingItem_preferredStoreId_fkey" FOREIGN KEY ("preferredStoreId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyShoppingItem" ADD CONSTRAINT "FamilyShoppingItem_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
