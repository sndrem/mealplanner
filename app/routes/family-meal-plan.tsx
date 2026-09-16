import {
  Form,
  Link,
  isRouteErrorResponse,
  redirect,
  useFetcher,
  useNavigation,
  type MetaFunction,
} from "react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MealPlanWeekEntriesForm } from "../components/meal-plan-week-entries-form";
import { RecipePickerMedia } from "../components/recipe-picker-card";
import { requireUser } from "../lib/auth.server";
import { listFamilyMembers } from "../lib/family.server";
import {
  buildMealPlanEntriesSnapshot,
  COLLABORATION_CONFLICT_MESSAGE,
} from "../lib/collaboration.server";
import {
  formatDateOnly,
  MEAL_PLAN_MAX_SPAN_DAYS,
} from "../lib/meal-plan-dates";
import {
  encodeMealSelection,
  formatShortDateLabel,
  parseMealSelection,
  toLiveMealPlanStatus,
} from "../lib/meal-plan-display";
import { useMealPlanEntriesAutosave } from "../lib/use-meal-plan-entries-autosave";
import {
  deriveRecipeTagOptions,
  filterRecipePickerList,
  hasActiveRecipeSearch,
} from "../lib/recipe-list-search";
import {
  approveMealPlan,
  autoFillMealPlanEntries,
  getMealPlanPlanningData,
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
  | "meal-plan-reopened"
  | "meal-plan-updated"
  | "recipe-created";
type MealPlanIntent =
  | "approve-meal-plan"
  | "auto-fill-meal-plan-entries"
  | "autosave-meal-plan-entries"
  | "reopen-meal-plan"
  | "reset-meal-plan-entries"
  | "save-meal-plan-entries"
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
  entryFormError?: string;
  entryValues?: Record<string, MealPlanEntryFormState>;
  fieldErrors?: {
    endDate?: string;
    startDate?: string;
    title?: string;
  };
  formError?: string;
  intent?: MealPlanIntent;
  ok?: boolean;
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

  if (result.mealPlan.status === "PROPOSED") {
    throw redirect(`/families/${familyId}/meal-plans/${mealPlanId}/proposal`);
  }
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

  return {
    calendarExportDates,
    family: result.family,
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
    recentlyUsedRecipeIds: result.recentlyUsedRecipeIds,
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
    intent === "autosave-meal-plan-entries" ||
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

    if (intent === "autosave-meal-plan-entries") {
      return {
        intent,
        ok: true,
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
  const isPending = navigation.state !== "idle";
  const isApprovingMealPlan =
    isPending && pendingIntent === "approve-meal-plan";
  const isReopeningMealPlan = isPending && pendingIntent === "reopen-meal-plan";
  const isAutoFillingEntries =
    isPending && pendingIntent === "auto-fill-meal-plan-entries";
  const isSavingEntries =
    isPending && pendingIntent === "save-meal-plan-entries";
  const isResettingEntries =
    isPending && pendingIntent === "reset-meal-plan-entries";
  const autosaveFetcher = useFetcher<MealPlanActionData>();
  const entriesFormRef = useRef<HTMLFormElement>(null);
  const {
    entryFormError: autosaveEntryFormError,
    isAutosaving,
    scheduleAutosave,
  } = useMealPlanEntriesAutosave({
    blocked: isResettingEntries || isAutoFillingEntries,
    fetcher: autosaveFetcher,
    formRef: entriesFormRef,
  });
  const isUpdatingMetadata = isPending && pendingIntent === "update-meal-plan";
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
  const displayTitle = isUpdatingMetadata
    ? String(navigation.formData?.get("title") ?? loaderData.mealPlan.title)
    : loaderData.mealPlan.title;
  const displayStartDate = isUpdatingMetadata
    ? String(
        navigation.formData?.get("startDate") ?? loaderData.mealPlan.startDate,
      )
    : loaderData.mealPlan.startDate;
  const displayEndDate = isUpdatingMetadata
    ? String(navigation.formData?.get("endDate") ?? loaderData.mealPlan.endDate)
    : loaderData.mealPlan.endDate;
  const displayMealPlanStatus = isApprovingMealPlan
    ? "APPROVED"
    : isReopeningMealPlan
      ? "DRAFT"
      : toLiveMealPlanStatus(loaderData.mealPlan.status);
  const displayApprovedAt = isApprovingMealPlan
    ? new Date().toISOString()
    : isReopeningMealPlan
      ? null
      : loaderData.mealPlan.approvedAt;
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
  const failedEntryActionData =
    autosaveFetcher.data?.intent === "autosave-meal-plan-entries" &&
    autosaveFetcher.data.entryValues
      ? autosaveFetcher.data
      : (actionData?.intent === "save-meal-plan-entries" ||
            actionData?.intent === "reset-meal-plan-entries") &&
          actionData.entryValues
        ? actionData
        : null;
  const entryValues = failedEntryActionData?.entryValues
    ? failedEntryActionData.entryValues
    : loaderData.entriesByDate;
  const displayEntryValues = isResettingEntries
    ? Object.fromEntries(
        loaderData.visibleDates.map((date) => {
          const current = entryValues[date];

          return [
            date,
            {
              freezerItemId: "",
              note: "",
              recipeId: "",
              responsibleUserId: "",
              updatedAt: current?.updatedAt ?? "",
            } satisfies MealPlanEntryFormState,
          ];
        }),
      )
    : entryValues;
  const [mealSelectionsByDate, setMealSelectionsByDate] = useState(() =>
    buildMealSelectionsByDate(loaderData.visibleDates, loaderData.entriesByDate),
  );
  const [activeAssignDate, setActiveAssignDate] = useState<string | null>(null);
  const selectedRecipeIds = useMemo(() => {
    const ids = new Set<string>();

    for (const selection of Object.values(mealSelectionsByDate)) {
      const parsed = parseMealSelection(selection);

      if (parsed.recipeId) {
        ids.add(parsed.recipeId);
      }
    }

    return ids;
  }, [mealSelectionsByDate]);
  const calendarExportDateSet = new Set(loaderData.calendarExportDates);
  const hasMealPlanCalendarExport = calendarExportDateSet.size > 0;

  const handleUserMealSelectionsChange = useCallback(
    (
      value:
        | Record<string, string>
        | ((current: Record<string, string>) => Record<string, string>),
    ) => {
      setMealSelectionsByDate(value);
      scheduleAutosave();
    },
    [scheduleAutosave],
  );

  const assignRecipeToDate = (recipeId: string, date: string) => {
    setMealSelectionsByDate((current) => ({
      ...current,
      [date]: `recipe:${recipeId}`,
    }));
    setActiveAssignDate(date);
    scheduleAutosave();
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-page px-4 py-6 text-ink md:py-12">
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
                  {displayTitle}
                </h1>
                <p className="mt-2 text-sm font-medium text-emerald-200/90">
                  {formatMealPlanWindow(displayStartDate, displayEndDate)}
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
                  to={`/families/${loaderData.family.id}?tab=familie`}
                >
                  Abonner i kalenderen
                </Link>
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
              approvedAt={displayApprovedAt}
              entriesSnapshot={loaderData.entriesSnapshot}
              isApprovingMealPlan={isApprovingMealPlan}
              isReopeningMealPlan={isReopeningMealPlan}
              mealPlanStatus={displayMealPlanStatus}
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

        <section className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <article className="min-w-0 w-full rounded-[28px] bg-surface p-4 shadow-sm ring-1 ring-line sm:p-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-ink">
                Ukeoversikt
              </h2>
              <p className="text-sm leading-6 text-muted">
                Trykk på en dag for å velge oppskrift eller legge til notat.
              </p>
            </div>

            <details className="group mt-2 min-w-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl border border-line bg-page px-4 py-3 marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">Fryser</p>
                  <p className="text-sm text-muted">
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

              <div className="mt-3 min-w-0 rounded-2xl border border-line bg-page p-4">
                {loaderData.freezerItems.length > 0 ? (
                  <ul className="grid gap-2">
                    {loaderData.freezerItems.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-2xl bg-surface px-4 py-3 ring-1 ring-line"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-ink">
                              {item.label}
                            </p>
                            {item.note ? (
                              <p className="mt-1 text-sm leading-6 text-muted">
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
                  <p className="text-sm leading-6 text-muted">
                    Ingen fryserretter er registrert ennå.
                  </p>
                )}
                <Link
                  className="mt-4 inline-flex rounded-2xl bg-surface px-4 py-2 text-sm font-medium text-muted ring-1 ring-line transition hover:bg-page"
                  to={`/families/${loaderData.family.id}/freezer`}
                >
                  Administrer fryser
                </Link>
              </div>
            </details>

            <MealPlanWeekEntriesForm
              activeAssignDate={activeAssignDate}
              calendarDownloadTarget={CALENDAR_DOWNLOAD_TARGET}
              calendarExportDateSet={calendarExportDateSet}
              entryFormError={
                autosaveEntryFormError ||
                ((actionData?.intent === "save-meal-plan-entries" ||
                  actionData?.intent === "reset-meal-plan-entries") &&
                actionData.entryFormError
                  ? actionData.entryFormError
                  : undefined)
              }
              entriesSnapshot={loaderData.entriesSnapshot}
              entryValues={displayEntryValues}
              familyId={loaderData.family.id}
              familyMembers={loaderData.familyMembers}
              formRef={entriesFormRef}
              freezerItems={loaderData.freezerItems}
              isAutoFillingEntries={isAutoFillingEntries}
              isAutosaving={isAutosaving}
              isResettingEntries={isResettingEntries}
              isSavingEntries={isSavingEntries}
              mealPlanId={loaderData.mealPlan.id}
              mealSelectionsByDate={mealSelectionsByDate}
              onActiveAssignDateChange={setActiveAssignDate}
              onMealSelectionsByDateChange={setMealSelectionsByDate}
              onUserMealSelectionsChange={handleUserMealSelectionsChange}
              recentlyUsedRecipeIds={loaderData.recentlyUsedRecipeIds}
              recipes={loaderData.recipes}
              visibleDates={loaderData.visibleDates}
            />

            <Form className="mt-4 space-y-3" method="post">
              <input
                name="intent"
                type="hidden"
                value="auto-fill-meal-plan-entries"
              />
              <p className="text-sm leading-6 text-muted">
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
                className="inline-flex w-full items-center justify-center rounded-2xl border border-line bg-surface px-5 py-3 text-sm font-medium text-ink transition hover:bg-page disabled:cursor-not-allowed disabled:bg-page disabled:text-muted"
                disabled={
                  !canAutoFillEntries ||
                  isAutoFillingEntries ||
                  isAutosaving ||
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
                className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-line bg-surface px-5 py-3 text-sm font-medium text-ink transition hover:bg-page"
                to={buildCreateRecipeHref(
                  loaderData.family.id,
                  loaderData.mealPlan.id,
                )}
              >
                Opprett ny oppskrift →
              </Link>
            ) : null}
          </article>

          <article className="min-w-0 w-full rounded-[28px] bg-surface p-4 shadow-sm ring-1 ring-line sm:p-6">
            <details className="group min-w-0 lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-ink">
                    Oppskriftsbank
                  </h2>
                  <p className="text-sm text-muted">
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

              <div className="mt-4 min-w-0 border-t border-line pt-4">
                <RecipeBankContent
                  activeAssignDate={activeAssignDate}
                  familyId={loaderData.family.id}
                  onAssignRecipe={assignRecipeToDate}
                  recipes={loaderData.recipes}
                  selectedRecipeIds={selectedRecipeIds}
                  visibleDates={loaderData.visibleDates}
                />
              </div>
            </details>

            <div className="hidden min-w-0 lg:block">
              <h2 className="text-lg font-semibold text-ink">
                Oppskriftsbank
              </h2>
              <RecipeBankContent
                activeAssignDate={activeAssignDate}
                familyId={loaderData.family.id}
                onAssignRecipe={assignRecipeToDate}
                recipes={loaderData.recipes}
                selectedRecipeIds={selectedRecipeIds}
                visibleDates={loaderData.visibleDates}
              />
            </div>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <article className="rounded-[28px] bg-surface p-6 shadow-sm ring-1 ring-line">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-ink">
                Oppdater ukeplan
              </h2>
              <p className="text-sm leading-6 text-muted">
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

              <label className="block text-sm font-medium text-muted">
                Navn
                <input
                  className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
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
                <label className="block text-sm font-medium text-muted">
                  Startdato
                  <input
                    className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    defaultValue={startDateValue}
                    name="startDate"
                    type="date"
                  />
                </label>

                <label className="block text-sm font-medium text-muted">
                  Sluttdato
                  <input
                    className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
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
    notice === "meal-plan-reopened" ||
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
  imageUrl?: string | null;
  prepMinutes: number | null;
  tags: string[];
  title: string;
}

function buildMealSelectionsByDate(
  visibleDates: string[],
  entryValues: Record<string, MealPlanEntryFormState>,
) {
  return Object.fromEntries(
    visibleDates.map((date) => {
      const entry = entryValues[date];

      return [
        date,
        encodeMealSelection({
          freezerItemId: entry?.freezerItemId ?? "",
          recipeId: entry?.recipeId ?? "",
        }),
      ];
    }),
  );
}

function formatBankWeekdayLabel(date: string) {
  const label = new Intl.DateTimeFormat("nb-NO", {
    timeZone: "UTC",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00.000Z`));

  return label.charAt(0).toUpperCase() + label.slice(1);
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
          : "rounded-2xl border border-line bg-page p-4"
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
                : "rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-muted"
          }
        >
          {statusLabel}
        </span>
        {approvedAt ? (
          <span
            className={
              isHero ? "text-xs text-slate-300" : "text-xs text-muted"
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
              : "text-sm leading-6 text-muted"
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
  activeAssignDate,
  familyId,
  onAssignRecipe,
  recipes,
  selectedRecipeIds,
  visibleDates,
}: {
  activeAssignDate: string | null;
  familyId: string;
  onAssignRecipe: (recipeId: string, date: string) => void;
  recipes: MealPlanRecipeOption[];
  selectedRecipeIds: Set<string>;
  visibleDates: string[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [fallbackAssignDate, setFallbackAssignDate] = useState(
    visibleDates[0] ?? "",
  );
  const tagOptions = useMemo(() => deriveRecipeTagOptions(recipes), [recipes]);
  const filteredRecipes = useMemo(
    () =>
      filterRecipePickerList(recipes, {
        query: searchQuery,
        selectedTags,
      }),
    [recipes, searchQuery, selectedTags],
  );
  const isSearchActive =
    hasActiveRecipeSearch(searchQuery) || selectedTags.length > 0;
  const assignDate = activeAssignDate ?? fallbackAssignDate;
  const assignDateLabel = assignDate
    ? `${formatBankWeekdayLabel(assignDate)} · ${formatShortDateLabel(assignDate)}`
    : null;

  useEffect(() => {
    if (
      fallbackAssignDate &&
      visibleDates.includes(fallbackAssignDate)
    ) {
      return;
    }

    setFallbackAssignDate(visibleDates[0] ?? "");
  }, [fallbackAssignDate, visibleDates]);

  return (
    <>
      <p className="mt-2 text-sm leading-6 text-muted">
        Standard- og familieoppskrifter du kan velge til middagene i planen.
        Åpne en dag i ukeoversikten, eller velg dag nedenfor, og trykk Legg til.
      </p>
      <Link
        className="mt-1 inline-flex w-fit items-center justify-center rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
        to={`/families/${familyId}/recipes`}
      >
        Administrer oppskrifter
      </Link>

      <div className="mt-4 space-y-3">
        <label className="block text-sm font-medium text-muted">
          Søk oppskrifter
          <input
            autoComplete="off"
            className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="For eksempel tomatsuppe"
            type="search"
            value={searchQuery}
          />
        </label>

        {tagOptions.length > 0 ? (
          <div>
            <p className="text-sm font-medium text-muted">Filtrer på tag</p>
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
              {tagOptions.map(({ count, tag }) => {
                const isSelected = selectedTags.includes(tag);

                return (
                  <button
                    key={tag}
                    className={
                      isSelected
                        ? "shrink-0 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white"
                        : "shrink-0 rounded-full bg-page px-2.5 py-1 text-xs font-medium text-muted transition hover:bg-line"
                    }
                    onClick={() => {
                      setSelectedTags((current) =>
                        current.includes(tag)
                          ? current.filter((value) => value !== tag)
                          : [...current, tag],
                      );
                    }}
                    type="button"
                  >
                    {tag} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {isSearchActive ? (
          <button
            className="text-sm font-medium text-muted underline-offset-2 hover:underline"
            onClick={() => {
              setSearchQuery("");
              setSelectedTags([]);
            }}
            type="button"
          >
            Nullstill filtre
          </button>
        ) : null}

        {!activeAssignDate && visibleDates.length > 0 ? (
          <label className="block text-sm font-medium text-muted">
            Legg til på dag
            <select
              className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              onChange={(event) => setFallbackAssignDate(event.target.value)}
              value={fallbackAssignDate}
            >
              {visibleDates.map((date) => (
                <option key={date} value={date}>
                  {formatBankWeekdayLabel(date)} · {formatShortDateLabel(date)}
                </option>
              ))}
            </select>
          </label>
        ) : activeAssignDate && assignDateLabel ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            Valgt dag: {assignDateLabel}. Trykk Legg til på en oppskrift.
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid h-[calc(100vh-20rem)] gap-2 overflow-y-auto lg:mt-6 lg:gap-3">
        {filteredRecipes.length === 0 ? (
          <p className="rounded-[24px] border border-line bg-page p-5 text-sm text-muted">
            Ingen oppskrifter matcher søket.
          </p>
        ) : (
          filteredRecipes.map((recipe) => (
            <article
              key={recipe.id}
              className={
                selectedRecipeIds.has(recipe.id)
                  ? "rounded-[24px] border border-emerald-200 bg-emerald-50 p-5"
                  : "rounded-[24px] border border-line bg-page p-5"
              }
            >
              <div className="flex items-start gap-3">
                <RecipePickerMedia
                  imageUrl={recipe.imageUrl}
                  title={recipe.title}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-ink">
                        {recipe.title}
                      </h3>
                      <p className="mt-2 whitespace-break-spaces text-sm leading-6 text-muted">
                        {recipe.description}
                      </p>
                    </div>
                    {selectedRecipeIds.has(recipe.id) ? (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                        I planen
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted ring-1 ring-line">
                      {recipe.prepMinutes ?? "?"} min
                    </span>
                    <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted ring-1 ring-line">
                      {recipe.defaultServings ?? "?"} personer
                    </span>
                    {recipe.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted ring-1 ring-line"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {assignDate ? (
                    <button
                      className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                      onClick={() => onAssignRecipe(recipe.id, assignDate)}
                      type="button"
                    >
                      Legg til på {formatBankWeekdayLabel(assignDate)}
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </>
  );
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
