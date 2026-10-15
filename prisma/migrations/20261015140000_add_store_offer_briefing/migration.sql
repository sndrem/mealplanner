-- CreateTable
CREATE TABLE "StoreOfferBriefing" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "weekEnd" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "publishedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreOfferBriefing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreOfferBriefing_familyId_weekStart_key" ON "StoreOfferBriefing"("familyId", "weekStart");

-- CreateIndex
CREATE INDEX "StoreOfferBriefing_familyId_idx" ON "StoreOfferBriefing"("familyId");

-- CreateIndex
CREATE INDEX "StoreOfferBriefing_publishedByUserId_idx" ON "StoreOfferBriefing"("publishedByUserId");

-- AddForeignKey
ALTER TABLE "StoreOfferBriefing" ADD CONSTRAINT "StoreOfferBriefing_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOfferBriefing" ADD CONSTRAINT "StoreOfferBriefing_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
