import { Prisma, RecipeScope } from "@prisma/client";
import { Client } from "@notionhq/client";

import { db } from "./db.server";
import { env } from "./env.server";
import { normalizeIngredientCanonicalName } from "./ingredient-normalize";

const IMPORT_SOURCE = "NOTION";
const FALLBACK_CATEGORY_KEY = "other";
const FALLBACK_CATEGORY_DISPLAY_NAME = "Annet";

type ImportMode = "DRY_RUN" | "APPLY";

interface NotionImportIssue {
  code: string;
  message: string;
  notionPageId?: string;
}

interface PhaseSummary {
  created: number;
  errors: NotionImportIssue[];
  skipped: number;
  updated: number;
}

export interface NotionImportSummary {
  categories: PhaseSummary;
  ingredients: PhaseSummary;
  mode: ImportMode;
  recipes: PhaseSummary;
}

interface NotionImportInput {
  dryRun: boolean;
  familyId: string;
  userId: string;
}

interface ImportedIngredientRef {
  canonicalName: string;
  categoryId: string | null;
  id: string;
  sourceExternalId: string;
}

interface NormalizedNotionIngredient {
  amountForOne: string | null;
  canonicalName: string;
  categoryDisplayName: string | null;
  categoryKey: string | null;
  displayName: string;
  notionPageId: string;
  unit: string | null;
}

interface ParsedRecipeIngredientRow {
  amount: string | null;
  categoryHint: string | null;
  displayName: string;
  unit: string | null;
}

interface NormalizedNotionRecipe {
  description: string | null;
  ingredientRows: ParsedRecipeIngredientRow[];
  notionPageId: string;
  prepMinutes: number | null;
  servings: number | null;
  tags: string[];
  title: string;
}

function createPhaseSummary(): PhaseSummary {
  return {
    created: 0,
    errors: [],
    skipped: 0,
    updated: 0,
  };
}

function createSummary(mode: ImportMode): NotionImportSummary {
  return {
    categories: createPhaseSummary(),
    ingredients: createPhaseSummary(),
    mode,
    recipes: createPhaseSummary(),
  };
}

function createNotionClient() {
  return new Client({
    auth: env.NOTION_API_TOKEN,
  });
}

export async function validateNotionPayload() {
  const summary = createSummary("DRY_RUN");
  const notion = createNotionClient();
  const ingredients = await fetchAllNotionPages(
    notion,
    env.NOTION_INGREDIENTS_DATABASE_ID,
  );
  const recipes = await fetchAllNotionPages(
    notion,
    env.NOTION_RECIPES_DATABASE_ID,
  );
  const normalizedIngredients = normalizeIngredients(ingredients, summary);
  const ingredientLookupByPageId = buildIngredientLookupByPageId(
    normalizedIngredients,
  );
  normalizeRecipes(recipes, ingredientLookupByPageId, summary);
  const categoryKeys = collectCategoryKeys(normalizedIngredients);

  summary.categories.created = categoryKeys.size;
  summary.ingredients.created = normalizedIngredients.length;
  summary.recipes.created = recipes.length - summary.recipes.skipped;

  return summary;
}

export async function runNotionImport(input: NotionImportInput) {
  const notion = createNotionClient();
  const summary = createSummary(input.dryRun ? "DRY_RUN" : "APPLY");
  const ingredientPages = await fetchAllNotionPages(
    notion,
    env.NOTION_INGREDIENTS_DATABASE_ID,
  );
  const recipePages = await fetchAllNotionPages(
    notion,
    env.NOTION_RECIPES_DATABASE_ID,
  );
  const normalizedIngredients = normalizeIngredients(ingredientPages, summary);
  const ingredientLookupByPageId = buildIngredientLookupByPageId(
    normalizedIngredients,
  );
  const normalizedRecipes = normalizeRecipes(
    recipePages,
    ingredientLookupByPageId,
    summary,
  );
  const categoryKeys = collectCategoryKeys(normalizedIngredients);

  if (input.dryRun) {
    summary.categories.created = categoryKeys.size;
    summary.ingredients.created = normalizedIngredients.length;
    summary.recipes.created = normalizedRecipes.length;
    return summary;
  }

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const categoryMap = await importCategories(tx, [...categoryKeys], summary);
    const importedIngredients = await importIngredients(
      tx,
      normalizedIngredients,
      categoryMap,
      summary,
    );
    await importRecipes(
      tx,
      normalizedRecipes,
      importedIngredients,
      categoryMap,
      input,
      summary,
    );
  });

  return summary;
}

