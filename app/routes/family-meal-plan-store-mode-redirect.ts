import { redirect } from "react-router";

import { requireUser } from "../lib/auth.server";
import { requireFamilyMembership } from "../lib/family.server";
import type { Route } from "./+types/family-meal-plan-store-mode-redirect";

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const familyId = params.familyId;

  if (!familyId) {
    throw new Response("Fant ikke familien.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  await requireFamilyMembership({
    familyId,
    userId: user.id,
  });

  const url = new URL(request.url);
  url.pathname = `/families/${familyId}/store-mode`;

  throw redirect(`${url.pathname}${url.search}`);
}
