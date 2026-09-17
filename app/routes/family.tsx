import { Form, Link, isRouteErrorResponse, useNavigation } from "react-router";

import type { Route } from "./+types/family";
import { FamilyCalendarSubscriptionCard } from "../components/family-calendar-subscription-card";
import { FamilyHomeTabs } from "../components/family-home-tabs";
import { FamilyMcpTokenCard } from "../components/family-mcp-token-card";
import { requireUser } from "../lib/auth.server";
import {
  buildCalendarSubscriptionUrls,
  createOrRotateFamilyCalendarSubscription,
  getFamilyCalendarSubscriptionStatus,
  revokeFamilyCalendarSubscription,
} from "../lib/calendar-subscription.server";
import {
  getFamilyReminderEmail,
  listFamilyMembers,
  removeFamilyMember,
  requireFamilyMembership,
  updateFamilyReminderEmail,
} from "../lib/family.server";
import { getFamilyWeekDinnerMenu } from "../lib/family-home.server";
import { formatMealPlanWindow, toLiveMealPlanStatus } from "../lib/meal-plan-display";
import { formatDateOnly } from "../lib/meal-plan-dates";
import { isMealPlanPast } from "../lib/meal-plan-week";
import { listMealPlansForFamily } from "../lib/meal-plan.server";
import {
  buildFamilyMcpUrl,
  createOrRotateFamilyMcpToken,
  getFamilyMcpTokenStatus,
  revokeFamilyMcpToken,
} from "../lib/mcp-token.server";

type FamilyNotice =
  | "calendar-subscription-revoked"
  | "mcp-token-revoked"
  | "member-removed"
  | "reminder-email-cleared"
  | "reminder-email-saved";

type FamilyHomeTab = "familie" | "oversikt";

type SerializedMealPlanSummary = {
  endDate: string;
  id: string;
  startDate: string;
  status: "APPROVED" | "DRAFT";
  title: string;
};

interface FamilyActionData {
  fieldErrors?: {
    reminderEmail?: string;
  };
  formError?: string;
  httpsUrl?: string;
  intent?: string;
  mcpToken?: string;
  mcpUrl?: string;
  targetUserId?: string;
  values?: {
    reminderEmail?: string;
  };
  webcalUrl?: string;
}

function getFamilyNotice(request: Request): FamilyNotice | null {
  const notice = new URL(request.url).searchParams.get("notice");

  if (
    notice === "calendar-subscription-revoked" ||
    notice === "mcp-token-revoked" ||
    notice === "member-removed" ||
    notice === "reminder-email-cleared" ||
    notice === "reminder-email-saved"
  ) {
    return notice;
  }

  return null;
}

function getFamilyHomeTab(request: Request): FamilyHomeTab {
  const tab = new URL(request.url).searchParams.get("tab");

  if (tab === "familie") {
    return tab;
  }

  return "oversikt";
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
  url.searchParams.set("tab", "familie");

  return Response.redirect(url, 302);
}

function getFamilyNoticeContent(notice: FamilyNotice) {
  switch (notice) {
    case "calendar-subscription-revoked":
      return {
        description:
          "Kalenderabonnementet er opphevet. Eksisterende abonnement slutter å oppdatere.",
        title: "Endringen er lagret",
      };
    case "mcp-token-revoked":
      return {
        description:
          "MCP-nøkkelen er opphevet. Eksisterende agenter mister tilgang.",
        title: "Endringen er lagret",
      };
    case "member-removed":
      return {
        description: "Medlemmet ble fjernet fra familien.",
        title: "Endringen er lagret",
      };
    case "reminder-email-cleared":
      return {
        description:
          "Varslings-e-posten er fjernet. Familien får ikke lenger påminnelse om helgen.",
        title: "Endringen er lagret",
      };
    case "reminder-email-saved":
      return {
        description:
          "Vi sender en e-post torsdag kl. 12 hvis lørdag eller søndag mangler middag.",
        title: "Varslings-e-posten er lagret",
      };
  }
}

function serializeMealPlanSummary(
  mealPlan: Awaited<
    ReturnType<typeof listMealPlansForFamily>
  >["mealPlans"][number],
): SerializedMealPlanSummary {
  return {
    endDate: formatDateOnly(mealPlan.endDate),
    id: mealPlan.id,
    startDate: formatDateOnly(mealPlan.startDate),
    status: toLiveMealPlanStatus(mealPlan.status),
    title: mealPlan.title,
  };
}