async function fetchAllNotionPages(client: Client, databaseId: string) {
  const pages: Array<Record<string, any>> = [];
  let cursor: string | undefined = undefined;
  const queryApi:
    | ((params: {
        data_source_id?: string;
        database_id?: string;
        start_cursor?: string;
      }) => Promise<{
        has_more: boolean;
        next_cursor: string | null;
        results: Array<{ object: string }>;
      }>)
    | null =
    ((client as unknown as { dataSources?: { query?: unknown } }).dataSources
      ?.query as (params: {
      data_source_id?: string;
      database_id?: string;
      start_cursor?: string;
    }) => Promise<{
      has_more: boolean;
      next_cursor: string | null;
      results: Array<{ object: string }>;
    }>) ??
    ((client as unknown as { databases?: { query?: unknown } }).databases
      ?.query as (params: {
      data_source_id?: string;
      database_id?: string;
      start_cursor?: string;
    }) => Promise<{
      has_more: boolean;
      next_cursor: string | null;
      results: Array<{ object: string }>;
    }>) ??
    null;

  if (!queryApi) {
    throw new Error("Notion client does not expose a query API.");
  }

  do {
    const response = await queryApi({
      data_source_id: databaseId,
      start_cursor: cursor,
    });

    for (const result of response.results) {
      if (result.object === "page") {
        pages.push(result as Record<string, any>);
      }
    }

    cursor = response.has_more
      ? (response.next_cursor ?? undefined)
      : undefined;
  } while (cursor);

  return pages;
}

function normalizeIngredients(
  pages: Array<Record<string, any>>,
  summary: NotionImportSummary,
) {
  const normalized: NormalizedNotionIngredient[] = [];
  const seenCanonicalNames = new Set<string>();

  for (const page of pages) {
    const title =
      getTitleProperty(page, ["Name", "Ingredient", "Title"]) ??
      getRichTextProperty(page, ["Name", "Ingredient", "Title"]);

    if (!title) {
      summary.ingredients.skipped += 1;
      summary.ingredients.errors.push({
        code: "MISSING_INGREDIENT_NAME",
        message: "Ingredient page is missing a title/name field.",
        notionPageId: page.id,
      });
      continue;
    }

    const canonicalName = normalizeIngredientCanonicalName(title);

    if (!canonicalName) {
      summary.ingredients.skipped += 1;
      summary.ingredients.errors.push({
        code: "INVALID_INGREDIENT_NAME",
        message: "Ingredient canonical name is empty after normalization.",
        notionPageId: page.id,
      });
      continue;
    }

    if (seenCanonicalNames.has(canonicalName)) {
      summary.ingredients.skipped += 1;
      summary.ingredients.errors.push({
        code: "DUPLICATE_CANONICAL_INGREDIENT",
        message: `Duplicate canonical ingredient "${canonicalName}" in Notion payload.`,
        notionPageId: page.id,
      });
      continue;
    }

    seenCanonicalNames.add(canonicalName);
    const categoryText =
      getSelectProperty(page, ["Category", "Kategori"]) ??
      getRichTextProperty(page, ["Category", "Kategori"]);

    normalized.push({
      amountForOne: getNumberPropertyAsString(page, ["Quantity for 1"]) ?? null,
      canonicalName,
      categoryDisplayName: categoryText ?? null,
      categoryKey: categoryText ? toCategoryKey(categoryText) : null,
      displayName: title,
      notionPageId: page.id,
      unit: getSelectProperty(page, ["Unit"]) ?? null,
    });
  }

  return normalized;
}

