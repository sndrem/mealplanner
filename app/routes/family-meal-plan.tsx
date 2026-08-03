import { useEffect, useState } from "react";
import {
  Form,
  Link,
  isRouteErrorResponse,
  useNavigation,
  type MetaFunction,
} from "react-router";

import { requireUser } from "../lib/auth.server";
import { listFamilyMembers } from "../lib/family.server";
import {
  buildMealPlanEntriesSnapshot,
  COLLABORATION_CONFLICT_MESSAGE,
} from "../lib/collaboration.server";
import {
  createMealPlanShare,
  getMealPlanShareCreationData,
  listSharesForMealPlan,
  markReviewCommentAddressed,
} from "../lib/meal-plan-share.server";
import { isPlanDateToday } from "../lib/meal-plan-dates";
import {
  encodeMealSelection,
  getDinnerMenuLabel,
  parseMealSelection,
} from "../lib/meal-plan-display";
import {
  approveMealPlan,
  autoFillMealPlanEntries,
  formatDateOnly,
  getMealPlanPlanningData,
  MEAL_PLAN_MAX_SPAN_DAYS,
  reopenMealPlan,
  saveMealPlanEntries,
  type MealPlanEntryValues,
  updateMealPlan,
} from "../lib/meal-plan.server";

type MealPlanNotice =
  | "meal-plan-approved"
  | "meal-plan-auto-filled"
  | "meal-plan-created"
  | "meal-plan-entries-reset"
  | "meal-plan-entries-saved"
  | "meal-plan-feedback-addressed"
  | "meal-plan-reopened"
  | "meal-plan-shared"
  | "meal-plan-updated"
  | "recipe-created";
type MealPlanIntent =
  | "approve-meal-plan"
  | "auto-fill-meal-plan-entries"
  | "mark-comment-addressed"
  | "reopen-meal-plan"
  | "reset-meal-plan-entries"
  | "save-meal-plan-entries"
  | "share-meal-plan"
  | "update-meal-plan";

interface MealPlanNoticeMeta {
  filledCount: number;
  warning?: string;
}

const CALENDAR_DOWNLOAD_TARGET = "meal-plan-calendar-download";

interface MealPlanFamilyMemberOption {
  displayName: string;
  id: string;
}

interface MealPlanEntryFormState {
  freezerItemId: string;
  note: string;
  recipeId: string;
  responsibleUserId: string;
  updatedAt: string;
}

interface MealPlanActionData {
  autoFillFormError?: string;
  commentId?: string;
  entryFormError?: string;
  entryValues?: Record<string, MealPlanEntryFormState>;
  fieldErrors?: {
    endDate?: string;
    startDate?: string;
    title?: string;
  };
  formError?: string;
  intent?: MealPlanIntent;
  shareFormError?: string;
  statusFormError?: string;
  values?: {
    endDate?: string;
    startDate?: string;
    title?: string;
  };
}

interface MealPlanRouteProps {
  actionData?: MealPlanActionData;
  loaderData: Awaited<ReturnType<typeof loader>>;
}

export const meta: MetaFunction = () => {
  return [
    { title: "Rediger ukeplan | Mealplanner" },
    {
      name: "description",
      content: "Oppdater navn og datointervall for en familieukeplan.",
    },
  ];
};

export async function loader({
  params,
  request,
}: {
  params: {
    familyId?: string;
    mealPlanId?: string;
  };
  request: Request;
}) {
  const user = await requireUser(request);
  const familyId = requireRouteParam(params.familyId, "Fant ikke familien.");
  const mealPlanId = requireRouteParam(
    params.mealPlanId,
    "Fant ikke ukeplanen.",
  );
  const [result, members] = await Promise.all([
    getMealPlanPlanningData({
      familyId,
      mealPlanId,
      userId: user.id,
    }),
    listFamilyMembers(familyId),
  ]);
  const familyMembers: MealPlanFamilyMemberOption[] = members.map((member) => ({
    displayName: member.user.displayName,
    id: member.user.id,
  }));

  const entriesByDate = Object.fromEntries(
    result.visibleDates.map((date) => {
      const entry = result.mealPlan.entries.find(
        (mealPlanEntry) =>
          mealPlanEntry.mealType === "DINNER" &&
          formatDateOnly(mealPlanEntry.date) === date,
      );

      return [
        date,
        {
          freezerItemId: entry?.freezerItemId ?? "",
          note: entry?.note ?? "",
          recipeId: entry?.recipeId ?? "",
          responsibleUserId: entry?.responsibleUserId ?? "",
          updatedAt: entry?.updatedAt.toISOString() ?? "",
        },
      ];
    }),
  );
  const entriesSnapshot = buildMealPlanEntriesSnapshot(
    result.mealPlan.entries.filter((entry) => entry.mealType === "DINNER"),
  );
  const calendarExportDates = result.mealPlan.entries.flatMap((entry) => {
    if (entry.mealType !== "DINNER") {
      return [];
    }

    if (!entry.recipe && !entry.freezerItem) {
      return [];
    }

    return [formatDateOnly(entry.date)];
  });

  const shareData =
    result.mealPlan.status === "DRAFT"
      ? await getMealPlanShareCreationData({
          familyId,
          mealPlanId,
          userId: user.id,
        })
      : null;
  const feedbackShares =
    result.mealPlan.status === "DRAFT"
      ? await listSharesForMealPlan({
          familyId,
          mealPlanId,
          userId: user.id,
        })
      : [];

  return {
    calendarExportDates,
    family: result.family,
    feedbackShares,
    mealPlan: {
      ...result.mealPlan,
      activeShoppingDate: result.mealPlan.activeShoppingDate
        ? formatDateOnly(result.mealPlan.activeShoppingDate)
        : null,
      approvedAt: result.mealPlan.approvedAt
        ? result.mealPlan.approvedAt.toISOString()
        : null,
      endDate: formatDateOnly(result.mealPlan.endDate),
      entries: undefined,
      startDate: formatDateOnly(result.mealPlan.startDate),
      updatedAt: result.mealPlan.updatedAt.toISOString(),
    },
    entriesSnapshot,
    familyMembers,
    notice: getMealPlanNotice(request),
    noticeMeta: getMealPlanNoticeMeta(request),
    recipes: result.recipes,
    activeOpenShare: shareData?.openShares[0] ?? null,
    shareMembers: shareData?.members ?? [],
    userRole: result.userRole,
    visibleDates: result.visibleDates,
    entriesByDate,
    freezerItems: result.freezerItems,
  };
}

