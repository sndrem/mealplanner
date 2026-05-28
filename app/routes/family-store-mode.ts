import { redirect } from "react-router";

import { requireUser } from "../lib/auth.server";
import { db } from "../lib/db.server";
import { requireFamilyMembership } from "../lib/family.server";
import { findMealPlanCoveringDate } from "../lib/meal-plan-for-date.server";
import type { Route } from "./+types/family-store-mode";

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

  const todayMealPlan = await findMealPlanCoveringDate({
    familyId,
  });
  const mealPlan =
    todayMealPlan ??
    (await db.mealPlan.findFirst({
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select: { id: true },
      where: { familyId },
    }));

  if (mealPlan) {
    throw redirect(
      `/families/${familyId}/meal-plans/${mealPlan.id}/store-mode`,
    );
  }

  throw redirect(`/families/${familyId}/meal-plans`);
}
