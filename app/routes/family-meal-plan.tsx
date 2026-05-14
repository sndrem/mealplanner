import { Form, Link, isRouteErrorResponse, useNavigation, type MetaFunction } from "react-router";

import { requireUser } from "../lib/auth.server";
import {
  approveMealPlan,
  formatDateOnly,
  getMealPlanPlanningData,
  reopenMealPlan,
  saveMealPlanEntries,
  type MealPlanEntryValues,
  updateMealPlan,
} from "../lib/meal-plan.server";

type MealPlanNotice =
  | "meal-plan-approved"
  | "meal-plan-created"
  | "meal-plan-entries-saved"
  | "meal-plan-reopened"
  | "meal-plan-updated";
type MealPlanIntent =
  | "approve-meal-plan"
  | "reopen-meal-plan"
  | "save-meal-plan-entries"
  | "update-meal-plan";

interface MealPlanEntryFormState {
  note: string;
  recipeId: string;
}

interface MealPlanActionData {
  entryFormError?: string;
  entryValues?: Record<string, MealPlanEntryFormState>;
  fieldErrors?: {
    endDate?: string;
    startDate?: string;
    title?: string;
  };
  formError?: string;
  intent?: MealPlanIntent;
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
    { name: "description", content: "Oppdater navn og datointervall for en familieukeplan." },
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
  const mealPlanId = requireRouteParam(params.mealPlanId, "Fant ikke ukeplanen.");
  const result = await getMealPlanPlanningData({
    familyId,
    mealPlanId,
    userId: user.id,
  });

  const entriesByDate = Object.fromEntries(
    result.visibleDates.map((date) => {
      const entry = result.mealPlan.entries.find(
        (mealPlanEntry) => mealPlanEntry.mealType === "DINNER" && formatDateOnly(mealPlanEntry.date) === date,
      );

      return [
        date,
        {
          note: entry?.note ?? "",
          recipeId: entry?.recipeId ?? "",
        },
      ];
    }),
  );

