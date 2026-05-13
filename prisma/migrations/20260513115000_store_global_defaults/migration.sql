-- AlterTable
ALTER TABLE "Store"
ADD COLUMN "key" TEXT,
ALTER COLUMN "familyId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Store_key_key" ON "Store"("key");