function MealPlanStatusBadge({
  muted = false,
  status,
}: {
  muted?: boolean;
  status: SerializedMealPlanSummary["status"];
}) {
  if (muted) {
    return (
      <span className="rounded-full bg-page px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-400 ring-1 ring-slate-100">
        {status === "APPROVED" ? "Godkjent" : "Utkast"}
      </span>
    );
  }

  return (
    <span
      className={
        status === "APPROVED"
          ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-200"
          : "rounded-full bg-surface px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted ring-1 ring-line"
      }
    >
      {status === "APPROVED" ? "Godkjent" : "Utkast"}
    </span>
  );
}

function MealPlanLinkCard({
  familyId,
  isPast = false,
  mealPlan,
}: {
  familyId: string;
  isPast?: boolean;
  mealPlan: SerializedMealPlanSummary;
}) {
  return (
    <Link
      className={
        isPast
          ? "block rounded-[24px] border border-line bg-page/70 p-5 opacity-80 transition hover:border-line hover:bg-page"
          : "block rounded-[24px] border border-line bg-page p-5 transition hover:border-line hover:bg-surface"
      }
      to={`/families/${familyId}/meal-plans/${mealPlan.id}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <h3
          className={
            isPast
              ? "text-base font-semibold text-muted"
              : "text-base font-semibold text-ink"
          }
        >
          {mealPlan.title}
        </h3>
        <MealPlanStatusBadge muted={isPast} status={mealPlan.status} />
      </div>
      <p
        className={
          isPast
            ? "mt-2 text-sm leading-6 text-slate-400"
            : "mt-2 text-sm leading-6 text-muted"
        }
      >
        {formatMealPlanWindow(mealPlan.startDate, mealPlan.endDate)}
      </p>
    </Link>
  );
}

function WeekDayMenuCard({
  day,
  familyId,
}: {
  day: Awaited<ReturnType<typeof getFamilyWeekDinnerMenu>>[number];
  familyId: string;
}) {
  const content = (
    <>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
        {day.weekdayLabel}
      </p>
      <p className="mt-1 text-sm text-muted">{day.dateLabel}</p>
      {day.imageUrl ? (
        <img
          alt=""
          className="mt-3 aspect-square w-28 max-w-full rounded-xl object-cover"
          loading="lazy"
          src={day.imageUrl}
        />
      ) : null}
      <p className="mt-3 text-base font-semibold leading-snug text-ink">
        {day.menuLabel}
      </p>
      {day.responsibleDisplayName ? (
        <span className="mt-2 inline-flex max-w-full truncate rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800">
          {day.responsibleDisplayName}
        </span>
      ) : null}
      {day.mealPlanTitle ? (
        <p className="mt-2 text-xs text-muted">{day.mealPlanTitle}</p>
      ) : null}
    </>
  );

  const cardClassName = day.isToday
    ? "rounded-[24px] border border-notice-success-line bg-notice-success p-4 ring-1 ring-notice-success-line"
    : "rounded-[24px] border border-line bg-page p-4";

  if (day.mealPlanId) {
    return (
      <Link
        className={`${cardClassName} block transition hover:border-line hover:bg-surface`}
        to={`/families/${familyId}/meal-plans/${day.mealPlanId}`}
      >
        {content}
        {day.isToday ? (
          <span className="mb-2 inline-flex rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-notice-success-ink ring-1 ring-notice-success-line">
            I dag
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <article className={cardClassName}>
      {content}
      {day.isToday ? (
        <span className="mb-2 inline-flex rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-notice-success-ink ring-1 ring-notice-success-line">
          I dag
        </span>
      ) : null}
    </article>
  );
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
  const [
    members,
    mealPlanResult,
    weekDays,
    reminderEmail,
    calendarSubscription,
    mcpToken,
  ] = await Promise.all([
    membership.role === "ADMIN"
      ? listFamilyMembers(familyId)
      : Promise.resolve([]),
    listMealPlansForFamily({
      familyId,
      userId: user.id,
    }),
    getFamilyWeekDinnerMenu({
      familyId,
      userId: user.id,
    }),
    membership.role === "ADMIN"
      ? getFamilyReminderEmail(familyId)
      : Promise.resolve(null),
    membership.role === "ADMIN"
      ? getFamilyCalendarSubscriptionStatus({ familyId })
      : Promise.resolve({ exists: false }),
    membership.role === "ADMIN"
      ? getFamilyMcpTokenStatus({ familyId })
      : Promise.resolve({ exists: false }),
  ]);

  const serializedMealPlans = mealPlanResult.mealPlans.map(
    serializeMealPlanSummary,
  );

  return {
    activeTab: getFamilyHomeTab(request),
    family: {
      id: membership.family.id,
      joinCode: membership.role === "ADMIN" ? membership.family.joinCode : null,
      name: membership.family.name,
      reminderEmail,
    },
    hasCalendarSubscription: calendarSubscription.exists,
    hasMcpToken: mcpToken.exists,
    members,
    mcpUrl: buildFamilyMcpUrl(new URL(request.url).origin),
    notice: getFamilyNotice(request),
    recentMealPlans: serializedMealPlans.slice(0, 3),
    user,
    userRole: membership.role,
    weekDays,
  };
}

export async function action({
  params,
  request,
}: Route.ActionArgs): Promise<FamilyActionData | Response> {
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

  if (intent === "save-reminder-email") {
    const reminderEmail = String(formData.get("reminderEmail") ?? "");
    const result = await updateFamilyReminderEmail({
      actorUserId: user.id,
      email: reminderEmail,
      familyId,
    });

    if (result.status === "INVALID_EMAIL") {
      return {
        fieldErrors: {
          reminderEmail: "Skriv inn en gyldig e-postadresse.",
        },
        intent,
        values: { reminderEmail },
      } satisfies FamilyActionData;
    }

    return buildFamilyRedirect({
      familyId,
      notice:
        result.status === "CLEARED"
          ? "reminder-email-cleared"
          : "reminder-email-saved",
      request,
    });
  }

  if (
    intent === "create-calendar-subscription" ||
    intent === "rotate-calendar-subscription"
  ) {
    const result = await createOrRotateFamilyCalendarSubscription({
      familyId,
      userId: user.id,
    });

    return {
      intent,
      ...buildCalendarSubscriptionUrls({
        origin: new URL(request.url).origin,
        token: result.token,
      }),
    } satisfies FamilyActionData;
  }

  if (intent === "revoke-calendar-subscription") {
    await revokeFamilyCalendarSubscription({
      familyId,
      userId: user.id,
    });

    return buildFamilyRedirect({
      familyId,
      notice: "calendar-subscription-revoked",
      request,
    });
  }

  if (intent === "create-mcp-token" || intent === "rotate-mcp-token") {
    const result = await createOrRotateFamilyMcpToken({
      familyId,
      userId: user.id,
    });

    return {
      intent,
      mcpToken: result.token,
      mcpUrl: buildFamilyMcpUrl(new URL(request.url).origin),
    } satisfies FamilyActionData;
  }

  if (intent === "revoke-mcp-token") {
    await revokeFamilyMcpToken({
      familyId,
      userId: user.id,
    });

    return buildFamilyRedirect({
      familyId,
      notice: "mcp-token-revoked",
      request,
    });
  }

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
    navigation.state !== "idle" && pendingIntent === "remove-member";
  const isSavingReminderEmail =
    navigation.state !== "idle" && pendingIntent === "save-reminder-email";
  const isCreatingCalendarSubscription =
    navigation.state !== "idle" &&
    pendingIntent === "create-calendar-subscription";
  const isRotatingCalendarSubscription =
    navigation.state !== "idle" &&
    pendingIntent === "rotate-calendar-subscription";
  const isRevokingCalendarSubscription =
    navigation.state !== "idle" &&
    pendingIntent === "revoke-calendar-subscription";
  const isCreatingMcpToken =
    navigation.state !== "idle" && pendingIntent === "create-mcp-token";
  const isRotatingMcpToken =
    navigation.state !== "idle" && pendingIntent === "rotate-mcp-token";
  const isRevokingMcpToken =
    navigation.state !== "idle" && pendingIntent === "revoke-mcp-token";
  const isAdmin = loaderData.userRole === "ADMIN";
  const familyId = loaderData.family.id;
  const reminderEmailValue = isSavingReminderEmail
    ? String(navigation.formData?.get("reminderEmail") ?? "")
    : (actionData?.values?.reminderEmail ??
      loaderData.family.reminderEmail ??
      "");
  const reminderEmailError =
    actionData?.intent === "save-reminder-email"
      ? actionData.fieldErrors?.reminderEmail
      : undefined;
  const displayMembers = isRemovingMember
    ? loaderData.members.filter(
        (member) => member.user.id !== pendingTargetUserId,
      )
    : loaderData.members;

  return (
    <main className="min-h-screen bg-page px-4 py-12 text-ink">
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

        <FamilyHomeTabs
          activeTab={loaderData.activeTab}
          familiePanel={
            <>
              <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
                <article className="rounded-[28px] bg-surface p-6 shadow-sm ring-1 ring-line">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-ink">
                      Din tilgang
                    </h2>
                    <span className="rounded-full bg-page px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted">
                      {isAdmin ? "Admin" : "Medlem"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {isAdmin
                      ? "Administratorer kan se familiekoden og fjerne vanlige medlemmer ved behov."
                      : "Bare administratorer kan se familiekoden og administrere medlemmer."}
                  </p>
                </article>

                {isAdmin ? (
                  <article className="rounded-[28px] bg-surface p-6 shadow-sm ring-1 ring-line">
                    <h2 className="text-lg font-semibold text-ink">
                      Familiekode
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      Del denne koden med personer som skal bli med i familien.
                    </p>
                    <p className="mt-4 text-2xl font-semibold tracking-[0.28em] text-ink">
                      {loaderData.family.joinCode}
                    </p>
                  </article>
                ) : (
                  <article className="rounded-[28px] bg-surface p-6 shadow-sm ring-1 ring-line">
                    <h2 className="text-lg font-semibold text-ink">
                      Familieinnstillinger
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      Familiekode og medlemsadministrasjon er bare tilgjengelig
                      for administratorer.
                    </p>
                  </article>
                )}
              </section>

              {isAdmin ? (
                <section className="rounded-[28px] bg-surface p-6 shadow-sm ring-1 ring-line">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-lg font-semibold text-ink">
                      Helgevarsling
                    </h2>
                    <p className="text-sm leading-6 text-muted">
                      Få en e-post torsdag kl. 12 hvis lørdag eller søndag
                      mangler middag. La feltet stå tomt for å slå av
                      varslingen.
                    </p>
                  </div>

                  <Form className="mt-6 flex flex-col gap-4" method="post">
                    <input
                      name="intent"
                      type="hidden"
                      value="save-reminder-email"
                    />
                    <label className="block text-sm font-medium text-muted">
                      Familie-e-post
                      <input
                        autoComplete="email"
                        className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition focus:border-slate-400"
                        defaultValue={reminderEmailValue}
                        key={reminderEmailValue}
                        name="reminderEmail"
                        placeholder="familie@eksempel.no"
                        type="email"
                      />
                    </label>
                    {reminderEmailError ? (
                      <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {reminderEmailError}
                      </p>
                    ) : null}
                    <button
                      className="inline-flex w-fit items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                      type="submit"
                    >
                      {isSavingReminderEmail ? "Lagrer..." : "Lagre e-post"}
                    </button>
                  </Form>
                </section>
              ) : null}

              {isAdmin ? (
                <FamilyCalendarSubscriptionCard
                  hasCalendarSubscription={
                    loaderData.hasCalendarSubscription &&
                    !isRevokingCalendarSubscription
                  }
                  httpsUrl={actionData?.httpsUrl}
                  isCreating={isCreatingCalendarSubscription}
                  isRevoking={isRevokingCalendarSubscription}
                  isRotating={isRotatingCalendarSubscription}
                  webcalUrl={actionData?.webcalUrl}
                />
              ) : null}

              {isAdmin ? (
                <FamilyMcpTokenCard
                  hasMcpToken={
                    (loaderData.hasMcpToken && !isRevokingMcpToken) ||
                    isCreatingMcpToken ||
                    Boolean(actionData?.mcpToken)
                  }
                  isCreating={isCreatingMcpToken}
                  isRevoking={isRevokingMcpToken}
                  isRotating={isRotatingMcpToken}
                  mcpToken={actionData?.mcpToken}
                  mcpUrl={actionData?.mcpUrl ?? loaderData.mcpUrl}
                />
              ) : null}

              {isAdmin ? (
                <section className="rounded-[28px] bg-surface p-6 shadow-sm ring-1 ring-line">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-lg font-semibold text-ink">
                      Medlemmer
                    </h2>
                    <p className="text-sm leading-6 text-muted">
                      Du kan fjerne vanlige medlemmer fra familien. Andre
                      administratorer kan ikke fjernes her.
                    </p>
                  </div>

                  <div className="mt-6 grid gap-4">
                    {displayMembers.map(
                      (member: (typeof loaderData.members)[number]) => {
                        const canRemove = member.role === "MEMBER";
                        const isPendingRemoval =
                          isRemovingMember &&
                          pendingTargetUserId === member.user.id;
                        const memberError =
                          actionData?.targetUserId === member.user.id
                            ? actionData.formError
                            : undefined;

                        return (
                          <article
                            key={member.id}
                            className="rounded-[24px] border border-line bg-page p-5"
                          >
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-3">
                                  <h3 className="text-base font-semibold text-ink">
                                    {member.user.displayName}
                                  </h3>
                                  <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted ring-1 ring-line">
                                    {member.role === "ADMIN"
                                      ? "Admin"
                                      : "Medlem"}
                                  </span>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-muted">
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
                                    {isPendingRemoval
                                      ? "Fjerner..."
                                      : "Fjern medlem"}
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
              ) : null}
            </>
          }
          oversiktPanel={
            <>
              <section className="rounded-[28px] bg-surface p-6 shadow-sm ring-1 ring-line">
                <h2 className="text-lg font-semibold text-ink">
                  Denne uken
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Viser bare inneværende kalenderuke (man–søn), også når
                  ukeplanen strekker seg over flere uker.
                </p>

                {loaderData.weekDays.some((day) => day.mealPlanId) ? (
                  <div className="mt-6 grid gap-4 md:grid-cols-7">
                    {loaderData.weekDays.map((day) => (
                      <WeekDayMenuCard
                        key={day.date}
                        day={day}
                        familyId={familyId}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-6 rounded-[24px] border border-dashed border-line bg-page px-5 py-4 text-sm leading-6 text-muted">
                    Ingen ukeplaner denne uken.{" "}
                    <Link
                      className="font-medium text-ink underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500"
                      to={`/families/${familyId}/meal-plans`}
                    >
                      Opprett eller velg en plan
                    </Link>
                    .
                  </p>
                )}
              </section>

              <section className="rounded-[28px] bg-surface p-6 shadow-sm ring-1 ring-line">
                <h2 className="text-lg font-semibold text-ink">
                  Siste ukeplaner
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  De tre nyeste ukeplanene i familien.
                </p>

                {loaderData.recentMealPlans.length > 0 ? (
                  <div className="mt-6 grid gap-4">
                    {loaderData.recentMealPlans.map((mealPlan) => (
                      <MealPlanLinkCard
                        key={mealPlan.id}
                        familyId={familyId}
                        isPast={isMealPlanPast(mealPlan.endDate)}
                        mealPlan={mealPlan}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-6 rounded-[24px] border border-dashed border-line bg-page px-5 py-4 text-sm leading-6 text-muted">
                    Ingen ukeplaner ennå. Opprett den første planen for å komme
                    i gang.
                  </p>
                )}
              </section>

              <section className="rounded-[28px] bg-surface p-6 shadow-sm ring-1 ring-line">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">
                      Handleliste
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                      Gå rett til handlelisten for dagens eller siste aktive
                      ukeplan.
                    </p>
                  </div>

                  <Link
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                    to={`/families/${familyId}/store-mode`}
                  >
                    Åpne handleliste
                  </Link>
                </div>

                <p className="mt-4 text-sm leading-6 text-muted">
                  Trenger du varer uten ukeplan?{" "}
                  <Link
                    className="font-medium text-ink underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500"
                    to={`/families/${familyId}/shopping`}
                  >
                    Åpne Alltid på listen
                  </Link>
                  .
                </p>
              </section>

              <p className="text-center text-sm text-muted">
                <Link
                  className="font-medium text-ink underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500"
                  to={`/families/${familyId}/meal-plans`}
                >
                  Administrer ukeplaner
                </Link>
              </p>
            </>
          }
        />
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
    <main className="min-h-screen bg-page px-4 py-12 text-ink">
      <div className="mx-auto max-w-3xl rounded-[28px] bg-surface p-8 shadow-sm ring-1 ring-line">
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
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
