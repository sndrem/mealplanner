-- CreateTable
CREATE TABLE "ShoppingListShare" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShoppingListShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShoppingListShare_tokenHash_key" ON "ShoppingListShare"("tokenHash");

-- CreateIndex
CREATE INDEX "ShoppingListShare_familyId_createdAt_idx" ON "ShoppingListShare"("familyId", "createdAt");

-- CreateIndex
CREATE INDEX "ShoppingListShare_createdByUserId_idx" ON "ShoppingListShare"("createdByUserId");

-- AddForeignKey
ALTER TABLE "ShoppingListShare" ADD CONSTRAINT "ShoppingListShare_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingListShare" ADD CONSTRAINT "ShoppingListShare_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
