-- Add optional source tracking for external imports.
ALTER TABLE "Ingredient"
ADD COLUMN "source" TEXT,
ADD COLUMN "sourceExternalId" TEXT;

ALTER TABLE "Recipe"
ADD COLUMN "source" TEXT,
ADD COLUMN "sourceExternalId" TEXT;

CREATE INDEX "Ingredient_source_idx" ON "Ingredient"("source");
CREATE UNIQUE INDEX "Ingredient_source_sourceExternalId_key"
ON "Ingredient"("source", "sourceExternalId");

CREATE INDEX "Recipe_source_idx" ON "Recipe"("source");
CREATE UNIQUE INDEX "Recipe_familyId_source_sourceExternalId_key"
ON "Recipe"("familyId", "source", "sourceExternalId");