function buildIngredientLookupByPageId(
  ingredients: NormalizedNotionIngredient[],
) {
  const lookup = new Map<string, NormalizedNotionIngredient>();

  for (const ingredient of ingredients) {
    lookup.set(ingredient.notionPageId, ingredient);
  }

  return lookup;
}

function normalizeRecipes(
  pages: Array<Record<string, any>>,
  ingredientLookupByPageId: Map<string, NormalizedNotionIngredient>,
  summary: NotionImportSummary,
) {
  const normalized: NormalizedNotionRecipe[] = [];

  for (const page of pages) {
    const title =
      getTitleProperty(page, ["Name", "Recipe", "Title"]) ??
      getRichTextProperty(page, ["Name", "Recipe", "Title"]);
    const ingredientRelations = getRelationProperty(page, [
      "Ingredients",
      "Ingredienser",
    ]);
    const ingredientRowsText = getRichTextProperty(page, [
      "Ingredient Rows",
      "IngredientRows",
      "Ingredients",
      "Ingredienser",
    ]);

    if (!title) {
      summary.recipes.skipped += 1;
      summary.recipes.errors.push({
        code: "MISSING_RECIPE_TITLE",
        message: "Recipe page is missing a title/name field.",
        notionPageId: page.id,
      });
      continue;
    }

    if (ingredientRelations.length === 0 && !ingredientRowsText) {
      summary.recipes.skipped += 1;
      summary.recipes.errors.push({
        code: "MISSING_RECIPE_INGREDIENTS",
        message: `Recipe "${title}" is missing ingredient relations or ingredient rows text.`,
        notionPageId: page.id,
      });
      continue;
    }

    const ingredientRows =
      ingredientRelations.length > 0
        ? parseRecipeIngredientRelations(
            ingredientRelations,
            ingredientLookupByPageId,
          )
        : parseRecipeIngredientRows(ingredientRowsText ?? "");

    if (ingredientRows.length === 0) {
      summary.recipes.skipped += 1;
      summary.recipes.errors.push({
        code: "EMPTY_RECIPE_INGREDIENTS",
        message: `Recipe "${title}" has no valid ingredient rows.`,
        notionPageId: page.id,
      });
      continue;
    }

    normalized.push({
      description: getRichTextProperty(page, ["Description", "Beskrivelse"]),
      ingredientRows,
      notionPageId: page.id,
      prepMinutes: getNumberProperty(page, [
        "Prep Minutes",
        "Prep",
        "Prep Time",
      ]),
      servings: getNumberProperty(page, [
        "Servings",
        "Default Servings",
        "Porsjoner",
      ]),
      tags: getMultiSelectProperty(page, ["Tags", "Etiketter"]),
      title,
    });
  }

  return normalized;
}

function collectCategoryKeys(ingredients: NormalizedNotionIngredient[]) {
  const keys = new Set<string>();

  for (const ingredient of ingredients) {
    if (ingredient.categoryKey) {
      keys.add(ingredient.categoryKey);
    }
  }

  keys.add(FALLBACK_CATEGORY_KEY);

  return keys;
}

async function importCategories(
  tx: Prisma.TransactionClient,
  categoryKeys: string[],
  summary: NotionImportSummary,
) {
  const existingCategories = await tx.ingredientCategory.findMany({
    select: {
      id: true,
      key: true,
    },
  });
  const categoryMap = new Map(
    existingCategories.map((category) => [category.key, category.id]),
  );

  for (const key of categoryKeys) {
    if (categoryMap.has(key)) {
      continue;
    }

    const created = await tx.ingredientCategory.create({
      data: {
        displayName:
          key === FALLBACK_CATEGORY_KEY ? FALLBACK_CATEGORY_DISPLAY_NAME : key,
        key,
      },
      select: {
        id: true,
        key: true,
      },
    });
    categoryMap.set(created.key, created.id);
    summary.categories.created += 1;
  }

  return categoryMap;
}

