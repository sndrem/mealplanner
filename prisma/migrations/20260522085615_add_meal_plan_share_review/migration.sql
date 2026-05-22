-- CreateEnum
CREATE TYPE "MealPlanShareStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "MealPlanShareRecipientStatus" AS ENUM ('PENDING', 'VIEWED', 'RESPONDED');

-- CreateEnum
CREATE TYPE "MealPlanReviewQuickResponse" AS ENUM ('RECENTLY_HAD', 'FISH_AGAIN', 'YES');

-- CreateTable
CREATE TABLE "MealPlanShare" (
    "id" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "sharedByUserId" TEXT NOT NULL,
    "message" TEXT,
    "status" "MealPlanShareStatus" NOT NULL DEFAULT 'OPEN',
    "wholeFamily" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlanShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlanShareRecipient" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MealPlanShareRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "viewedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlanShareRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlanReviewComment" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "quickResponse" "MealPlanReviewQuickResponse",
    "body" TEXT,
    "addressedAt" TIMESTAMP(3),
    "addressedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlanReviewComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealPlanShare_mealPlanId_status_idx" ON "MealPlanShare"("mealPlanId", "status");

-- CreateIndex
CREATE INDEX "MealPlanShare_sharedByUserId_idx" ON "MealPlanShare"("sharedByUserId");

-- CreateIndex
CREATE INDEX "MealPlanShareRecipient_userId_status_idx" ON "MealPlanShareRecipient"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MealPlanShareRecipient_shareId_userId_key" ON "MealPlanShareRecipient"("shareId", "userId");

-- CreateIndex
CREATE INDEX "MealPlanReviewComment_mealPlanId_date_idx" ON "MealPlanReviewComment"("mealPlanId", "date");

-- CreateIndex
CREATE INDEX "MealPlanReviewComment_shareId_idx" ON "MealPlanReviewComment"("shareId");

-- CreateIndex
CREATE UNIQUE INDEX "MealPlanReviewComment_shareId_authorUserId_date_key" ON "MealPlanReviewComment"("shareId", "authorUserId", "date");

-- AddForeignKey
ALTER TABLE "MealPlanShare" ADD CONSTRAINT "MealPlanShare_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanShare" ADD CONSTRAINT "MealPlanShare_sharedByUserId_fkey" FOREIGN KEY ("sharedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanShareRecipient" ADD CONSTRAINT "MealPlanShareRecipient_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "MealPlanShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanShareRecipient" ADD CONSTRAINT "MealPlanShareRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanReviewComment" ADD CONSTRAINT "MealPlanReviewComment_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "MealPlanShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanReviewComment" ADD CONSTRAINT "MealPlanReviewComment_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanReviewComment" ADD CONSTRAINT "MealPlanReviewComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanReviewComment" ADD CONSTRAINT "MealPlanReviewComment_addressedByUserId_fkey" FOREIGN KEY ("addressedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
