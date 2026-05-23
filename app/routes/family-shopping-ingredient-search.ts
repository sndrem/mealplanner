import { requireUser } from "../lib/auth.server";
import { searchCanonicalIngredients } from "../lib/stock.server";

const MIN_SEARCH_LENGTH = 2;

export async function loader({ request }: { request: Request }) {
  await requireUser(request);

  const searchQuery = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (searchQuery.length < MIN_SEARCH_LENGTH) {
    return {
      ingredientSearchResults: [],
    };
  }

  return {
    ingredientSearchResults: await searchCanonicalIngredients(searchQuery),
  };
}
