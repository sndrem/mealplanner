import { Outlet } from "react-router";

import { AppMobileBottomNav } from "../components/app-mobile-bottom-nav";
import { AppTopNav } from "../components/app-top-nav";
import { requireUser } from "../lib/auth.server";
import { getFamilyMembershipsForUser } from "../lib/family.server";
import type { Route } from "./+types/app-layout";

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await requireUser(request);

  if (params.familyId) {
    return { familyId: params.familyId };
  }

  const url = new URL(request.url);

  if (url.pathname === "/app") {
    const memberships = await getFamilyMembershipsForUser(user.id);

    if (memberships.length === 1) {
      return { familyId: memberships[0].family.id };
    }
  }

  return { familyId: null };
}

export default function AppLayoutRoute({ loaderData }: Route.ComponentProps) {
  const hasMobileBottomNav = Boolean(loaderData.familyId);

  return (
    <>
      <AppTopNav familyId={loaderData.familyId} />
      <div className={hasMobileBottomNav ? "pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0" : undefined}>
        <Outlet />
      </div>
      <AppMobileBottomNav familyId={loaderData.familyId} />
    </>
  );
}
