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
