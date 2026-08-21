-- CreateEnum
CREATE TYPE "StoreModeTripFocus" AS ENUM ('CURRENT', 'NEXT', 'ALL');

-- AlterTable
ALTER TABLE "UserStorePreference" ADD COLUMN "storeModeTripFocus" "StoreModeTripFocus" NOT NULL DEFAULT 'CURRENT';
