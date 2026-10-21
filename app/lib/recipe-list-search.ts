export type RecipeSearchFields = {
  description: string | null;
  tags: string[];
  title: string;
};

export type RecipePickerFields = RecipeSearchFields & {
  id: string;
};

export function normalizeRecipeSearchQuery(query: string): string {
  return query.trim();
}

export function recipeMatchesSearch(
  recipe: RecipeSearchFields,
  query: string,
): boolean {
  const normalizedQuery = normalizeRecipeSearchQuery(query);

  if (normalizedQuery.length === 0) {
    return true;
  }

  const needle = normalizedQuery.toLowerCase();
  const haystacks = [
    recipe.title,
    recipe.description ?? "",
    ...recipe.tags,
  ];

  return haystacks.some((value) => value.toLowerCase().includes(needle));
}

export function filterRecipeList<T extends RecipeSearchFields>(
  recipes: T[],
  query: string,
): T[] {
  return recipes.filter((recipe) => recipeMatchesSearch(recipe, query));
}

export function hasActiveRecipeSearch(query: string): boolean {
  return normalizeRecipeSearchQuery(query).length > 0;
}

export function recipeMatchesTags(
  recipe: { tags: string[] },
  selectedTags: string[],
): boolean {
  if (selectedTags.length === 0) {
    return true;
  }

  const tagSet = new Set(recipe.tags.map((tag) => tag.trim()).filter(Boolean));

  return selectedTags.every((tag) => tagSet.has(tag));
}

export function filterRecipesByTags<T extends { tags: string[] }>(
  recipes: T[],
  selectedTags: string[],
): T[] {
  return recipes.filter((recipe) => recipeMatchesTags(recipe, selectedTags));
}

export function filterRecipePickerList<T extends RecipePickerFields>(
  recipes: T[],
  {
    query,
    selectedTags,
  }: {
    query: string;
    selectedTags: string[];
  },
): T[] {
  return filterRecipesByTags(filterRecipeList(recipes, query), selectedTags);
}

export function deriveRecipeTagOptions(
  recipes: Array<{ tags: string[] }>,
): Array<{ count: number; tag: string }> {
  const counts = new Map<string, number>();

  for (const recipe of recipes) {
    for (const rawTag of recipe.tags) {
      const tag = rawTag.trim();

      if (!tag) {
        continue;
      }

      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ count, tag }))
    .sort((left, right) => left.tag.localeCompare(right.tag, "nb"));
}

const RECIPE_LIST_QUERY_PARAM = "q";
const RECIPE_LIST_TAG_PARAM = "tag";

export type RecipeListFilter = {
  query: string;
  selectedTags: string[];
};

function recipeListSearchParams(search: string): URLSearchParams {
  const value = search.startsWith("?") ? search.slice(1) : search;

  return new URLSearchParams(value);
}

function knownRecipeTags(recipes: Array<{ tags: string[] }>): Set<string> {
  const tags = new Set<string>();

  for (const recipe of recipes) {
    for (const rawTag of recipe.tags) {
      const tag = rawTag.trim();

      if (tag) {
        tags.add(tag);
      }
    }
  }

  return tags;
}

export function withRecipeListFilter(
  search: string,
  filter: RecipeListFilter,
): string {
  const params = recipeListSearchParams(search);

  params.delete(RECIPE_LIST_QUERY_PARAM);
  params.delete(RECIPE_LIST_TAG_PARAM);

  if (filter.query.length > 0) {
    params.set(RECIPE_LIST_QUERY_PARAM, filter.query);
  }

  const seen = new Set<string>();

  for (const tag of filter.selectedTags) {
    if (seen.has(tag)) {
      continue;
    }

    seen.add(tag);
    params.append(RECIPE_LIST_TAG_PARAM, tag);
  }

  const next = params.toString();

  return next.length > 0 ? `?${next}` : "";
}

export function resolveRecipeListFilter(
  search: string,
  recipes: Array<{ tags: string[] }>,
): RecipeListFilter & { search: string } {
  const params = recipeListSearchParams(search);
  const query = params.get(RECIPE_LIST_QUERY_PARAM) ?? "";
  const knownTags = knownRecipeTags(recipes);
  const selectedTags: string[] = [];
  const seen = new Set<string>();

  for (const tag of params.getAll(RECIPE_LIST_TAG_PARAM)) {
    if (!knownTags.has(tag) || seen.has(tag)) {
      continue;
    }

    seen.add(tag);
    selectedTags.push(tag);
  }

  return {
    query,
    search: withRecipeListFilter(search, { query, selectedTags }),
    selectedTags,
  };
}

export function recipeCatalogReloadSkipped(current: URL, next: URL): boolean {
  if (current.pathname !== next.pathname) {
    return false;
  }

  const currentParams = new URLSearchParams(current.searchParams);
  const nextParams = new URLSearchParams(next.searchParams);

  currentParams.delete(RECIPE_LIST_QUERY_PARAM);
  currentParams.delete(RECIPE_LIST_TAG_PARAM);
  nextParams.delete(RECIPE_LIST_QUERY_PARAM);
  nextParams.delete(RECIPE_LIST_TAG_PARAM);
  currentParams.sort();
  nextParams.sort();

  return currentParams.toString() === nextParams.toString();
}

export function visibleFamilyRecipes<
  T extends RecipePickerFields,
  P extends RecipePickerFields,
>(
  recipes: T[],
  filter: RecipeListFilter,
  pending: P | null,
): Array<T | P> {
  const filtered = filterRecipePickerList(recipes, filter);

  if (!pending) {
    return filtered;
  }

  return [pending, ...filtered];
}

export function groupRecipePickerResults<T extends { id: string }>(
  recipes: T[],
  {
    currentRecipeId,
    inPlanRecipeIds,
    recentlyUsedRecipeIds,
  }: {
    currentRecipeId?: string;
    inPlanRecipeIds: ReadonlySet<string>;
    recentlyUsedRecipeIds: ReadonlySet<string>;
  },
): {
  inPlan: T[];
  other: T[];
  recentlyUsed: T[];
} {
  const inPlan: T[] = [];
  const recentlyUsed: T[] = [];
  const other: T[] = [];

  for (const recipe of recipes) {
    const isCurrent = recipe.id === currentRecipeId;

    if (!isCurrent && inPlanRecipeIds.has(recipe.id)) {
      inPlan.push(recipe);
      continue;
    }

    if (recentlyUsedRecipeIds.has(recipe.id)) {
      recentlyUsed.push(recipe);
      continue;
    }

    other.push(recipe);
  }

  return { inPlan, other, recentlyUsed };
}
