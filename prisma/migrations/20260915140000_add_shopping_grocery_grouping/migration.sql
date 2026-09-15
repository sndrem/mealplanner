-- CreateEnum
CREATE TYPE "ShoppingGroceryGrouping" AS ENUM ('GROUPED', 'SPLIT');

-- AlterTable
ALTER TABLE "UserFamilyShoppingPreference" ADD COLUMN "groceryGrouping" "ShoppingGroceryGrouping" NOT NULL DEFAULT 'GROUPED';