async function importIngredients(
  tx: Prisma.TransactionClient,
  ingredients: NormalizedNotionIngredient[],
  categoryMap: Map<string, string>,
  summary: NotionImportSummary,
) {
  const imported = new Map<string, ImportedIngredientRef>();

  for (const ingredient of ingredients) {
    const categoryKey = ingredient.categoryKey ?? FALLBACK_CATEGORY_KEY;
    const categoryId = categoryMap.get(categoryKey);

    if (!categoryId) {
      summary.ingredients.skipped += 1;
      summary.ingredients.errors.push({
        code: "UNKNOWN_CATEGORY",
        message: `Ingredient "${ingredient.canonicalName}" could not resolve category "${categoryKey}".`,
        notionPageId: ingredient.notionPageId,
      });
      continue;
    }

    const existingBySource = await tx.ingredient.findFirst({
      select: {
        canonicalName: true,
        id: true,
      },
      where: {
        source: IMPORT_SOURCE,
        sourceExternalId: ingredient.notionPageId,
      },
    });

    if (existingBySource) {
      const updated = await tx.ingredient.update({
        data: {
          canonicalName: ingredient.canonicalName,
          defaultCategoryId: categoryId,
        },
        where: {
          id: existingBySource.id,
        },
        select: {
          canonicalName: true,
          defaultCategoryId: true,
          id: true,
          sourceExternalId: true,
        },
      });
      imported.set(updated.canonicalName, {
        canonicalName: updated.canonicalName,
        categoryId: updated.defaultCategoryId ?? null,
        id: updated.id,
        sourceExternalId: updated.sourceExternalId ?? ingredient.notionPageId,
      });
      summary.ingredients.updated += 1;
      continue;
    }

    const existingByCanonical = await tx.ingredient.findUnique({
      select: {
        id: true,
      },
      where: {
        canonicalName: ingredient.canonicalName,
      },
    });

    const upserted = existingByCanonical
      ? await tx.ingredient.update({
          data: {
            defaultCategoryId: categoryId,
            source: IMPORT_SOURCE,
            sourceExternalId: ingredient.notionPageId,
          },
          where: {
            id: existingByCanonical.id,
          },
          select: {
            canonicalName: true,
            defaultCategoryId: true,
            id: true,
            sourceExternalId: true,
          },
        })
      : await tx.ingredient.create({
          data: {
            canonicalName: ingredient.canonicalName,
            defaultCategoryId: categoryId,
            source: IMPORT_SOURCE,
            sourceExternalId: ingredient.notionPageId,
          },
          select: {
            canonicalName: true,
            defaultCategoryId: true,
            id: true,
            sourceExternalId: true,
          },
        });

    imported.set(upserted.canonicalName, {
      canonicalName: upserted.canonicalName,
      categoryId: upserted.defaultCategoryId ?? null,
      id: upserted.id,
      sourceExternalId: upserted.sourceExternalId ?? ingredient.notionPageId,
    });

    if (existingByCanonical) {
      summary.ingredients.updated += 1;
    } else {
      summary.ingredients.created += 1;
    }
  }

  return imported;
}

