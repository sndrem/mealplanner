export type RecipeSearchFields = {
  description: string | null;
  tags: string[];
  title: string;
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
