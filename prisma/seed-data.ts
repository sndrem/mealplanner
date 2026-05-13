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

export const storeSeeds = [
  {
    key: "rema-1000",
    name: "Rema 1000",
    sectionCategoryKeys: [
      "produce",
      "meat-fish",
      "bakery-bread",
      "dairy",
      "frozen",
      "pantry",
      "drinks",
      "household",
      "other",
    ],
  },
  {
    key: "coop-obs",
    name: "Coop Obs",
    sectionCategoryKeys: [
      "household",
      "other",
      "bakery-bread",
      "produce",
      "frozen",
      "meat-fish",
      "pantry",
      "dairy",
      "drinks",
    ],
  },
  {
    key: "meny",
    name: "Meny",
    sectionCategoryKeys: [
      "produce",
      "bakery-bread",
      "meat-fish",
      "dairy",
      "pantry",
      "drinks",
      "frozen",
      "household",
      "other",
    ],
  },
] as const satisfies readonly StoreSeed[];

export type StoreKey = (typeof storeSeeds)[number]["key"];

export const recipeSeeds: readonly RecipeSeed[] = [
  {
    id: "kylling-taco",
    title: "Kyllingtaco",
    description: "Rask middagsfavoritt med mye smak og enkel topping.",
    prepMinutes: 25,
    defaultServings: 4,
    tags: ["rask", "barnevennlig", "fredag"],
    ingredients: [
      {
        key: "chicken",
        displayName: "Kyllingfilet",
        amount: "600",
        unit: "g",
        categoryKey: "meat-fish",
      },
      {
        key: "tortillas",
        displayName: "Tortillalefser",
        amount: "2",
        unit: "pk",
        categoryKey: "bakery-bread",
      },
      {
        key: "corn",
        displayName: "Mais",
        amount: "1",
        unit: "boks",
        categoryKey: "pantry",
      },
      {
        key: "lettuce",
        displayName: "Hjertesalat",
        amount: "2",
        unit: "stk",
        categoryKey: "produce",
      },
      {
        key: "tomato",
        displayName: "Tomater",
        amount: "4",
        unit: "stk",
        categoryKey: "produce",
      },
      {
        key: "creme",
        displayName: "Lettromme",
        amount: "1",
        unit: "beger",
        categoryKey: "dairy",
      },
      {
        key: "cheese",
        displayName: "Revet ost",
        amount: "250",
        unit: "g",
        categoryKey: "dairy",
      },
    ],
  },
  {
    id: "tomatsuppe",
    title: "Tomatsuppe med egg",
    description: "Enkel hverdagsmiddag som passer fint pa travle dager.",
    prepMinutes: 20,
    defaultServings: 4,
    tags: ["rask", "rimelig", "vegetar"],
    ingredients: [
      {
        key: "soup",
        displayName: "Tomatsuppe",
        amount: "2",
        unit: "poser",
        categoryKey: "pantry",
      },
      {
        key: "macaroni",
        displayName: "Makaroni",
        amount: "250",
        unit: "g",
        categoryKey: "pantry",
      },
      {
        key: "eggs",
        displayName: "Egg",
        amount: "6",
        unit: "stk",
        categoryKey: "dairy",
      },
      {
        key: "bread",
        displayName: "Grovt brod",
        amount: "1",
        unit: "stk",
        categoryKey: "bakery-bread",
      },
    ],
  },
  {
    id: "pasta-kjottsaus",
    title: "Pasta med kjottsaus",
    description: "Klassiker som gir gode rester til lunsj dagen etter.",
    prepMinutes: 35,
    defaultServings: 4,
    tags: ["familie", "restevennlig"],
    ingredients: [
      {
        key: "mince",
        displayName: "Karbonadedeig",
        amount: "400",
        unit: "g",
        categoryKey: "meat-fish",
      },
      {
        key: "onion",
        displayName: "Gul lok",
        amount: "1",
        unit: "stk",
        categoryKey: "produce",
      },
      {
        key: "garlic",
        displayName: "Hvitlok",
        amount: "2",
        unit: "fedd",
        categoryKey: "produce",
      },
      {
        key: "passata",
        displayName: "Passata",
        amount: "2",
        unit: "flasker",
        categoryKey: "pantry",
      },
      {
        key: "spaghetti",
        displayName: "Spaghetti",
        amount: "500",
        unit: "g",
        categoryKey: "pantry",
      },
      {
        key: "parmesan",
        displayName: "Parmesan",
        amount: "1",
        unit: "bit",
        categoryKey: "dairy",
        preferredStoreKey: "meny",
      },
    ],
  },
  {
    id: "chili-sin-carne",
    title: "Chili sin carne",
    description: "Billig og mettende vegetarrett som er lett a lage mye av.",
    prepMinutes: 30,
    defaultServings: 4,
    tags: ["vegetar", "frysevennlig", "rimelig"],
    ingredients: [
      {
        key: "beans",
        displayName: "Kidneybonner",
        amount: "2",
        unit: "bokser",
        categoryKey: "pantry",
      },
      {
        key: "tomatoes",
        displayName: "Hakkede tomater",
        amount: "2",
        unit: "bokser",
        categoryKey: "pantry",
      },
      {
        key: "pepper",
        displayName: "Paprika",
        amount: "2",
        unit: "stk",
        categoryKey: "produce",
      },
      {
        key: "rice",
        displayName: "Basmatiris",
        amount: "400",
        unit: "g",
        categoryKey: "pantry",
      },
      {
        key: "avocado",
        displayName: "Avokado",
        amount: "2",
        unit: "stk",
        categoryKey: "produce",
      },
      {
        key: "yoghurt",
        displayName: "Gresk yoghurt",
        amount: "1",
        unit: "beger",
        categoryKey: "dairy",
      },
    ],
  },
  {
    id: "laksewraps",
    title: "Laksewraps",
    description:
      "Frisk middag med laks, agurk og urter. Fin til helg eller rask ukedag.",
    prepMinutes: 25,
    defaultServings: 4,
    tags: ["rask", "fisk", "helg"],
    ingredients: [
      {
        key: "salmon",
        displayName: "Laksefilet",
        amount: "600",
        unit: "g",
        categoryKey: "meat-fish",
      },
      {
        key: "wraps",
        displayName: "Wraps",
        amount: "1",
        unit: "pk",
        categoryKey: "bakery-bread",
      },
      {
        key: "cucumber",
        displayName: "Agurk",
        amount: "1",
        unit: "stk",
        categoryKey: "produce",
      },
      {
        key: "mango",
        displayName: "Mango",
        amount: "1",
        unit: "stk",
        categoryKey: "produce",
        preferredStoreKey: "meny",
      },
      {
        key: "cream-cheese",
        displayName: "Kremost",
        amount: "1",
        unit: "beger",
        categoryKey: "dairy",
      },
    ],
  },
  {
    id: "ovnsbakt-laks",
    title: "Ovnsbakt laks med poteter",
    description: "Lett helgemiddag med fa komponenter og lite oppvask.",
    prepMinutes: 35,
    defaultServings: 4,
    tags: ["fisk", "helg", "enkel"],
    ingredients: [
      {
        key: "salmon-portions",
        displayName: "Lakseporsjoner",
        amount: "4",
        unit: "stk",
        categoryKey: "meat-fish",
      },
      {
        key: "potatoes",
        displayName: "Smapoteter",
        amount: "1",
        unit: "pose",
        categoryKey: "produce",
      },
      {
        key: "broccoli",
        displayName: "Brokkoli",
        amount: "2",
        unit: "stk",
        categoryKey: "produce",
      },
      {
        key: "creme-fraiche",
        displayName: "Creme fraiche",
        amount: "1",
        unit: "beger",
        categoryKey: "dairy",
      },
    ],
  },
  {
    id: "kyllinggryte",
    title: "Kremet kyllinggryte",
    description: "God sondagmiddag som ogsa fungerer som restemat mandag.",
    prepMinutes: 40,
    defaultServings: 4,
    tags: ["familie", "helg", "restevennlig"],
    ingredients: [
      {
        key: "chicken-thigh",
        displayName: "Kyllinglar",
        amount: "800",
        unit: "g",
        categoryKey: "meat-fish",
      },
      {
        key: "carrots",
        displayName: "Gulrot",
        amount: "4",
        unit: "stk",
        categoryKey: "produce",
      },
      {
        key: "mushrooms",
        displayName: "Sjampinjong",
        amount: "250",
        unit: "g",
        categoryKey: "produce",
      },
      {
        key: "cream",
        displayName: "Matflote",
        amount: "3",
        unit: "dl",
        categoryKey: "dairy",
      },
      {
        key: "bouillon",
        displayName: "Kyllingbuljong",
        amount: "1",
        unit: "pk",
        categoryKey: "pantry",
      },
      {
        key: "mashed",
        displayName: "Potetmos",
        amount: "1",
        unit: "pk",
        categoryKey: "pantry",
      },
    ],
  },
];

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
