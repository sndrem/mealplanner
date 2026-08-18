import { requireUser } from "../lib/auth.server";
import { requireFamilyMembership } from "../lib/family.server";
import { searchShoppingQuickAddSuggestions } from "../lib/shopping-catalog.server";

const MIN_SEARCH_LENGTH = 2;

export async function loader({
  params,
  request,
}: {
  params: {
    familyId?: string;
  };
  request: Request;
}) {
  const user = await requireUser(request);
  const familyId = requireFamilyId(params.familyId);

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

function requireFamilyId(familyId: string | undefined) {
  if (!familyId) {
    throw new Response("Fant ikke familien.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  return familyId;
}
