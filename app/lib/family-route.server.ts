import { requireUser } from "./auth.server";
import { requireFamilyId } from "./require-family-id";

export interface FamilyRouteArgs {
  params: {
    familyId?: string;
  };
  request: Request;
}

export async function requireFamilyRouteUser({
  params,
  request,
}: FamilyRouteArgs) {
  const user = await requireUser(request);

  return {
    familyId: requireFamilyId(params.familyId),
    user,
  };
}

export async function readFamilyRouteForm(args: FamilyRouteArgs) {
  const route = await requireFamilyRouteUser(args);
  const formData = await args.request.formData();

  return {
    ...route,
    formData,
    intent: String(formData.get("intent") ?? ""),
  };
}
