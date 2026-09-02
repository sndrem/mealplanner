import { useMemo, useState } from "react";
import { Form, Link, useNavigation, type MetaFunction } from "react-router";

import { MealPlanRecipePicker } from "../components/meal-plan-recipe-picker";
import { requireUser } from "../lib/auth.server";
import { formatDateOnly } from "../lib/meal-plan-dates";
import {
  encodeMealSelection,
  formatMealPlanWindow,
  formatShortDateLabel,
  formatWeekdayLabel,
  parseMealSelection,
} from "../lib/meal-plan-display";
import {
  approveMealPlanProposal,
  getMealPlanPlanningData,
  saveMealPlanEntries,
  type MealPlanEntryValues,
} from "../lib/meal-plan.server";

type ProposalIntent = "approve-meal-plan" | "save-meal-plan-entries";

interface ProposalActionData {
  approvalFormError?: string;
  entryFormError?: string;
  intent?: ProposalIntent;
}

export const meta: MetaFunction = () => {
  return [
    { title: "Ukeplanforslag | Mealplanner" },
    {
      name: "description",
      content: "Se, juster og godkjenn et foreslått ukesmeny.",
    },
  ];
};

export async function loader({
  params,
  request,
}: {
  params: { familyId?: string; mealPlanId?: string };
  request: Request;
}) {
  const user = await requireUser(request);
  const familyId = requireRouteParam(params.familyId, "Fant ikke familien.");
  const mealPlanId = requireRouteParam(
    params.mealPlanId,
    "Fant ikke ukeplanen.",
  );
  const data = await getMealPlanPlanningData({
    familyId,
    mealPlanId,
    userId: user.id,
  });

  if (data.mealPlan.status === "DRAFT") {
    throw Response.redirect(
      new URL(`/families/${familyId}/meal-plans/${mealPlanId}`, request.url).toString(),
      302,
    );
  }

  const entriesByDate = Object.fromEntries(
    data.visibleDates.map((date) => {
      const entry = data.mealPlan.entries.find(
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
          updatedAt: entry?.updatedAt.toISOString() ?? "",
        },
      ];
    }),
  );

  return {
    entriesByDate,
    family: data.family,
    freezerItems: data.freezerItems,
    mealPlan: {
      endDate: formatDateOnly(data.mealPlan.endDate),
      id: data.mealPlan.id,
      startDate: formatDateOnly(data.mealPlan.startDate),
      status: data.mealPlan.status,
      title: data.mealPlan.title,
    },
    recentlyUsedRecipeIds: data.recentlyUsedRecipeIds,
    recipes: data.recipes,
    visibleDates: data.visibleDates,
  };
}

export async function action({
  params,
  request,
}: {
  params: { familyId?: string; mealPlanId?: string };
  request: Request;
}) {
  const user = await requireUser(request);
  const familyId = requireRouteParam(params.familyId, "Fant ikke familien.");
  const mealPlanId = requireRouteParam(
    params.mealPlanId,
    "Fant ikke ukeplanen.",
  );
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "") as ProposalIntent;
  const entries = parseProposalEntries(formData);
  const entryVersions = parseProposalEntryVersions(formData);

  if (intent === "save-meal-plan-entries" || intent === "approve-meal-plan") {
    const saveResult = await saveMealPlanEntries({
      entries,
      entryVersions,
      familyId,
      mealPlanId,
      userId: user.id,
    });

    if (saveResult.status === "NOT_FOUND") {
      throw new Response("Fant ikke ukeplanen.", {
        status: 404,
        statusText: "Not Found",
      });
    }

    if (
      saveResult.status === "CONFLICT" ||
      saveResult.status === "VALIDATION_ERROR"
    ) {
      return {
        entryFormError: saveResult.formError,
        intent,
      } satisfies ProposalActionData;
    }
  }

  if (intent === "approve-meal-plan") {
    const result = await approveMealPlanProposal({
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
      result.status === "CONFLICT" ||
      result.status === "INVALID_TRANSITION" ||
      result.status === "LIVE_PLAN_EXISTS"
    ) {
      return {
        approvalFormError: result.formError,
        intent,
      } satisfies ProposalActionData;
    }

    if (result.status === "APPROVED") {
      const url = new URL(request.url);
      url.pathname = `/families/${familyId}/meal-plans/${mealPlanId}`;
      url.search = "";
      url.searchParams.set("notice", "meal-plan-approved");

      return Response.redirect(url.toString(), 302);
    }

    return {
      approvalFormError: "Kunne ikke godkjenne forslaget.",
      intent,
    } satisfies ProposalActionData;
  }

  if (intent === "save-meal-plan-entries") {
    return {
      intent,
    } satisfies ProposalActionData;
  }

  return {
    entryFormError: "Ugyldig handling.",
  } satisfies ProposalActionData;
}

