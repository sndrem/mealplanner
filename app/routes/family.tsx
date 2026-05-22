import { Form, Link, isRouteErrorResponse, useNavigation } from "react-router";

import type { Route } from "./+types/family";
import { requireUser } from "../lib/auth.server";
import {
  listFamilyMembers,
  removeFamilyMember,
  requireFamilyMembership,
} from "../lib/family.server";

type FamilyNotice = "member-removed";

interface FamilyActionData {
  formError?: string;
  targetUserId?: string;
}

function getFamilyNotice(request: Request): FamilyNotice | null {
  const notice = new URL(request.url).searchParams.get("notice");

  if (notice === "member-removed") {
    return notice;
  }

  return null;
}

function buildFamilyRedirect({
  request,
  familyId,
  notice,
}: {
  request: Request;
  familyId: string;
  notice: FamilyNotice;
}) {
  const url = new URL(`/families/${familyId}`, request.url);
  url.searchParams.set("notice", notice);

  return Response.redirect(url, 302);
}

function getFamilyNoticeContent(notice: FamilyNotice) {
  switch (notice) {
    case "member-removed":
      return {
        description: "Medlemmet ble fjernet fra familien.",
        title: "Endringen er lagret",
      };
  }
}

export const meta: Route.MetaFunction = () => {
  return [
    { title: "Familie | Mealplanner" },
    {
      name: "description",
      content: "Familieoversikt og medlemsadministrasjon i Mealplanner.",
    },
  ];
};

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const familyId = params.familyId;

  if (!familyId) {
    throw new Response("Fant ikke familien.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  const membership = await requireFamilyMembership({
    familyId,
    userId: user.id,
  });
  const members =
    membership.role === "ADMIN" ? await listFamilyMembers(familyId) : [];

  return {
    family: {
      id: membership.family.id,
      joinCode: membership.role === "ADMIN" ? membership.family.joinCode : null,
      name: membership.family.name,
    },
    members,
    notice: getFamilyNotice(request),
    user,
    userRole: membership.role,
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const familyId = params.familyId;

  if (!familyId) {
    throw new Response("Fant ikke familien.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent !== "remove-member") {
    return {
      formError: "Ukjent handling.",
    } satisfies FamilyActionData;
  }

  const targetUserId = String(formData.get("targetUserId") ?? "");

  if (!targetUserId) {
    return {
      formError: "Fant ikke medlemmet som skulle fjernes.",
    } satisfies FamilyActionData;
  }

  const result = await removeFamilyMember({
    actorUserId: user.id,
    familyId,
    targetUserId,
  });

  if (result.status === "REMOVED") {
    return buildFamilyRedirect({
      familyId,
      notice: "member-removed",
      request,
    });
  }

  if (result.status === "NOT_FOUND") {
    return {
      formError: "Fant ikke medlemmet i denne familien.",
      targetUserId,
    } satisfies FamilyActionData;
  }

  if (result.status === "CANNOT_REMOVE_SELF") {
    return {
      formError: "Du kan ikke fjerne deg selv fra familien.",
      targetUserId,
    } satisfies FamilyActionData;
  }

  return {
    formError: "Bare vanlige medlemmer kan fjernes i denne versjonen.",
    targetUserId,
  } satisfies FamilyActionData;
}

export default function FamilyRoute({
  actionData,
  loaderData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const noticeContent = loaderData.notice
    ? getFamilyNoticeContent(loaderData.notice)
    : null;
  const pendingIntent = navigation.formData?.get("intent");
  const pendingTargetUserId = String(
    navigation.formData?.get("targetUserId") ?? "",
  );
  const isRemovingMember =
    navigation.state === "submitting" && pendingIntent === "remove-member";
  const isAdmin = loaderData.userRole === "ADMIN";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="rounded-[32px] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
                Familie
              </span>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight">
                {loaderData.family.name}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                {isAdmin
                  ? "Du kan administrere medlemmer og dele familiekoden med nye deltakere."
                  : "Du har tilgang til familien og kan bruke den videre beskyttede appen."}
              </p>
            </div>
          </div>
        </section>

        {noticeContent ? (
          <section className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-6 py-5 text-emerald-950 shadow-sm">
            <h2 className="text-base font-semibold">{noticeContent.title}</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-900">
              {noticeContent.description}
            </p>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
          <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">
                Din tilgang
              </h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
                {isAdmin ? "Admin" : "Medlem"}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {isAdmin
                ? "Administratorer kan se familiekoden og fjerne vanlige medlemmer ved behov."
                : "Bare administratorer kan se familiekoden og administrere medlemmer."}
            </p>
          </article>

          <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-950">
              Familiekode
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {loaderData.family.joinCode
                ? "Del denne koden med personer som skal bli med i familien."
                : "Familiekoden er bare synlig for administratorer."}
            </p>
            <p className="mt-4 text-2xl font-semibold tracking-[0.28em] text-slate-950">
              {loaderData.family.joinCode ?? "Skjult"}
            </p>
          </article>
        </section>

        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Ukeplaner
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Gå videre til familiens ukeplaner for å opprette, velge og
                oppdatere planer med start- og sluttdato.
              </p>
            </div>

            <Link
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
              to={`/families/${loaderData.family.id}/meal-plans`}
            >
              Administrer ukeplaner
            </Link>
          </div>
        </section>

        {isAdmin ? (
          <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-950">
                Medlemmer
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                Du kan fjerne vanlige medlemmer fra familien. Andre
                administratorer kan ikke fjernes her.
              </p>
            </div>

            <div className="mt-6 grid gap-4">
              {loaderData.members.map(
                (member: (typeof loaderData.members)[number]) => {
                  const canRemove = member.role === "MEMBER";
                  const isPendingRemoval =
                    isRemovingMember && pendingTargetUserId === member.user.id;
                  const memberError =
                    actionData?.targetUserId === member.user.id
                      ? actionData.formError
                      : undefined;

                  return (
                    <article
                      key={member.id}
                      className="rounded-[24px] border border-slate-200 bg-slate-50 p-5"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-base font-semibold text-slate-950">
                              {member.user.displayName}
                            </h3>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
                              {member.role === "ADMIN" ? "Admin" : "Medlem"}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {member.user.email}
                          </p>
                        </div>

                        {canRemove ? (
                          <Form method="post">
                            <input
                              name="intent"
                              type="hidden"
                              value="remove-member"
                            />
                            <input
                              name="targetUserId"
                              type="hidden"
                              value={member.user.id}
                            />
                            <button
                              className="inline-flex items-center justify-center rounded-2xl bg-rose-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
                              disabled={isRemovingMember}
                              type="submit"
                            >
                              {isPendingRemoval ? "Fjerner..." : "Fjern medlem"}
                            </button>
                          </Form>
                        ) : null}
                      </div>

                      {memberError ? (
                        <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                          {memberError}
                        </p>
                      ) : null}
                    </article>
                  );
                },
              )}
            </div>
          </section>
        ) : (
          <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-950">Neste steg</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Familieadministrasjon ligger hos administratorene. Du kan
              fortsette videre til resten av den beskyttede appen fra oversikten
              din.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Noe gikk galt";
  let description = "Vi klarte ikke å laste familieoversikten.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 403) {
      title = "Ingen tilgang";
      description = "Du har ikke tilgang til å administrere denne familien.";
    } else if (error.status === 404) {
      title = "Familien finnes ikke";
      description = "Vi fant ikke familien du forsøkte å åpne.";
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto max-w-3xl rounded-[28px] bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
        <Link
          className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          to="/app"
        >
          Tilbake til oversikten
        </Link>
      </div>
    </main>
  );
}
