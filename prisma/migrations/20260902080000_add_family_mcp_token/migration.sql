-- CreateTable
CREATE TABLE "FamilyMcpToken" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyMcpToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMcpToken_familyId_key" ON "FamilyMcpToken"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMcpToken_tokenHash_key" ON "FamilyMcpToken"("tokenHash");

-- CreateIndex
CREATE INDEX "FamilyMcpToken_createdByUserId_idx" ON "FamilyMcpToken"("createdByUserId");

-- AddForeignKey
ALTER TABLE "FamilyMcpToken" ADD CONSTRAINT "FamilyMcpToken_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMcpToken" ADD CONSTRAINT "FamilyMcpToken_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
