import { requireFamilyMembership } from "../lib/family.server";
import {
  requireFamilyRouteUser,
  type FamilyRouteArgs,
} from "../lib/family-route.server";
import { getStoreModeTripRevision } from "../lib/store-mode-trip-revision.server";

export async function loader({ params, request }: FamilyRouteArgs) {
  const { familyId, user } = await requireFamilyRouteUser({ params, request });

  await requireFamilyMembership({
    familyId,
    userId: user.id,
  });

  return {
    revision: await getStoreModeTripRevision(familyId),
  };
}
