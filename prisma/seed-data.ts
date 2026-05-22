import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

export interface CatalogIngredientSeed {
  name: string;
  categoryKey: IngredientCategoryKey;
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

const ingredientCategoryKeys = new Set<IngredientCategoryKey>(
  ingredientCategorySeeds.map((category) => category.key),
);

const catalogCsvPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "data/catalog-ingredient-seeds.csv",
);

export const storeSeeds: readonly StoreSeed[] = [];

export type StoreKey = string;

export const recipeSeeds: readonly RecipeSeed[] = [];

export function normalizeIngredientCanonicalName(displayName: string) {
  return displayName.trim().toLowerCase();
}

export function loadCatalogIngredientSeeds(
  csvPath: string = catalogCsvPath,
): CatalogIngredientSeed[] {
  return parseCatalogIngredientCsv(readFileSync(csvPath, "utf8"));
}

export function parseCatalogIngredientCsv(content: string): CatalogIngredientSeed[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length === 0) {
    throw new Error("Catalog ingredient seed file is empty.");
  }

  const header = lines[0]?.trim();

  if (header !== "name,categoryKey") {
    throw new Error(
      `Catalog ingredient seed file must start with "name,categoryKey", got "${header ?? ""}".`,
    );
  }

  const catalog: CatalogIngredientSeed[] = [];
  const normalizedNames = new Set<string>();

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const commaIndex = line.lastIndexOf(",");

    if (commaIndex <= 0) {
      throw new Error(`Invalid catalog ingredient row on line ${index + 1}: "${line}".`);
    }

    const name = line.slice(0, commaIndex).trim();
    const categoryKey = line.slice(commaIndex + 1).trim();

    if (!name || !categoryKey) {
      throw new Error(`Invalid catalog ingredient row on line ${index + 1}: "${line}".`);
    }

    if (!isIngredientCategoryKey(categoryKey)) {
      throw new Error(
        `Catalog ingredient "${name}" references unknown category "${categoryKey}".`,
      );
    }

    const normalizedName = normalizeIngredientCanonicalName(name);

    if (normalizedNames.has(normalizedName)) {
      throw new Error(`Catalog ingredient "${name}" is duplicated after normalization.`);
    }

    normalizedNames.add(normalizedName);
    catalog.push({
      name,
      categoryKey,
    });
  }

  return catalog;
}

export const catalogIngredientSeeds = loadCatalogIngredientSeeds();

export function buildIngredientSeeds(
  recipes: readonly RecipeSeed[] = recipeSeeds,
  catalog: readonly CatalogIngredientSeed[] = catalogIngredientSeeds,
): IngredientSeed[] {
  const ingredientsByCanonicalName = new Map<string, IngredientSeed>();

  for (let item of catalog) {
    addIngredientSeed(ingredientsByCanonicalName, {
      canonicalName: item.name.trim(),
      defaultCategoryKey: item.categoryKey,
      normalizedKey: normalizeIngredientCanonicalName(item.name),
      sourceLabel: item.name,
    });
  }

  for (let recipe of recipes) {
    for (let ingredient of recipe.ingredients) {
      const normalizedKey = normalizeIngredientCanonicalName(ingredient.displayName);

      addIngredientSeed(ingredientsByCanonicalName, {
        canonicalName: normalizedKey,
        defaultCategoryKey: ingredient.categoryKey,
        normalizedKey,
        sourceLabel: ingredient.displayName,
      });
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
    catalogIngredientCount: catalogIngredientSeeds.length,
  };
}

function addIngredientSeed(
  ingredientsByCanonicalName: Map<string, IngredientSeed>,
  {
    canonicalName,
    defaultCategoryKey,
    normalizedKey,
    sourceLabel,
  }: {
    canonicalName: string;
    defaultCategoryKey: IngredientCategoryKey;
    normalizedKey: string;
    sourceLabel: string;
  },
) {
  const existing = ingredientsByCanonicalName.get(normalizedKey);

  if (existing && existing.defaultCategoryKey !== defaultCategoryKey) {
    throw new Error(
      `Ingredient "${sourceLabel}" is assigned to multiple categories: ` +
        `"${existing.defaultCategoryKey}" and "${defaultCategoryKey}".`,
    );
  }

  if (!existing) {
    ingredientsByCanonicalName.set(normalizedKey, {
      canonicalName,
      defaultCategoryKey,
    });
  }
}

function isIngredientCategoryKey(
  categoryKey: string,
): categoryKey is IngredientCategoryKey {
  return ingredientCategoryKeys.has(categoryKey as IngredientCategoryKey);
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