export async function action({
  params,
  request,
}: {
  params: {
    familyId?: string;
    mealPlanId?: string;
  };
  request: Request;
}) {
  const user = await requireUser(request);
  const familyId = requireRouteParam(params.familyId, "Fant ikke familien.");
  const mealPlanId = requireRouteParam(
    params.mealPlanId,
    "Fant ikke ukeplanen.",
  );
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "auto-fill-meal-plan-entries") {
    const result = await autoFillMealPlanEntries({
      familyId,
      mealPlanId,
      userId: user.id,
    });

    if (result.status === "NOT_FOUND") {
      throw new Response("Fant ikke ukeplanen.", {
        status: 404,
        statusText: "Not Found",
      });
    }

    if (
      result.status === "NOT_DRAFT" ||
      result.status === "NO_ELIGIBLE_RECIPES"
    ) {
      return {
        autoFillFormError: result.formError,
        intent,
      } satisfies MealPlanActionData;
    }

    if (result.status === "NOTHING_TO_FILL") {
      return {
        autoFillFormError:
          "Alle dagene har allerede en oppskrift eller et notat.",
        intent,
      } satisfies MealPlanActionData;
    }

    if (result.status === "CONFLICT") {
      return {
        autoFillFormError: result.formError,
        intent,
      } satisfies MealPlanActionData;
    }

    if (result.status === "VALIDATION_ERROR") {
      return {
        autoFillFormError: result.formError,
        intent,
      } satisfies MealPlanActionData;
    }

    if (result.status === "AUTO_FILLED") {
      return buildMealPlanRedirect({
        familyId,
        filledCount: result.filledCount,
        mealPlanId,
        notice: "meal-plan-auto-filled",
        request,
        warning: result.warning,
      });
    }

    return {
      autoFillFormError: "Kunne ikke fylle ukeplanen automatisk.",
      intent,
    } satisfies MealPlanActionData;
  }

  if (
    intent === "save-meal-plan-entries" ||
    intent === "reset-meal-plan-entries"
  ) {
    const entryVersions = parseMealPlanEntryVersions(formData);
    const entries =
      intent === "reset-meal-plan-entries"
        ? buildResetMealPlanEntries(formData)
        : parseMealPlanEntries(formData);
    const result = await saveMealPlanEntries({
      entries,
      entryVersions,
      familyId,
      mealPlanId,
      userId: user.id,
    });

    if (result.status === "NOT_FOUND") {
      throw new Response("Fant ikke ukeplanen.", {
        status: 404,
        statusText: "Not Found",
      });
    }

    if (result.status === "CONFLICT") {
      return {
        entryFormError: result.formError,
        entryValues: indexMealPlanEntryValues(result.values, entryVersions),
        intent,
      } satisfies MealPlanActionData;
    }

    if (result.status === "VALIDATION_ERROR") {
      return {
        entryFormError: result.formError,
        entryValues: indexMealPlanEntryValues(result.values, entryVersions),
        intent,
      } satisfies MealPlanActionData;
    }

    return buildMealPlanRedirect({
      familyId,
      mealPlanId,
      notice:
        intent === "reset-meal-plan-entries"
          ? "meal-plan-entries-reset"
          : "meal-plan-entries-saved",
      request,
    });
  }

  if (intent === "approve-meal-plan" || intent === "reopen-meal-plan") {
    const result =
      intent === "approve-meal-plan"
        ? await approveMealPlan({
            entriesSnapshot: String(formData.get("entriesSnapshot") ?? ""),
            expectedMealPlanUpdatedAt: String(
              formData.get("mealPlanUpdatedAt") ?? "",
            ),
            familyId,
            mealPlanId,
            userId: user.id,
          })
        : await reopenMealPlan({
            entriesSnapshot: "",
            expectedMealPlanUpdatedAt: "",
            familyId,
            mealPlanId,
            userId: user.id,
          });

    if (result.status === "NOT_FOUND") {
      throw new Response("Fant ikke ukeplanen.", {
        status: 404,
        statusText: "Not Found",
      });
    }

    if (result.status === "CONFLICT") {
      return {
        intent,
        statusFormError: result.formError,
      } satisfies MealPlanActionData;
    }

    if (result.status === "INVALID_TRANSITION") {
      return {
        intent,
        statusFormError: result.formError,
      } satisfies MealPlanActionData;
    }

    return buildMealPlanRedirect({
      familyId,
      mealPlanId,
      notice:
        result.status === "APPROVED"
          ? "meal-plan-approved"
          : "meal-plan-reopened",
      request,
    });
  }

  if (intent === "share-meal-plan") {
    const wholeFamily = formData.get("wholeFamily") === "on";
    const recipientUserIds = formData
      .getAll("recipientUserIds")
      .map((value) => String(value));

    const result = await createMealPlanShare({
      familyId,
      mealPlanId,
      message: String(formData.get("message") ?? ""),
      recipientUserIds,
      userId: user.id,
      wholeFamily,
    });

    if (
      result.status === "VALIDATION_ERROR" ||
      result.status === "ALREADY_SHARED"
    ) {
      return {
        intent,
        shareFormError: result.formError,
      } satisfies MealPlanActionData;
    }

    return buildMealPlanRedirect({
      familyId,
      mealPlanId,
      notice: "meal-plan-shared",
      request,
    });
  }

  if (intent === "mark-comment-addressed") {
    const commentId = String(formData.get("commentId") ?? "");
    const result = await markReviewCommentAddressed({
      commentId,
      familyId,
      mealPlanId,
      userId: user.id,
    });

    if (result.status === "NOT_FOUND") {
      return {
        commentId,
        intent,
        shareFormError: "Fant ikke tilbakemeldingen.",
      } satisfies MealPlanActionData;
    }

    return buildMealPlanRedirect({
      familyId,
      mealPlanId,
      notice: "meal-plan-feedback-addressed",
      request,
    });
  }

  if (intent !== "update-meal-plan") {
    return {
      formError: "Ukjent handling.",
    } satisfies MealPlanActionData;
  }

  const result = await updateMealPlan({
    endDate: String(formData.get("endDate") ?? ""),
    expectedMealPlanUpdatedAt: String(formData.get("mealPlanUpdatedAt") ?? ""),
    familyId,
    mealPlanId,
    startDate: String(formData.get("startDate") ?? ""),
    title: String(formData.get("title") ?? ""),
    userId: user.id,
  });

  if (result.status === "NOT_FOUND") {
    throw new Response("Fant ikke ukeplanen.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  if (result.status === "CONFLICT") {
    return {
      formError: result.formError ?? COLLABORATION_CONFLICT_MESSAGE,
      intent,
    } satisfies MealPlanActionData;
  }

  if (result.status === "VALIDATION_ERROR") {
    return {
      fieldErrors: result.fieldErrors,
      intent,
      values: result.values,
    } satisfies MealPlanActionData;
  }

  return buildMealPlanRedirect({
    familyId,
    mealPlanId,
    notice: "meal-plan-updated",
    request,
  });
}