export default function FamilyMealPlanProposalRoute({
  actionData,
  loaderData,
}: {
  actionData?: ProposalActionData;
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const navigation = useNavigation();
  const pendingIntent = String(navigation.formData?.get("intent") ?? "");
  const isPending = navigation.state !== "idle";
  const isSavingEntries =
    isPending && pendingIntent === "save-meal-plan-entries";
  const isApprovingMealPlan =
    isPending && pendingIntent === "approve-meal-plan";
  const isApprovedView =
    loaderData.mealPlan.status === "APPROVED" || isApprovingMealPlan;
  const [mealSelectionsByDate, setMealSelectionsByDate] = useState(() =>
    Object.fromEntries(
      loaderData.visibleDates.map((date) => [
        date,
        encodeMealSelection(loaderData.entriesByDate[date] ?? {
          freezerItemId: "",
          recipeId: "",
        }),
      ]),
    ),
  );
  const [notesByDate, setNotesByDate] = useState(() =>
    Object.fromEntries(
      loaderData.visibleDates.map((date) => [
        date,
        loaderData.entriesByDate[date]?.note ?? "",
      ]),
    ),
  );
  const displaySelections = useMemo(() => {
    if (!isPending) {
      return mealSelectionsByDate;
    }

    return {
      ...mealSelectionsByDate,
      ...Object.fromEntries(
        loaderData.visibleDates.flatMap((date) => {
          const pending = navigation.formData?.get(`mealSelection:${date}`);

          return pending == null ? [] : [[date, String(pending)]];
        }),
      ),
    };
  }, [isPending, loaderData.visibleDates, mealSelectionsByDate, navigation.formData]);
  const displayNotes = useMemo(() => {
    if (!isPending) {
      return notesByDate;
    }

    return {
      ...notesByDate,
      ...Object.fromEntries(
        loaderData.visibleDates.flatMap((date) => {
          const pending = navigation.formData?.get(`note:${date}`);

          return pending == null ? [] : [[date, String(pending)]];
        }),
      ),
    };
  }, [isPending, loaderData.visibleDates, notesByDate, navigation.formData]);
  const inPlanRecipeIds = useMemo(() => {
    const ids = new Set<string>();

    for (const selection of Object.values(displaySelections)) {
      const parsed = parseMealSelection(selection);

      if (parsed.recipeId) {
        ids.add(parsed.recipeId);
      }
    }

    return ids;
  }, [displaySelections]);
  const recentlyUsedRecipeIds = useMemo(
    () => new Set(loaderData.recentlyUsedRecipeIds),
    [loaderData.recentlyUsedRecipeIds],
  );

  if (isApprovedView) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-slate-100 px-4 py-6 text-slate-900">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
          <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-950">
            <h1 className="text-xl font-semibold">Forslaget er godkjent</h1>
            <p className="mt-2 text-sm leading-6 text-emerald-900">
              {loaderData.mealPlan.title} er nå en ekte ukeplan.
            </p>
            <Link
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-700"
              to={`/families/${loaderData.family.id}/meal-plans/${loaderData.mealPlan.id}`}
            >
              {isApprovingMealPlan ? "Godkjent" : "Åpne ukeplanen"}
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-100 px-4 py-6 text-slate-900">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
        <section className="sticky top-14 z-40 rounded-[24px] bg-slate-950 px-4 py-4 text-white shadow-lg">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-200">
            Forslag
          </p>
          <h1 className="mt-1 truncate text-xl font-semibold">
            {loaderData.mealPlan.title}
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            {formatMealPlanWindow(
              loaderData.mealPlan.startDate,
              loaderData.mealPlan.endDate,
            )}
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Juster middagene om du vil, og godkjenn når forslaget ser bra ut.
          </p>
        </section>

        <Form className="flex flex-col gap-4 mt-16" method="post">
          {loaderData.visibleDates.map((date) => (
            <input key={`entryDate:${date}`} name="entryDate" type="hidden" value={date} />
          ))}
          {loaderData.visibleDates.map((date) => (
            <input
              key={`entryUpdatedAt:${date}`}
              name={`entryUpdatedAt:${date}`}
              type="hidden"
              value={loaderData.entriesByDate[date]?.updatedAt ?? ""}
            />
          ))}

          {actionData?.entryFormError ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {actionData.entryFormError}
            </p>
          ) : null}
          {actionData?.approvalFormError ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {actionData.approvalFormError}
            </p>
          ) : null}

          {loaderData.visibleDates.map((date) => {
            const weekday = formatWeekdayLabel(date);
            const capitalizedWeekday =
              weekday.charAt(0).toUpperCase() + weekday.slice(1);

            return (
              <section
                className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
                key={date}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-base font-semibold text-slate-950">
                    {capitalizedWeekday}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {formatShortDateLabel(date)}
                  </p>
                </div>
                <div className="mt-3">
                  <MealPlanRecipePicker
                    freezerItems={loaderData.freezerItems}
                    inPlanRecipeIds={inPlanRecipeIds}
                    name={`mealSelection:${date}`}
                    onChange={(value) => {
                      setMealSelectionsByDate((current) => ({
                        ...current,
                        [date]: value,
                      }));
                    }}
                    recentlyUsedRecipeIds={recentlyUsedRecipeIds}
                    recipes={loaderData.recipes}
                    triggerLabel="Velg middag"
                    value={displaySelections[date] ?? ""}
                  />
                </div>
                <label className="mt-3 block text-sm font-medium text-slate-700">
                  Notat
                  <textarea
                    className="mt-2 min-h-20 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-950 outline-none transition focus:border-slate-400"
                    name={`note:${date}`}
                    onChange={(event) => {
                      setNotesByDate((current) => ({
                        ...current,
                        [date]: event.target.value,
                      }));
                    }}
                    value={displayNotes[date] ?? ""}
                  />
                </label>
              </section>
            );
          })}

          <div className="sticky bottom-4 z-40 flex flex-col gap-3 mt-6">
            <button
              className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-medium text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              disabled={isPending}
              name="intent"
              type="submit"
              value="save-meal-plan-entries"
            >
              {isSavingEntries ? "Lagret" : "Lagre endringer"}
            </button>
            <button
              className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
              disabled={isPending}
              name="intent"
              type="submit"
              value="approve-meal-plan"
            >
              {isApprovingMealPlan ? "Godkjent" : "Godkjenn"}
            </button>
          </div>
        </>
      </div>
    </main>
  );
}

function parseProposalEntries(formData: FormData): MealPlanEntryValues[] {
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
      responsibleUserId: "",
    };
  });
}

function parseProposalEntryVersions(formData: FormData) {
  return Object.fromEntries(
    formData.getAll("entryDate").map((dateValue) => {
      const date = String(dateValue);

      return [date, String(formData.get(`entryUpdatedAt:${date}`) ?? "")];
    }),
  );
}

function requireRouteParam(value: string | undefined, message: string): string {
  if (!value) {
    throw new Response(message, {
      status: 404,
      statusText: "Not Found",
    });
  }

  return value;
}
