import { PrismaClient, RecipeScope } from "@prisma/client";

import {
  buildIngredientSeeds,
  ingredientCategorySeeds,
  normalizeIngredientCanonicalName,
  recipeSeeds,
  storeSeeds,
  validateSeedData,
} from "./seed-data";

const prisma = new PrismaClient();

async function main() {
  const summary = validateSeedData();
  const ingredientSeeds = buildIngredientSeeds();

  await prisma.$transaction(async (tx) => {
    await tx.recipe.deleteMany({
      where: {
        scope: RecipeScope.GLOBAL,
      },
    });
    await tx.store.deleteMany({
      where: {
        familyId: null,
      },
    });

    const categoriesByKey = new Map<string, { id: string; displayName: string }>();

    for (let category of ingredientCategorySeeds) {
      const record = await tx.ingredientCategory.upsert({
        where: { key: category.key },
        update: { displayName: category.displayName },
        create: { key: category.key, displayName: category.displayName },
        select: { id: true, displayName: true },
      });

      categoriesByKey.set(category.key, record);
    }

    const ingredientsByCanonicalName = new Map<string, { id: string }>();

    for (let ingredient of ingredientSeeds) {
      const record = await tx.ingredient.upsert({
        where: { canonicalName: ingredient.canonicalName },
        update: {
          defaultCategoryId: requireMapValue(categoriesByKey, ingredient.defaultCategoryKey, "ingredient category")
            .id,
        },
        create: {
          canonicalName: ingredient.canonicalName,
          defaultCategoryId: requireMapValue(categoriesByKey, ingredient.defaultCategoryKey, "ingredient category")
            .id,
        },
        select: { id: true },
      });

      ingredientsByCanonicalName.set(ingredient.canonicalName, record);
    }

    const storesByKey = new Map<string, { id: string }>();

    for (let store of storeSeeds) {
      const record = await tx.store.upsert({
        where: { key: store.key },
        update: {
          familyId: null,
          name: store.name,
        },
        create: {
          key: store.key,
          name: store.name,
        },
        select: { id: true },
      });

      storesByKey.set(store.key, record);
    }

    for (let store of storeSeeds) {
      let storeRecord = requireMapValue(storesByKey, store.key, "store");

      await tx.storeSection.deleteMany({
        where: { storeId: storeRecord.id },
      });

      await tx.storeSection.createMany({
        data: store.sectionCategoryKeys.map((categoryKey, index) => {
          let category = requireMapValue(categoriesByKey, categoryKey, "store section category");

          return {
            storeId: storeRecord.id,
            categoryId: category.id,
            displayName: category.displayName,
            sortOrder: index,
          };
        }),
      });
    }

    for (let recipe of recipeSeeds) {
      await tx.recipe.upsert({
        where: { id: recipe.id },
        update: {
          scope: RecipeScope.GLOBAL,
          familyId: null,
          createdByUserId: null,
          title: recipe.title,
          description: recipe.description,
          defaultServings: recipe.defaultServings,
          prepMinutes: recipe.prepMinutes,
          tags: [...recipe.tags],
        },
        create: {
          id: recipe.id,
          scope: RecipeScope.GLOBAL,
          title: recipe.title,
          description: recipe.description,
          defaultServings: recipe.defaultServings,
          prepMinutes: recipe.prepMinutes,
          tags: [...recipe.tags],
        },
      });

      await tx.recipeIngredient.deleteMany({
        where: { recipeId: recipe.id },
      });

      await tx.recipeIngredient.createMany({
        data: recipe.ingredients.map((ingredient, index) => ({
          recipeId: recipe.id,
          ingredientId: requireMapValue(
            ingredientsByCanonicalName,
            normalizeIngredientCanonicalName(ingredient.displayName),
            "recipe ingredient",
          ).id,
          displayName: ingredient.displayName,
          amount: ingredient.amount ?? null,
          unit: ingredient.unit ?? null,
          categoryId: requireMapValue(categoriesByKey, ingredient.categoryKey, "recipe ingredient category").id,
          preferredStoreId: ingredient.preferredStoreKey
            ? requireMapValue(storesByKey, ingredient.preferredStoreKey, "preferred store").id
            : null,
          sortOrder: index,
        })),
      });
    }
  });

  console.info(
    `Seeded ${summary.categoryCount} categories, ${summary.ingredientCount} ingredients, ` +
      `${summary.storeCount} stores, and ${summary.recipeCount} recipes.`,
  );
}

function requireMapValue<Value>(map: Map<string, Value>, key: string, label: string): Value {
  let value = map.get(key);

  if (!value) {
    throw new Error(`Missing ${label} for key "${key}".`);
  }

  return value;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