export default function FamilyMealPlanRoute({
  actionData,
  loaderData,
}: MealPlanRouteProps) {
  const navigation = useNavigation();
  const pendingIntent = navigation.formData?.get("intent");
  const isApprovingMealPlan =
    navigation.state === "submitting" && pendingIntent === "approve-meal-plan";
  const isReopeningMealPlan =
    navigation.state === "submitting" && pendingIntent === "reopen-meal-plan";
  const isAutoFillingEntries =
    navigation.state === "submitting" &&
    pendingIntent === "auto-fill-meal-plan-entries";
  const isSavingEntries =
    navigation.state === "submitting" &&
    pendingIntent === "save-meal-plan-entries";
  const isResettingEntries =
    navigation.state === "submitting" &&
    pendingIntent === "reset-meal-plan-entries";
  const isUpdatingMetadata =
    navigation.state === "submitting" && pendingIntent === "update-meal-plan";
  const isSharingMealPlan =
    navigation.state === "submitting" && pendingIntent === "share-meal-plan";
  const isMarkingCommentAddressed =
    navigation.state === "submitting" &&
    pendingIntent === "mark-comment-addressed";
  const openFeedbackShares = loaderData.feedbackShares.filter(
    (share) => share.status === "OPEN",
  );
  const unresolvedComments = openFeedbackShares.flatMap((share) =>
    share.comments.filter((comment) => !comment.addressedAt),
  );
  const noticeContent = loaderData.notice
    ? getMealPlanNoticeContent(loaderData.notice, loaderData.noticeMeta)
    : null;
  const emptyDayCount = loaderData.visibleDates.filter((date) => {
    const entry = loaderData.entriesByDate[date];

    return !entry?.recipeId && !entry?.freezerItemId && !entry?.note;
  }).length;
  const canAutoFillEntries =
    loaderData.mealPlan.status === "DRAFT" && emptyDayCount > 0;
  const canManageRecipes = loaderData.userRole === "ADMIN";
  const titleValue = actionData?.values?.title ?? loaderData.mealPlan.title;
  const startDateValue =
    actionData?.values?.startDate ?? loaderData.mealPlan.startDate;
  const endDateValue =
    actionData?.values?.endDate ?? loaderData.mealPlan.endDate;
  const approvalIntent =
    loaderData.mealPlan.status === "APPROVED"
      ? "reopen-meal-plan"
      : "approve-meal-plan";
  const approvalButtonLabel =
    approvalIntent === "approve-meal-plan"
      ? isApprovingMealPlan
        ? "Godkjenner..."
        : "Godkjenn ukeplan"
      : isReopeningMealPlan
        ? "Gjenåpner..."
        : "Gjenåpne som utkast";
  const entryValues =
    (actionData?.intent === "save-meal-plan-entries" ||
      actionData?.intent === "reset-meal-plan-entries") &&
    actionData.entryValues
      ? actionData.entryValues
      : loaderData.entriesByDate;
  const selectedRecipeIds = new Set(
    Object.values(entryValues)
      .map((entry) => entry.recipeId)
      .filter(Boolean),
  );
  const calendarExportDateSet = new Set(loaderData.calendarExportDates);
  const hasMealPlanCalendarExport = calendarExportDateSet.size > 0;

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-100 px-4 py-6 text-slate-900 md:py-12">
      <iframe
        aria-hidden="true"
        className="hidden"
        name={CALENDAR_DOWNLOAD_TARGET}
        tabIndex={-1}
        title="Kalendernedlasting"
      />
      <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6">
        <section className="rounded-[32px] bg-slate-950 px-5 py-6 text-white shadow-xl sm:px-8 sm:py-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1">
                <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
                  Middagsplanlegging
                </span>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  {loaderData.mealPlan.title}
                </h1>
                <p className="mt-2 text-sm font-medium text-emerald-200/90">
                  {formatMealPlanWindow(
                    loaderData.mealPlan.startDate,
                    loaderData.mealPlan.endDate,
                  )}
                </p>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
                  Se hele uken med ett blikk. Trykk på en dag for å planlegge
                  middag og notater.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 sm:gap-3 md:max-w-md md:justify-end">
                <Link
                  className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-600"
                  to={`/families/${loaderData.family.id}/meal-plans/${loaderData.mealPlan.id}/shopping`}
                >
                  Åpne handleliste
                </Link>
                <Link
                  className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/15"
                  to={`/families/${loaderData.family.id}/store-mode`}
                >
                  Åpne butikkmodus
                </Link>
                {hasMealPlanCalendarExport ? (
                  <a
                    className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/15"
                    href={`/families/${loaderData.family.id}/meal-plans/${loaderData.mealPlan.id}/calendar.ics`}
                    target={CALENDAR_DOWNLOAD_TARGET}
                  >
                    Eksporter ukeplan (.ics)
                  </a>
                ) : (
                  <span className="rounded-2xl bg-white/5 px-5 py-3 text-sm font-medium text-slate-400 ring-1 ring-white/10">
                    Eksporter ukeplan (.ics)
                  </span>
                )}
                <Link
                  className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/15"
                  to={`/families/${loaderData.family.id}/meal-plans`}
                >
                  Tilbake til ukeplaner
                </Link>
              </div>
            </div>

            <MealPlanApprovalSection
              actionData={actionData}
              approvalButtonLabel={approvalButtonLabel}
              approvalIntent={approvalIntent}
              approvedAt={loaderData.mealPlan.approvedAt}
              entriesSnapshot={loaderData.entriesSnapshot}
              isApprovingMealPlan={isApprovingMealPlan}
              isReopeningMealPlan={isReopeningMealPlan}
              mealPlanStatus={loaderData.mealPlan.status}
              mealPlanUpdatedAt={loaderData.mealPlan.updatedAt}
              variant="hero"
            />
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

        {loaderData.mealPlan.status === "DRAFT" ? (
          <section className="grid min-w-0 gap-6 lg:grid-cols-2">
            <MealPlanShareSection
              actionData={actionData}
              activeOpenShare={loaderData.activeOpenShare}
              familyId={loaderData.family.id}
              isSharingMealPlan={isSharingMealPlan}
              members={loaderData.shareMembers}
            />
            <MealPlanFeedbackSection
              actionData={actionData}
              isMarkingCommentAddressed={isMarkingCommentAddressed}
              unresolvedCount={unresolvedComments.length}
              visibleDates={loaderData.visibleDates}
              shares={openFeedbackShares}
            />
          </section>
        ) : null}

        <section className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <article className="min-w-0 w-full rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-950">
                Ukeoversikt
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                Trykk på en dag for å velge oppskrift eller legge til notat.
              </p>
            </div>

            <details className="group mt-2 min-w-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-950">Fryser</p>
                  <p className="text-sm text-slate-600">
                    {formatFreezerStockCount(loaderData.freezerItems)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-slate-400 group-open:hidden">
                    Åpne
                  </span>
                  <span className="hidden text-xs text-slate-400 group-open:inline">
                    Lukk
                  </span>
                </div>
              </summary>

              <div className="mt-3 min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                {loaderData.freezerItems.length > 0 ? (
                  <ul className="grid gap-2">
                    {loaderData.freezerItems.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-950">
                              {item.label}
                            </p>
                            {item.note ? (
                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                {item.note}
                              </p>
                            ) : null}
                          </div>
                          <span className="shrink-0 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800">
                            {item.quantity} igjen
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm leading-6 text-slate-600">
                    Ingen fryserretter er registrert ennå.
                  </p>
                )}
                <Link
                  className="mt-4 inline-flex rounded-2xl bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
                  to={`/families/${loaderData.family.id}/freezer`}
                >
                  Administrer fryser
                </Link>
              </div>
            </details>

            <Form
              key={loaderData.entriesSnapshot}
              className="mt-4 min-w-0 space-y-3"
              method="post"
            >
              <div className="grid min-w-0 gap-2">
                {loaderData.visibleDates.map((date, index) => {
                  const entry = entryValues[date] ?? {
                    freezerItemId: "",
                    note: "",
                    recipeId: "",
                    responsibleUserId: "",
                    updatedAt: "",
                  };
                  const showWeekSeparator =
                    loaderData.visibleDates.length > 7 &&
                    (index === 0 || isUtcMonday(date));

                  return (
                    <div key={date} className="grid min-w-0 gap-2">
                      {showWeekSeparator ? (
                        <p className="pt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                          {formatWeekChunkLabel(date)}
                        </p>
                      ) : null}
                      <MealPlanDayRow
                        calendarDownloadTarget={CALENDAR_DOWNLOAD_TARGET}
                        canExportDay={calendarExportDateSet.has(date)}
                        date={date}
                        entry={entry}
                        familyId={loaderData.family.id}
                        familyMembers={loaderData.familyMembers}
                        freezerItems={loaderData.freezerItems}
                        isToday={isPlanDateToday(date)}
                        mealPlanId={loaderData.mealPlan.id}
                        recipes={loaderData.recipes}
                      />
                    </div>
                  );
                })}
              </div>

              {(actionData?.intent === "save-meal-plan-entries" ||
                actionData?.intent === "reset-meal-plan-entries") &&
              actionData.entryFormError ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {actionData.entryFormError}
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={
                    isSavingEntries ||
                    isResettingEntries ||
                    isAutoFillingEntries
                  }
                  name="intent"
                  type="submit"
                  value="save-meal-plan-entries"
                >
                  {isSavingEntries ? "Lagrer middager..." : "Lagre middager"}
                </button>
                <button
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                  disabled={
                    isSavingEntries ||
                    isResettingEntries ||
                    isAutoFillingEntries
                  }
                  name="intent"
                  type="submit"
                  value="reset-meal-plan-entries"
                >
                  {isResettingEntries
                    ? "Tilbakestiller..."
                    : "Tilbakestill ukeoversikt"}
                </button>
              </div>
            </Form>

            <Form className="mt-4 space-y-3" method="post">
              <input
                name="intent"
                type="hidden"
                value="auto-fill-meal-plan-entries"
              />
              <p className="text-sm leading-6 text-slate-600">
                Fyll tomme dager med tilfeldige oppskrifter. Oppskrifter fra de
                to forrige ukeplanene utelates.
              </p>

              {actionData?.intent === "auto-fill-meal-plan-entries" &&
              actionData.autoFillFormError ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {actionData.autoFillFormError}
                </p>
              ) : null}

              <button
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                disabled={
                  !canAutoFillEntries ||
                  isAutoFillingEntries ||
                  isSavingEntries ||
                  isResettingEntries
                }
                type="submit"
              >
                {isAutoFillingEntries
                  ? "Fyller tomme dager..."
                  : "Fyll tomme dager"}
              </button>
            </Form>

            {canManageRecipes ? (
              <Link
                className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                to={buildCreateRecipeHref(
                  loaderData.family.id,
                  loaderData.mealPlan.id,
                )}
              >
                Opprett ny oppskrift →
              </Link>
            ) : null}
          </article>

          <article className="min-w-0 w-full rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
            <details className="group min-w-0 lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-slate-950">
                    Oppskriftsbank
                  </h2>
                  <p className="text-sm text-slate-600">
                    {formatRecipeCount(loaderData.recipes.length)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-slate-400 group-open:hidden">
                    Åpne
                  </span>
                  <span className="hidden text-xs text-slate-400 group-open:inline">
                    Lukk
                  </span>
                </div>
              </summary>

              <div className="mt-4 min-w-0 border-t border-slate-200 pt-4">
                <RecipeBankContent
                  familyId={loaderData.family.id}
                  recipes={loaderData.recipes}
                  selectedRecipeIds={selectedRecipeIds}
                />
              </div>
            </details>

            <div className="hidden min-w-0 lg:block">
              <h2 className="text-lg font-semibold text-slate-950">
                Oppskriftsbank
              </h2>
              <RecipeBankContent
                familyId={loaderData.family.id}
                recipes={loaderData.recipes}
                selectedRecipeIds={selectedRecipeIds}
              />
            </div>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-950">
                Oppdater ukeplan
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                Du kan fortsatt endre navn og datointervall her. Datointervallet
                kan være maks {MEAL_PLAN_MAX_SPAN_DAYS} dager. Middager og
                handledatoer utenfor det nye intervallet fjernes eller justeres
                automatisk.
              </p>
            </div>

            <Form className="mt-6 space-y-4" method="post">
              <input name="intent" type="hidden" value="update-meal-plan" />
              <input
                name="mealPlanUpdatedAt"
                type="hidden"
                value={loaderData.mealPlan.updatedAt}
              />

              <label className="block text-sm font-medium text-slate-700">
                Navn
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  defaultValue={titleValue}
                  name="title"
                  type="text"
                />
              </label>

              {actionData?.intent === "update-meal-plan" &&
              actionData.fieldErrors?.title ? (
                <p className="text-sm text-rose-600">
                  {actionData.fieldErrors.title}
                </p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Startdato
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    defaultValue={startDateValue}
                    name="startDate"
                    type="date"
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Sluttdato
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    defaultValue={endDateValue}
                    name="endDate"
                    type="date"
                  />
                </label>
              </div>

              {actionData?.intent === "update-meal-plan" &&
              actionData.fieldErrors?.startDate ? (
                <p className="text-sm text-rose-600">
                  {actionData.fieldErrors.startDate}
                </p>
              ) : null}
              {actionData?.intent === "update-meal-plan" &&
              actionData.fieldErrors?.endDate ? (
                <p className="text-sm text-rose-600">
                  {actionData.fieldErrors.endDate}
                </p>
              ) : null}
              {actionData?.formError ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {actionData.formError}
                </p>
              ) : null}

              <button
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={isUpdatingMetadata}
                type="submit"
              >
                {isUpdatingMetadata ? "Lagrer..." : "Lagre endringer"}
              </button>
            </Form>
          </article>
        </section>
      </div>
    </main>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  let title = "Noe gikk galt";
  let description = "Vi klarte ikke å laste ukeplanen.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 403) {
      title = "Ingen tilgang";
      description = "Du har ikke tilgang til denne familieukeplanen.";
    } else if (error.status === 404) {
      title = "Ukeplanen finnes ikke";
      description = "Vi fant ikke ukeplanen du forsøkte å åpne.";
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

function requireRouteParam(value: string | undefined, message: string) {
  if (!value) {
    throw new Response(message, {
      status: 404,
      statusText: "Not Found",
    });
  }

  return value;
}

function getMealPlanNotice(request: Request): MealPlanNotice | null {
  const notice = new URL(request.url).searchParams.get("notice");

  if (
    notice === "meal-plan-approved" ||
    notice === "meal-plan-auto-filled" ||
    notice === "meal-plan-created" ||
    notice === "meal-plan-entries-reset" ||
    notice === "meal-plan-entries-saved" ||
    notice === "meal-plan-feedback-addressed" ||
    notice === "meal-plan-reopened" ||
    notice === "meal-plan-shared" ||
    notice === "meal-plan-updated" ||
    notice === "recipe-created"
  ) {
    return notice;
  }

  return null;
}

function getMealPlanNoticeMeta(request: Request): MealPlanNoticeMeta | null {
  const params = new URL(request.url).searchParams;

  if (params.get("notice") !== "meal-plan-auto-filled") {
    return null;
  }

  const filledCount = Number(params.get("filled") ?? "0");

  const warningMessage =
    params.get("warning") === "1"
      ? (params.get("warningMessage") ?? undefined)
      : undefined;

  return {
    filledCount: Number.isFinite(filledCount) ? filledCount : 0,
    warning: warningMessage,
  };
}

function buildMealPlanRedirect({
  familyId,
  filledCount,
  mealPlanId,
  notice,
  request,
  warning,
}: {
  familyId: string;
  filledCount?: number;
  mealPlanId: string;
  notice: MealPlanNotice;
  request: Request;
  warning?: string;
}) {
  const url = new URL(
    `/families/${familyId}/meal-plans/${mealPlanId}`,
    request.url,
  );
  url.searchParams.set("notice", notice);

  if (filledCount !== undefined) {
    url.searchParams.set("filled", String(filledCount));
  }

  if (warning) {
    url.searchParams.set("warning", "1");
    url.searchParams.set("warningMessage", warning);
  }

  return Response.redirect(url, 302);
}

function getMealPlanNoticeContent(
  notice: MealPlanNotice,
  noticeMeta: MealPlanNoticeMeta | null,
) {
  switch (notice) {
    case "meal-plan-approved":
      return {
        description:
          "Ukeplanen er markert som godkjent og klar for neste steg.",
        title: "Ukeplan godkjent",
      };
    case "meal-plan-auto-filled": {
      const filledCount = noticeMeta?.filledCount ?? 0;
      const warning = noticeMeta?.warning;

      return {
        description: warning
          ? `${filledCount} tomme dager ble fylt automatisk. ${warning}`
          : `${filledCount} tomme dager ble fylt automatisk med oppskrifter som ikke var i de to forrige ukeplanene.`,
        title: "Tomme dager fylt",
      };
    }
    case "meal-plan-created":
      return {
        description:
          "Ukeplanen er klar for videre arbeid med innhold og handleliste.",
        title: "Ukeplan opprettet",
      };
    case "meal-plan-entries-reset":
      return {
        description:
          "Alle middager og notater i ukeoversikten ble fjernet for den aktive perioden.",
        title: "Ukeoversikt tilbakestilt",
      };
    case "meal-plan-entries-saved":
      return {
        description:
          "Middagene og notatene ble lagret for den aktive perioden.",
        title: "Middager lagret",
      };
    case "meal-plan-feedback-addressed":
      return {
        description: "Tilbakemeldingen er markert som behandlet.",
        title: "Tilbakemelding behandlet",
      };
    case "meal-plan-shared":
      return {
        description: "Familiemedlemmer kan nå gi tilbakemelding på ukeplanen.",
        title: "Ukeplan delt for gjennomgang",
      };
    case "meal-plan-reopened":
      return {
        description:
          "Ukeplanen er gjenåpnet som utkast og kan fortsatt redigeres.",
        title: "Ukeplan gjenåpnet",
      };
    case "meal-plan-updated":
      return {
        description: "Endringene i navn og datointervall ble lagret.",
        title: "Ukeplan oppdatert",
      };
    case "recipe-created":
      return {
        description:
          "Oppskriften er tilgjengelig i middagsvelgeren for hver dag.",
        title: "Oppskrift opprettet",
      };
  }
}

function buildCreateRecipeHref(familyId: string, mealPlanId: string) {
  const returnTo = `/families/${familyId}/meal-plans/${mealPlanId}`;

  return `/families/${familyId}/recipes?returnTo=${encodeURIComponent(returnTo)}#create-recipe`;
}

interface MealPlanRecipeOption {
  defaultServings: number | null;
  description: string | null;
  id: string;
  prepMinutes: number | null;
  tags: string[];
  title: string;
}

interface MealPlanFreezerOption {
  id: string;
  label: string;
  note: string | null;
  quantity: number;
}

interface ShareMemberOption {
  displayName: string;
  id: string;
  role: string;
}

interface FeedbackShare {
  comments: Array<{
    addressedAt: string | null;
    authorDisplayName: string;
    date: string;
    feedbackLabel: string;
    id: string;
  }>;
  createdAt: string;
  id: string;
  message: string | null;
  recipients: Array<{
    displayName: string;
    status: string;
    userId: string;
  }>;
  sharedByDisplayName: string;
  wholeFamily: boolean;
}

function MealPlanShareSection({
  actionData,
  activeOpenShare,
  familyId,
  isSharingMealPlan,
  members,
}: {
  actionData?: MealPlanActionData;
  activeOpenShare: FeedbackShare | null;
  familyId: string;
  isSharingMealPlan: boolean;
  members: ShareMemberOption[];
}) {
  if (activeOpenShare) {
    const recipientNames = activeOpenShare.recipients
      .map((recipient) => recipient.displayName)
      .join(", ");

    return (
      <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold text-slate-950">
          Delt for gjennomgang
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Ukeplanen venter allerede på tilbakemelding fra{" "}
          {activeOpenShare.wholeFamily
            ? "familien"
            : recipientNames || "mottakerne"}
          .{activeOpenShare.message ? ` «${activeOpenShare.message}»` : ""}
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Du kan ikke sende en ny gjennomgang før denne er avsluttet (for
          eksempel når planen godkjennes).
        </p>
        <Link
          className="mt-4 inline-flex text-sm font-medium text-emerald-700 hover:text-emerald-800"
          to={`/families/${familyId}/meal-plans/reviews`}
        >
          Se delt ukeplan
        </Link>
      </article>
    );
  }

  return (
    <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-semibold text-slate-950">
        Del for gjennomgang
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Send ukeplanen til familien for enkel tilbakemelding på mobil. Du kan
        bare ha én aktiv deling om gangen.
      </p>
      <Link
        className="mt-3 inline-flex text-sm font-medium text-emerald-700 hover:text-emerald-800"
        to={`/families/${familyId}/meal-plans/reviews`}
      >
        Til gjennomgang
      </Link>

      <Form className="mt-4 space-y-4" method="post">
        <input name="intent" type="hidden" value="share-meal-plan" />

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">
            Valgfri melding
          </span>
          <input
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            name="message"
            placeholder="F.eks. Sjekk middagene denne uken"
            type="text"
          />
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <input className="h-4 w-4" name="wholeFamily" type="checkbox" />
          <span className="text-sm text-slate-700">Del med hele familien</span>
        </label>

        {members.length > 0 ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-700">
              Eller velg medlemmer
            </legend>
            <div className="grid gap-2">
              {members.map((member) => (
                <label
                  key={member.id}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3"
                >
                  <input
                    className="h-4 w-4"
                    name="recipientUserIds"
                    type="checkbox"
                    value={member.id}
                  />
                  <span className="text-sm text-slate-800">
                    {member.displayName}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="text-sm text-slate-500">
            Ingen andre familiemedlemmer å dele med enn deg.
          </p>
        )}

        {actionData?.intent === "share-meal-plan" &&
        actionData.shareFormError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {actionData.shareFormError}
          </p>
        ) : null}

        <button
          className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={isSharingMealPlan || members.length === 0}
          type="submit"
        >
          {isSharingMealPlan ? "Deler..." : "Del ukeplan"}
        </button>
      </Form>
    </article>
  );
}

function MealPlanFeedbackSection({
  actionData,
  isMarkingCommentAddressed,
  shares,
  unresolvedCount,
  visibleDates,
}: {
  actionData?: MealPlanActionData;
  isMarkingCommentAddressed: boolean;
  shares: FeedbackShare[];
  unresolvedCount: number;
  visibleDates: string[];
}) {
  if (shares.length === 0) {
    return (
      <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold text-slate-950">Tilbakemelding</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Ingen aktiv deling ennå. Når noen svarer, vises tilbakemeldingene her
          gruppert per dag.
        </p>
      </article>
    );
  }

  const commentsByDate = new Map<
    string,
    Array<FeedbackShare["comments"][number] & { shareId: string }>
  >();

  for (const share of shares) {
    for (const comment of share.comments) {
      const existing = commentsByDate.get(comment.date) ?? [];

      existing.push({ ...comment, shareId: share.id });
      commentsByDate.set(comment.date, existing);
    }
  }

  return (
    <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-950">Tilbakemelding</h2>
        {unresolvedCount > 0 ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
            {unresolvedCount} ubehandlet
          </span>
        ) : null}
      </div>

      {shares.map((share) => (
        <p key={share.id} className="mt-2 text-sm text-slate-600">
          Delt av {share.sharedByDisplayName}
          {share.wholeFamily ? " (hele familien)" : ""}
          {share.message ? ` — «${share.message}»` : ""}
        </p>
      ))}

      <div className="mt-4 space-y-3">
        {visibleDates.map((date) => {
          const comments = commentsByDate.get(date) ?? [];

          if (comments.length === 0) {
            return null;
          }

          return (
            <div
              key={date}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <h3 className="text-sm font-semibold text-slate-900">
                {formatWeekdayLabel(date)}
              </h3>
              <ul className="mt-2 space-y-2">
                {comments.map((comment) => (
                  <li
                    key={comment.id}
                    className="rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-200"
                  >
                    <p className="text-sm font-medium text-slate-900">
                      {comment.authorDisplayName}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {comment.feedbackLabel}
                    </p>
                    {comment.addressedAt ? (
                      <p className="mt-2 text-xs text-emerald-700">Behandlet</p>
                    ) : (
                      <Form className="mt-2" method="post">
                        <input
                          name="intent"
                          type="hidden"
                          value="mark-comment-addressed"
                        />
                        <input
                          name="commentId"
                          type="hidden"
                          value={comment.id}
                        />
                        <button
                          className="inline-flex min-h-10 items-center rounded-2xl bg-slate-950 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                          disabled={isMarkingCommentAddressed}
                          type="submit"
                        >
                          {isMarkingCommentAddressed &&
                          actionData?.commentId === comment.id
                            ? "Lagrer..."
                            : "Merk som behandlet"}
                        </button>
                      </Form>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function MealPlanApprovalSection({
  actionData,
  approvalButtonLabel,
  approvalIntent,
  approvedAt,
  entriesSnapshot,
  isApprovingMealPlan,
  isReopeningMealPlan,
  mealPlanStatus,
  mealPlanUpdatedAt,
  variant,
}: {
  actionData?: MealPlanActionData;
  approvalButtonLabel: string;
  approvalIntent: MealPlanIntent;
  approvedAt: string | null;
  entriesSnapshot: string;
  isApprovingMealPlan: boolean;
  isReopeningMealPlan: boolean;
  mealPlanStatus: "APPROVED" | "DRAFT";
  mealPlanUpdatedAt: string;
  variant: "hero";
}) {
  const isHero = variant === "hero";
  const statusLabel = mealPlanStatus === "APPROVED" ? "Godkjent" : "Utkast";

  return (
    <div
      className={
        isHero
          ? "rounded-2xl border border-white/15 bg-white/10 p-4 sm:p-5"
          : "rounded-2xl border border-slate-200 bg-slate-50 p-4"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={
            isHero
              ? mealPlanStatus === "APPROVED"
                ? "rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-100 ring-1 ring-emerald-400/30"
                : "rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-white/15"
              : mealPlanStatus === "APPROVED"
                ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800"
                : "rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700"
          }
        >
          {statusLabel}
        </span>
        {approvedAt ? (
          <span
            className={
              isHero ? "text-xs text-slate-300" : "text-xs text-slate-600"
            }
          >
            {formatApprovalTimestamp(approvedAt)}
          </span>
        ) : null}
      </div>

      <Form className="mt-4 space-y-3" method="post">
        <input name="intent" type="hidden" value={approvalIntent} />
        {approvalIntent === "approve-meal-plan" ? (
          <>
            <input
              name="entriesSnapshot"
              type="hidden"
              value={entriesSnapshot}
            />
            <input
              name="mealPlanUpdatedAt"
              type="hidden"
              value={mealPlanUpdatedAt}
            />
          </>
        ) : null}

        <p
          className={
            isHero
              ? "text-sm leading-6 text-slate-300"
              : "text-sm leading-6 text-slate-600"
          }
        >
          Alle i familien kan godkjenne ukeplanen når middagene er klare. Det
          låser ikke redigering.
        </p>

        {(actionData?.intent === "approve-meal-plan" ||
          actionData?.intent === "reopen-meal-plan") &&
        actionData.statusFormError ? (
          <p
            className={
              isHero
                ? "rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
                : "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            }
          >
            {actionData.statusFormError}
          </p>
        ) : null}

        <button
          className={
            isHero
              ? "inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-500/50 sm:w-auto"
              : "inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          }
          disabled={isApprovingMealPlan || isReopeningMealPlan}
          type="submit"
        >
          {approvalButtonLabel}
        </button>
      </Form>
    </div>
  );
}

function formatRecipeCount(count: number) {
  return count === 1 ? "1 oppskrift" : `${count} oppskrifter`;
}

function formatFreezerStockCount(
  items: Array<{
    quantity: number;
  }>,
) {
  const availableCount = items.filter((item) => item.quantity > 0).length;

  if (availableCount === 0) {
    return items.length === 0
      ? "Ingen fryserretter registrert"
      : "Ingen porsjoner tilgjengelig";
  }

  return availableCount === 1
    ? "1 rett med porsjoner i fryseren"
    : `${availableCount} retter med porsjoner i fryseren`;
}

function RecipeBankContent({
  familyId,
  recipes,
  selectedRecipeIds,
}: {
  familyId: string;
  recipes: MealPlanRecipeOption[];
  selectedRecipeIds: Set<string>;
}) {
  return (
    <>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Standard- og familieoppskrifter du kan velge til middagene i planen.
      </p>
      <Link
        className="mt-1 inline-flex w-fit items-center justify-center rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
        to={`/families/${familyId}/recipes`}
      >
        Administrer oppskrifter
      </Link>

      <div className="mt-4 grid gap-2 lg:mt-6 lg:gap-3">
        {recipes.map((recipe) => (
          <article
            key={recipe.id}
            className={
              selectedRecipeIds.has(recipe.id)
                ? "rounded-[24px] border border-emerald-200 bg-emerald-50 p-5"
                : "rounded-[24px] border border-slate-200 bg-slate-50 p-5"
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-950">
                  {recipe.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {recipe.description}
                </p>
              </div>
              {selectedRecipeIds.has(recipe.id) ? (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                  I planen
                </span>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                {recipe.prepMinutes ?? "?"} min
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                {recipe.defaultServings ?? "?"} personer
              </span>
              {recipe.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function MealPlanDayRow({
  calendarDownloadTarget,
  canExportDay,
  date,
  entry,
  familyId,
  familyMembers,
  freezerItems,
  isToday,
  mealPlanId,
  recipes,
}: {
  calendarDownloadTarget: string;
  canExportDay: boolean;
  date: string;
  entry: MealPlanEntryFormState;
  familyId: string;
  familyMembers: MealPlanFamilyMemberOption[];
  freezerItems: MealPlanFreezerOption[];
  isToday: boolean;
  mealPlanId: string;
  recipes: MealPlanRecipeOption[];
}) {
  const [mealSelection, setMealSelection] = useState(
    encodeMealSelection({
      freezerItemId: entry.freezerItemId,
      recipeId: entry.recipeId,
    }),
  );
  const [selectedResponsibleUserId, setSelectedResponsibleUserId] = useState(
    entry.responsibleUserId,
  );

  useEffect(() => {
    setMealSelection(
      encodeMealSelection({
        freezerItemId: entry.freezerItemId,
        recipeId: entry.recipeId,
      }),
    );
  }, [entry.freezerItemId, entry.recipeId]);

  useEffect(() => {
    setSelectedResponsibleUserId(entry.responsibleUserId);
  }, [entry.responsibleUserId]);

  const parsedSelection = parseMealSelection(mealSelection);
  const selectedRecipe =
    recipes.find((recipe) => recipe.id === parsedSelection.recipeId) ?? null;
  const selectedFreezerItem =
    freezerItems.find((item) => item.id === parsedSelection.freezerItemId) ??
    null;
  const mealLabel = getMealDaySummaryLabel(
    entry,
    selectedRecipe,
    selectedFreezerItem,
  );
  const hasNoteOnly =
    !parsedSelection.recipeId &&
    !parsedSelection.freezerItemId &&
    Boolean(entry.note.trim());
  const hasFreezerSelection = Boolean(parsedSelection.freezerItemId);
  const responsibleMember =
    familyMembers.find(
      (member) => member.id === selectedResponsibleUserId,
    ) ?? null;
  const selectableFreezerItems = freezerItems.filter(
    (item) =>
      item.quantity > 0 || item.id === parsedSelection.freezerItemId,
  );

  return (
    <details
      className={
        isToday
          ? "group min-w-0 max-w-full overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 ring-1 ring-emerald-100"
          : "group min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
      }
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3 marker:content-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            {formatWeekdayLabel(date)}
          </p>
          <p className="truncate text-base font-semibold text-slate-950">
            {mealLabel}
          </p>
          <p className="text-xs text-slate-500">{formatDateLabel(date)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isToday ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
              I dag
            </span>
          ) : null}
          {hasNoteOnly ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
              Notat
            </span>
          ) : null}
          {hasFreezerSelection ? (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800">
              Fryser
            </span>
          ) : null}
          {responsibleMember ? (
            <span className="max-w-[8rem] truncate rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800">
              {responsibleMember.displayName}
            </span>
          ) : null}
          <span className="text-xs text-slate-400 group-open:hidden">Åpne</span>
          <span className="hidden text-xs text-slate-400 group-open:inline">
            Lukk
          </span>
        </div>
      </summary>

      <div className="min-w-0 space-y-3 border-t border-slate-200 px-3 pb-3 pt-3">
        <input name="entryDate" type="hidden" value={date} />
        <input
          name={`entryUpdatedAt:${date}`}
          type="hidden"
          value={entry.updatedAt}
        />

        {canExportDay ? (
          <a
            className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
            href={`/families/${familyId}/meal-plans/${mealPlanId}/days/${date}/calendar.ics`}
            target={calendarDownloadTarget}
          >
            Eksporter dag (.ics)
          </a>
        ) : null}

        <label className="block min-w-0 text-sm font-medium text-slate-700">
          Middag
          <select
            className="mt-2 box-border w-full max-w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            name={`mealSelection:${date}`}
            onChange={(event) => setMealSelection(event.target.value)}
            value={mealSelection}
          >
            <option value="">Velg middag</option>
            {recipes.length > 0 ? (
              <optgroup label="Oppskrifter">
                {recipes.map((recipe) => (
                  <option key={recipe.id} value={`recipe:${recipe.id}`}>
                    {recipe.title}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {selectableFreezerItems.length > 0 ? (
              <optgroup label="Fryser">
                {selectableFreezerItems.map((item) => (
                  <option key={item.id} value={`freezer:${item.id}`}>
                    Fryser · {item.label} ({item.quantity} igjen)
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
          {parsedSelection.recipeId ? (
            <Link
              className="mt-2 inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
              to={`/families/${familyId}/recipes/${parsedSelection.recipeId}`}
            >
              Se oppskrift
            </Link>
          ) : null}
        </label>

        <label className="block min-w-0 text-sm font-medium text-slate-700">
          Ansvarlig
          <select
            className="mt-2 box-border w-full max-w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            name={`responsibleUserId:${date}`}
            onChange={(event) =>
              setSelectedResponsibleUserId(event.target.value)
            }
            value={selectedResponsibleUserId}
          >
            <option value="">Ingen valgt</option>
            {familyMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-0 text-sm font-medium text-slate-700">
          Notat
          <textarea
            className="mt-2 box-border min-h-24 w-full max-w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            defaultValue={entry.note}
            name={`note:${date}`}
            placeholder="F.eks. bytt ut ris med pasta eller husk rester til dagen etter"
          />
        </label>

        <div className="min-w-0 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
          <p className="break-words text-sm leading-6 text-slate-600">
            {selectedRecipe
              ? `${selectedRecipe.description ?? "Ingen beskrivelse."} · ${selectedRecipe.prepMinutes ?? "?"} min · ${selectedRecipe.defaultServings ?? "?"} personer`
              : selectedFreezerItem
                ? selectedFreezerItem.note
                  ? `Fryserrett. ${selectedFreezerItem.note}`
                  : "Fryserrett valgt for denne dagen."
                : entry.note
                  ? "Bare notat lagres for denne dagen."
                  : "Ingen rett valgt enda."}
          </p>

          {selectedRecipe?.tags.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedRecipe.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </details>
  );
}

function getMealDaySummaryLabel(
  entry: MealPlanEntryFormState,
  selectedRecipe: MealPlanRecipeOption | null,
  selectedFreezerItem: MealPlanFreezerOption | null,
) {
  return getDinnerMenuLabel({
    freezerItem: selectedFreezerItem
      ? { label: selectedFreezerItem.label }
      : entry.freezerItemId
        ? { label: "Fryserrett" }
        : null,
    freezerItemId: entry.freezerItemId || null,
    note: entry.note,
    recipe: selectedRecipe ? { title: selectedRecipe.title } : null,
    recipeId: entry.recipeId || null,
  });
}

function formatMealPlanWindow(startDate: string, endDate: string) {
  const formatter = new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  return `${formatter.format(new Date(`${startDate}T00:00:00.000Z`))} - ${formatter.format(
    new Date(`${endDate}T00:00:00.000Z`),
  )}`;
}

function formatApprovalTimestamp(value: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function parseMealPlanEntries(formData: FormData): MealPlanEntryValues[] {
  return formData.getAll("entryDate").map((dateValue) => {
    const date = String(dateValue);
    const selection = parseMealSelection(
      String(formData.get(`mealSelection:${date}`) ?? ""),
    );

    return {
      date,
      freezerItemId: selection.freezerItemId,
      note: String(formData.get(`note:${date}`) ?? ""),
      recipeId: selection.recipeId,
      responsibleUserId: String(
        formData.get(`responsibleUserId:${date}`) ?? "",
      ),
    };
  });
}

function buildResetMealPlanEntries(formData: FormData): MealPlanEntryValues[] {
  return formData.getAll("entryDate").map((dateValue) => ({
    date: String(dateValue),
    freezerItemId: "",
    note: "",
    recipeId: "",
    responsibleUserId: "",
  }));
}

function parseMealPlanEntryVersions(formData: FormData) {
  return Object.fromEntries(
    formData.getAll("entryDate").map((dateValue) => {
      const date = String(dateValue);

      return [date, String(formData.get(`entryUpdatedAt:${date}`) ?? "")];
    }),
  );
}

function indexMealPlanEntryValues(
  entries: MealPlanEntryValues[],
  entryVersions: Record<string, string>,
) {
  return Object.fromEntries(
    entries.map((entry) => [
      entry.date,
      {
        freezerItemId: entry.freezerItemId,
        note: entry.note,
        recipeId: entry.recipeId,
        responsibleUserId: entry.responsibleUserId,
        updatedAt: entryVersions[entry.date] ?? "",
      },
    ]),
  );
}

function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function formatWeekdayLabel(date: string) {
  const label = new Intl.DateTimeFormat("nb-NO", {
    timeZone: "UTC",
    weekday: "long",
  }).format(new Date(`${date}T00:00:00.000Z`));

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function isUtcMonday(date: string) {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay() === 1;
}

function formatWeekChunkLabel(date: string) {
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  const dayOffset = (parsedDate.getUTCDay() + 6) % 7;
  const weekStart = new Date(parsedDate.getTime());
  weekStart.setUTCDate(weekStart.getUTCDate() - dayOffset);
  const weekEnd = new Date(weekStart.getTime());
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

  return `${formatDateLabel(formatDateOnly(weekStart))} – ${formatDateLabel(formatDateOnly(weekEnd))}`;
}