async function importRecipes(
  tx: Prisma.TransactionClient,
  recipes: NormalizedNotionRecipe[],
  importedIngredients: Map<string, ImportedIngredientRef>,
  categoryMap: Map<string, string>,
  input: NotionImportInput,
  summary: NotionImportSummary,
) {
  const fallbackCategoryId = categoryMap.get(FALLBACK_CATEGORY_KEY);

  if (!fallbackCategoryId) {
    throw new Error("Missing fallback ingredient category for recipe import.");
  }

  for (const recipe of recipes) {
    const mappedIngredients: Array<{
      amount: string | null;
      categoryId: string;
      displayName: string;
      ingredientId: string | null;
      sortOrder: number;
      unit: string | null;
    }> = [];

    for (const [index, row] of recipe.ingredientRows.entries()) {
      const canonicalName = normalizeIngredientCanonicalName(row.displayName);
      let ingredient = importedIngredients.get(canonicalName) ?? null;

      if (!ingredient) {
        const createdIngredient = await tx.ingredient.upsert({
          create: {
            canonicalName,
            defaultCategoryId: fallbackCategoryId,
          },
          update: {
            defaultCategoryId: fallbackCategoryId,
          },
          where: {
            canonicalName,
          },
          select: {
            canonicalName: true,
            defaultCategoryId: true,
            id: true,
            sourceExternalId: true,
          },
        });
        ingredient = {
          canonicalName: createdIngredient.canonicalName,
          categoryId: createdIngredient.defaultCategoryId ?? fallbackCategoryId,
          id: createdIngredient.id,
          sourceExternalId: createdIngredient.sourceExternalId ?? "",
        };
        importedIngredients.set(canonicalName, ingredient);
      }

      const categoryId = resolveCategoryIdForRow({
        categoryMap,
        fallbackCategoryId,
        ingredient,
        row,
      });

      mappedIngredients.push({
        amount: row.amount,
        categoryId,
        displayName: row.displayName,
        ingredientId: ingredient.id,
        sortOrder: index + 1,
        unit: row.unit,
      });
    }

    const existingRecipe = await tx.recipe.findFirst({
      select: {
        id: true,
      },
      where: {
        familyId: input.familyId,
        source: IMPORT_SOURCE,
        sourceExternalId: recipe.notionPageId,
      },
    });

    if (!existingRecipe) {
      await tx.recipe.create({
        data: {
          createdByUserId: input.userId,
          defaultServings: recipe.servings ?? 2,
          description: recipe.description,
          familyId: input.familyId,
          ingredients: {
            create: mappedIngredients,
          },
          prepMinutes: recipe.prepMinutes ?? 45,
          scope: RecipeScope.FAMILY,
          source: IMPORT_SOURCE,
          sourceExternalId: recipe.notionPageId,
          tags: recipe.tags,
          title: recipe.title,
        },
      });
      summary.recipes.created += 1;
      continue;
    }

    await tx.recipe.update({
      data: {
        createdByUserId: input.userId,
        defaultServings: recipe.servings ?? 2,
        description: recipe.description,
        prepMinutes: recipe.prepMinutes ?? 45,
        tags: recipe.tags,
        title: recipe.title,
      },
      where: {
        id: existingRecipe.id,
      },
    });
    await tx.recipeIngredient.deleteMany({
      where: {
        recipeId: existingRecipe.id,
      },
    });
    await tx.recipeIngredient.createMany({
      data: mappedIngredients.map((ingredient) => ({
        amount: ingredient.amount,
        categoryId: ingredient.categoryId,
        displayName: ingredient.displayName,
        ingredientId: ingredient.ingredientId,
        recipeId: existingRecipe.id,
        sortOrder: ingredient.sortOrder,
        unit: ingredient.unit,
      })),
    });
    summary.recipes.updated += 1;
  }
}

function resolveCategoryIdForRow({
  categoryMap,
  fallbackCategoryId,
  ingredient,
  row,
}: {
  categoryMap: Map<string, string>;
  fallbackCategoryId: string;
  ingredient: ImportedIngredientRef;
  row: ParsedRecipeIngredientRow;
}) {
  if (row.categoryHint) {
    const hintedCategory = categoryMap.get(toCategoryKey(row.categoryHint));

    if (hintedCategory) {
      return hintedCategory;
    }
  }

  return ingredient.categoryId ?? fallbackCategoryId;
}