  return {
    family: result.family,
    mealPlan: {
      ...result.mealPlan,
      approvedAt: result.mealPlan.approvedAt ? result.mealPlan.approvedAt.toISOString() : null,
      endDate: formatDateOnly(result.mealPlan.endDate),
      entries: undefined,
      startDate: formatDateOnly(result.mealPlan.startDate),
    },
    notice: getMealPlanNotice(request),
    recipes: result.recipes,
    userRole: result.userRole,
    visibleDates: result.visibleDates,
    entriesByDate,
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
  const mealPlanId = requireRouteParam(params.mealPlanId, "Fant ikke ukeplanen.");
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "save-meal-plan-entries") {
    const result = await saveMealPlanEntries({
      entries: parseMealPlanEntries(formData),
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

    if (result.status === "VALIDATION_ERROR") {
      return {
        entryFormError: result.formError,
        entryValues: indexMealPlanEntryValues(result.values),
        intent,
      } satisfies MealPlanActionData;
    }

    return buildMealPlanRedirect({
      familyId,
      mealPlanId,
      notice: "meal-plan-entries-saved",
      request,
    });
  }

  if (intent === "approve-meal-plan" || intent === "reopen-meal-plan") {
    const result =
      intent === "approve-meal-plan"
        ? await approveMealPlan({
            familyId,
            mealPlanId,
            userId: user.id,
          })
        : await reopenMealPlan({
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

    if (result.status === "INVALID_TRANSITION") {
      return {
        intent,
        statusFormError: result.formError,
      } satisfies MealPlanActionData;
    }

    return buildMealPlanRedirect({
      familyId,
      mealPlanId,
      notice: result.status === "APPROVED" ? "meal-plan-approved" : "meal-plan-reopened",
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

export default function FamilyMealPlanRoute({ actionData, loaderData }: MealPlanRouteProps) {
  const navigation = useNavigation();
  const pendingIntent = navigation.formData?.get("intent");
  const isApprovingMealPlan = navigation.state === "submitting" && pendingIntent === "approve-meal-plan";
  const isReopeningMealPlan = navigation.state === "submitting" && pendingIntent === "reopen-meal-plan";
  const isSavingEntries = navigation.state === "submitting" && pendingIntent === "save-meal-plan-entries";
  const isUpdatingMetadata = navigation.state === "submitting" && pendingIntent === "update-meal-plan";
  const canManageApproval = loaderData.userRole === "ADMIN";
  const noticeContent = loaderData.notice ? getMealPlanNoticeContent(loaderData.notice) : null;
  const titleValue = actionData?.values?.title ?? loaderData.mealPlan.title;
  const startDateValue = actionData?.values?.startDate ?? loaderData.mealPlan.startDate;
  const endDateValue = actionData?.values?.endDate ?? loaderData.mealPlan.endDate;
  const approvalIntent = loaderData.mealPlan.status === "APPROVED" ? "reopen-meal-plan" : "approve-meal-plan";
  const approvalButtonLabel =
    approvalIntent === "approve-meal-plan"
      ? isApprovingMealPlan
        ? "Godkjenner..."
        : "Godkjenn ukeplan"
      : isReopeningMealPlan
        ? "Gjenapner..."
        : "Gjenapne som utkast";
  const entryValues =
    actionData?.intent === "save-meal-plan-entries" && actionData.entryValues
      ? actionData.entryValues
      : loaderData.entriesByDate;
  const selectedRecipeIds = new Set(
    Object.values(entryValues)
      .map((entry) => entry.recipeId)
      .filter(Boolean),
  );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="rounded-[32px] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
                Middagsplanlegging
              </span>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight">{loaderData.mealPlan.title}</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Planlegg middager dag for dag i den aktive perioden. Oppskrifter og notater lagres pa
                serveren for hele familien.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-600"
                to={`/families/${loaderData.family.id}/meal-plans/${loaderData.mealPlan.id}/shopping`}
              >
                Apne handleliste
              </Link>
              <Link
                className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/15"
                to={`/families/${loaderData.family.id}/meal-plans`}
              >
                Tilbake til ukeplaner
              </Link>
            </div>
          </div>
        </section>

        {noticeContent ? (
          <section className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-6 py-5 text-emerald-950 shadow-sm">
            <h2 className="text-base font-semibold">{noticeContent.title}</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-900">{noticeContent.description}</p>
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-950">Middager for aktiv periode</h2>
              <p className="text-sm leading-6 text-slate-600">
                Hver dag kan ha en middag, et notat eller begge deler. Tomme dager blir lagret som
                up planlagt.
              </p>
            </div>

            <Form className="mt-6 space-y-4" method="post">
              <input name="intent" type="hidden" value="save-meal-plan-entries" />

              <div className="grid gap-4">
                {loaderData.visibleDates.map((date) => {
                  const entry = entryValues[date] ?? { note: "", recipeId: "" };
                  const selectedRecipe = loaderData.recipes.find((recipe) => recipe.id === entry.recipeId) ?? null;

                  return (
                    <article key={date} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                      <input name="entryDate" type="hidden" value={date} />

                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                              Middag
                            </p>
                            <h3 className="mt-2 text-lg font-semibold text-slate-950">
                              {formatWeekdayLabel(date)}
                            </h3>
                            <p className="mt-1 text-sm font-medium text-slate-500">{formatDateLabel(date)}</p>
                          </div>

                          <div className="w-full sm:max-w-sm">
                            <label className="block text-sm font-medium text-slate-700">
                              Oppskrift
                              <select
                                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                                defaultValue={entry.recipeId}
                                name={`recipeId:${date}`}
                              >
                                <option value="">Velg middag</option>
                                {loaderData.recipes.map((recipe) => (
                                  <option key={recipe.id} value={recipe.id}>
                                    {recipe.title}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        </div>

                        <label className="block text-sm font-medium text-slate-700">
                          Notat
                          <textarea
                            className="mt-2 min-h-28 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                            defaultValue={entry.note}
                            name={`note:${date}`}
                            placeholder="F.eks. bytt ut ris med pasta eller husk rester til dagen etter"
                          />
                        </label>

                        <div className="rounded-[20px] bg-white p-4 ring-1 ring-slate-200">
                          <p className="text-sm leading-6 text-slate-600">
                            {selectedRecipe
                              ? `${selectedRecipe.description ?? "Ingen beskrivelse."} · ${selectedRecipe.prepMinutes ?? "?"} min · ${selectedRecipe.defaultServings ?? "?"} personer`
                              : entry.note
                                ? "Bare notat lagres for denne dagen."
                                : "Ingen rett valgt enda."}
                          </p>

                          {selectedRecipe?.tags.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
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
                    </article>
                  );
                })}
              </div>

              {actionData?.intent === "save-meal-plan-entries" && actionData.entryFormError ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {actionData.entryFormError}
                </p>
              ) : null}

              <button
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={isSavingEntries}
                type="submit"
              >
                {isSavingEntries ? "Lagrer middager..." : "Lagre middager"}
              </button>
            </Form>
          </article>

          <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-950">Oppskriftsbank</h2>
              <p className="text-sm leading-6 text-slate-600">
                Seedede oppskrifter du kan bruke i den forste produksjonsflyten for middagsplanlegging.
              </p>
            </div>

            <div className="mt-6 grid gap-3">
              {loaderData.recipes.map((recipe) => (
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
                      <h3 className="text-base font-semibold text-slate-950">{recipe.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{recipe.description}</p>
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
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-950">Detaljer</h2>
              <p className="text-sm leading-6 text-slate-600">
                Planen tilhorer familien {loaderData.family.name} og bruker et lagret datointervall pa maks
                7 dager.
              </p>
            </div>

            <dl className="mt-6 grid gap-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <dt className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Status</dt>
                <dd className="mt-2 text-base font-semibold text-slate-950">
                  {loaderData.mealPlan.status === "APPROVED" ? "Godkjent" : "Utkast"}
                </dd>
                {loaderData.mealPlan.approvedAt ? (
                  <dd className="mt-2 text-sm leading-6 text-slate-600">
                    Godkjent {formatApprovalTimestamp(loaderData.mealPlan.approvedAt)}
                  </dd>
                ) : null}
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <dt className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                  Aktiv periode
                </dt>
                <dd className="mt-2 text-base font-semibold text-slate-950">
                  {formatMealPlanWindow(loaderData.mealPlan.startDate, loaderData.mealPlan.endDate)}
                </dd>
              </div>
            </dl>

            {canManageApproval ? (
              <Form className="mt-6 space-y-4" method="post">
                <input name="intent" type="hidden" value={approvalIntent} />

                <p className="text-sm leading-6 text-slate-600">
                  Godkjenning markerer ukeplanen som klar for neste steg uten a lase redigering enda.
                </p>

                {(actionData?.intent === "approve-meal-plan" || actionData?.intent === "reopen-meal-plan") &&
                actionData.statusFormError ? (
                  <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {actionData.statusFormError}
                  </p>
                ) : null}

                <button
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={isApprovingMealPlan || isReopeningMealPlan}
                  type="submit"
                >
                  {approvalButtonLabel}
                </button>
              </Form>
            ) : null}
          </article>

          <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-950">Oppdater ukeplan</h2>
              <p className="text-sm leading-6 text-slate-600">
                Du kan fortsatt endre navn og datointervall her. Datointervallet kan vare maks 7 dager.
              </p>
            </div>

            <Form className="mt-6 space-y-4" method="post">
              <input name="intent" type="hidden" value="update-meal-plan" />

              <label className="block text-sm font-medium text-slate-700">
                Navn
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  defaultValue={titleValue}
                  name="title"
                  type="text"
                />
              </label>

              {actionData?.intent === "update-meal-plan" && actionData.fieldErrors?.title ? (
                <p className="text-sm text-rose-600">{actionData.fieldErrors.title}</p>
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

              {actionData?.intent === "update-meal-plan" && actionData.fieldErrors?.startDate ? (
                <p className="text-sm text-rose-600">{actionData.fieldErrors.startDate}</p>
              ) : null}
              {actionData?.intent === "update-meal-plan" && actionData.fieldErrors?.endDate ? (
                <p className="text-sm text-rose-600">{actionData.fieldErrors.endDate}</p>
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
  let description = "Vi klarte ikke a laste ukeplanen.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 403) {
      title = "Ingen tilgang";
      description = "Du har ikke tilgang til denne familieukeplanen.";
    } else if (error.status === 404) {
      title = "Ukeplanen finnes ikke";
      description = "Vi fant ikke ukeplanen du forsokte a apne.";
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
    notice === "meal-plan-created" ||
    notice === "meal-plan-entries-saved" ||
    notice === "meal-plan-reopened" ||
    notice === "meal-plan-updated"
  ) {
    return notice;
  }

  return null;
}

function buildMealPlanRedirect({
  familyId,
  mealPlanId,
  notice,
  request,
}: {
  familyId: string;
  mealPlanId: string;
  notice: MealPlanNotice;
  request: Request;
}) {
  const url = new URL(`/families/${familyId}/meal-plans/${mealPlanId}`, request.url);
  url.searchParams.set("notice", notice);

  return Response.redirect(url, 302);
}

function getMealPlanNoticeContent(notice: MealPlanNotice) {
  switch (notice) {
    case "meal-plan-approved":
      return {
        description: "Ukeplanen er markert som godkjent og klar for neste steg.",
        title: "Ukeplan godkjent",
      };
    case "meal-plan-created":
      return {
        description: "Ukeplanen er klar for videre arbeid med innhold og handleliste.",
        title: "Ukeplan opprettet",
      };
    case "meal-plan-entries-saved":
      return {
        description: "Middagene og notatene ble lagret for den aktive perioden.",
        title: "Middager lagret",
      };
    case "meal-plan-reopened":
      return {
        description: "Ukeplanen er gjenapnet som utkast og kan fortsatt redigeres.",
        title: "Ukeplan gjenapnet",
      };
    case "meal-plan-updated":
      return {
        description: "Endringene i navn og datointervall ble lagret.",
        title: "Ukeplan oppdatert",
      };
  }
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

    return {
      date,
      note: String(formData.get(`note:${date}`) ?? ""),
      recipeId: String(formData.get(`recipeId:${date}`) ?? ""),
    };
  });
}

function indexMealPlanEntryValues(entries: MealPlanEntryValues[]) {
  return Object.fromEntries(
    entries.map((entry) => [
      entry.date,
      {
        note: entry.note,
        recipeId: entry.recipeId,
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
