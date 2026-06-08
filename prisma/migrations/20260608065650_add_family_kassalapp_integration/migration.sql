-- CreateTable
CREATE TABLE "FamilyKassalappIntegration" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "encryptedApiToken" TEXT NOT NULL,
    "tokenLastFour" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyKassalappIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FamilyKassalappIntegration_familyId_key" ON "FamilyKassalappIntegration"("familyId");

-- CreateIndex
CREATE INDEX "FamilyKassalappIntegration_updatedByUserId_idx" ON "FamilyKassalappIntegration"("updatedByUserId");

-- AddForeignKey
ALTER TABLE "FamilyKassalappIntegration" ADD CONSTRAINT "FamilyKassalappIntegration_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyKassalappIntegration" ADD CONSTRAINT "FamilyKassalappIntegration_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