function parseRecipeIngredientRows(rawText: string) {
  const rows: ParsedRecipeIngredientRow[] = [];
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const parts = line.split("|").map((part) => part.trim());
    const displayName = parts[0] ?? "";

    if (!displayName) {
      continue;
    }

    rows.push({
      amount: parts[1] ? parts[1] : null,
      categoryHint: parts[3] ? parts[3] : null,
      displayName,
      unit: parts[2] ? parts[2] : null,
    });
  }

  return rows;
}

function parseRecipeIngredientRelations(
  relationIds: string[],
  ingredientLookupByPageId: Map<string, NormalizedNotionIngredient>,
) {
  const rows: ParsedRecipeIngredientRow[] = [];

  for (const relationId of relationIds) {
    const ingredient = ingredientLookupByPageId.get(relationId);

    if (!ingredient) {
      continue;
    }

    rows.push({
      amount: ingredient.amountForOne,
      categoryHint: ingredient.categoryDisplayName,
      displayName: ingredient.displayName,
      unit: ingredient.unit,
    });
  }

  return rows;
}

function getProperty(page: Record<string, any>, candidateNames: string[]) {
  const properties = (page.properties ?? {}) as Record<string, any>;

  for (const candidate of candidateNames) {
    if (properties[candidate]) {
      return properties[candidate];
    }
  }

  return null;
}

function getTitleProperty(page: Record<string, any>, candidateNames: string[]) {
  const property = getProperty(page, candidateNames);

  if (!property || property.type !== "title") {
    return null;
  }

  return joinRichText(property.title);
}

function getRichTextProperty(
  page: Record<string, any>,
  candidateNames: string[],
) {
  const property = getProperty(page, candidateNames);

  if (!property) {
    return null;
  }

  if (property.type === "rich_text") {
    return joinRichText(property.rich_text);
  }

  if (property.type === "title") {
    return joinRichText(property.title);
  }

  return null;
}

function getSelectProperty(
  page: Record<string, any>,
  candidateNames: string[],
) {
  const property = getProperty(page, candidateNames);

  if (!property || property.type !== "select" || !property.select) {
    return null;
  }

  return String(property.select.name ?? "").trim() || null;
}

function getRelationProperty(page: Record<string, any>, candidateNames: string[]) {
  const property = getProperty(page, candidateNames);

  if (!property || property.type !== "relation" || !Array.isArray(property.relation)) {
    return [];
  }

  return property.relation
    .map((entry: { id?: string }) => String(entry.id ?? "").trim())
    .filter(Boolean);
}

function getNumberProperty(
  page: Record<string, any>,
  candidateNames: string[],
) {
  const property = getProperty(page, candidateNames);

  if (
    !property ||
    property.type !== "number" ||
    typeof property.number !== "number"
  ) {
    return null;
  }

  return Number.isFinite(property.number)
    ? Math.max(0, Math.trunc(property.number))
    : null;
}

function getNumberPropertyAsString(
  page: Record<string, any>,
  candidateNames: string[],
) {
  const numberValue = getNumberProperty(page, candidateNames);

  if (numberValue === null) {
    return null;
  }

  return String(numberValue);
}

function getMultiSelectProperty(
  page: Record<string, any>,
  candidateNames: string[],
) {
  const property = getProperty(page, candidateNames);

  if (!property) {
    return [];
  }

  if (property.type === "multi_select") {
    return property.multi_select
      .map((entry: { name?: string }) => String(entry.name ?? "").trim())
      .filter(Boolean);
  }

  if (property.type === "select" && property.select?.name) {
    return [String(property.select.name).trim()];
  }

  if (property.type === "rich_text") {
    const value = joinRichText(property.rich_text);

    if (!value) {
      return [];
    }

    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function joinRichText(entries: Array<{ plain_text?: string }>) {
  return entries
    .map((entry) => String(entry.plain_text ?? ""))
    .join("")
    .trim();
}

function toCategoryKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
