import { requireFamilyMembership } from "../lib/family.server";
import {
  requireFamilyRouteUser,
  type FamilyRouteArgs,
} from "../lib/family-route.server";
import { searchShoppingQuickAddSuggestions } from "../lib/shopping-catalog.server";

const MIN_SEARCH_LENGTH = 2;

export async function loader({ params, request }: FamilyRouteArgs) {
  const { familyId, user } = await requireFamilyRouteUser({ params, request });

  await requireFamilyMembership({
    familyId,
    userId: user.id,
  });

  const searchQuery = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (searchQuery.length < MIN_SEARCH_LENGTH) {
    return {
      ingredientSearchResults: [],
    };
  }

  return {
    ingredientSearchResults: await searchShoppingQuickAddSuggestions({
      familyId,
      query: searchQuery,
    }),
  };
}

