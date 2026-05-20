export interface IngredientCategorySeed {
  key: string;
  displayName: string;
}

export interface StoreSeed {
  key: string;
  name: string;
  sectionCategoryKeys: IngredientCategoryKey[];
}

export interface RecipeIngredientSeed {
  key: string;
  displayName: string;
  amount?: string;
  unit?: string;
  categoryKey: IngredientCategoryKey;
  preferredStoreKey?: StoreKey;
}

export interface RecipeSeed {
  id: string;
  title: string;
  description: string;
  prepMinutes: number;
  defaultServings: number;
  tags: string[];
  ingredients: RecipeIngredientSeed[];
}

export interface IngredientSeed {
  canonicalName: string;
  defaultCategoryKey: IngredientCategoryKey;
}

export const ingredientCategorySeeds = [
  { key: "produce", displayName: "Frukt og grønt" },
  { key: "meat-fish", displayName: "Kjøtt og fisk" },
  { key: "dairy", displayName: "Meieri" },
  { key: "pantry", displayName: "Tørrvarer" },
  { key: "frozen", displayName: "Frys" },
  { key: "bakery-bread", displayName: "Bakst og brød" },
  { key: "drinks", displayName: "Drikke" },
  { key: "household", displayName: "Husholdning" },
  { key: "other", displayName: "Annet" },
] as const satisfies readonly IngredientCategorySeed[];

export type IngredientCategoryKey =
  (typeof ingredientCategorySeeds)[number]["key"];

export const storeSeeds: readonly StoreSeed[] = [];

export type StoreKey = string;

export const recipeSeeds: readonly RecipeSeed[] = [];

export function normalizeIngredientCanonicalName(displayName: string) {
  return displayName.trim().toLowerCase();
}

export function buildIngredientSeeds(
  recipes: readonly RecipeSeed[] = recipeSeeds,
): IngredientSeed[] {
  let ingredientsByCanonicalName = new Map<string, IngredientSeed>();

  for (let recipe of recipes) {
    for (let ingredient of recipe.ingredients) {
      let canonicalName = normalizeIngredientCanonicalName(
        ingredient.displayName,
      );
      let existing = ingredientsByCanonicalName.get(canonicalName);

      if (existing && existing.defaultCategoryKey !== ingredient.categoryKey) {
        throw new Error(
          `Ingredient "${ingredient.displayName}" is assigned to multiple categories: ` +
            `"${existing.defaultCategoryKey}" and "${ingredient.categoryKey}".`,
        );
      }

      if (!existing) {
        ingredientsByCanonicalName.set(canonicalName, {
          canonicalName,
          defaultCategoryKey: ingredient.categoryKey,
        });
      }
    }
  }

  return [...ingredientsByCanonicalName.values()];
}

export function validateSeedData() {
  let categoryKeys = new Set(
    ingredientCategorySeeds.map((category) => category.key),
  );
  let storeKeys = new Set(storeSeeds.map((store) => store.key));

  assertUniqueCount(
    categoryKeys,
    ingredientCategorySeeds.length,
    "ingredient categories",
  );
  assertUniqueCount(storeKeys, storeSeeds.length, "stores");
  assertUniqueCount(
    new Set(recipeSeeds.map((recipe) => recipe.id)),
    recipeSeeds.length,
    "recipes",
  );

  for (let store of storeSeeds) {
    assertUniqueCount(
      new Set(store.sectionCategoryKeys),
      store.sectionCategoryKeys.length,
      `store sections for ${store.key}`,
    );

    for (let categoryKey of store.sectionCategoryKeys) {
      if (!categoryKeys.has(categoryKey)) {
        throw new Error(
          `Store "${store.key}" references unknown category "${categoryKey}".`,
        );
      }
    }

    if (store.sectionCategoryKeys.length !== ingredientCategorySeeds.length) {
      throw new Error(
        `Store "${store.key}" must define a section order for every seeded category.`,
      );
    }
  }

  for (let recipe of recipeSeeds) {
    assertUniqueCount(
      new Set(recipe.ingredients.map((ingredient) => ingredient.key)),
      recipe.ingredients.length,
      `ingredients for ${recipe.id}`,
    );

    for (let ingredient of recipe.ingredients) {
      if (!categoryKeys.has(ingredient.categoryKey)) {
        throw new Error(
          `Recipe "${recipe.id}" references unknown category "${ingredient.categoryKey}".`,
        );
      }

      if (
        ingredient.preferredStoreKey &&
        !storeKeys.has(ingredient.preferredStoreKey)
      ) {
        throw new Error(
          `Recipe "${recipe.id}" references unknown preferred store "${ingredient.preferredStoreKey}".`,
        );
      }
    }
  }

  return {
    categoryCount: ingredientCategorySeeds.length,
    ingredientCount: buildIngredientSeeds().length,
    recipeCount: recipeSeeds.length,
    storeCount: storeSeeds.length,
  };
}

function assertUniqueCount(
  values: Set<string>,
  expectedCount: number,
  label: string,
) {
  if (values.size !== expectedCount) {
    throw new Error(`Expected unique ${label}, but found duplicate keys.`);
  }
}
