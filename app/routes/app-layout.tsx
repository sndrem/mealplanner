import { Outlet } from "react-router";

import { AppMobileBottomNav } from "../components/app-mobile-bottom-nav";
import { AppTopNav } from "../components/app-top-nav";
import { requireUser } from "../lib/auth.server";
import { getFamilyMembershipsForUser } from "../lib/family.server";
import { countPendingReviewsForUser } from "../lib/meal-plan-share.server";
import type { Route } from "./+types/app-layout";

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await requireUser(request);

  if (params.familyId) {
    const pendingReviewCount = await countPendingReviewsForUser({
      familyId: params.familyId,
      userId: user.id,
    });

    return { familyId: params.familyId, pendingReviewCount };
  }

  const url = new URL(request.url);

  if (url.pathname === "/app") {
    const memberships = await getFamilyMembershipsForUser(user.id);

    if (memberships.length === 1) {
      const familyId = memberships[0].family.id;
      const pendingReviewCount = await countPendingReviewsForUser({
        familyId,
        userId: user.id,
      });

      return { familyId, pendingReviewCount };
    }
  }

  return { familyId: null, pendingReviewCount: 0 };
}

export default function AppLayoutRoute({ loaderData }: Route.ComponentProps) {
  const hasMobileBottomNav = Boolean(loaderData.familyId);

  return (
    <>
      <AppTopNav
        familyId={loaderData.familyId}
        pendingReviewCount={loaderData.pendingReviewCount}
      />
      <div className={hasMobileBottomNav ? "pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0" : undefined}>
        <Outlet />
      </div>
      <AppMobileBottomNav familyId={loaderData.familyId} />
    </>
  );
}
