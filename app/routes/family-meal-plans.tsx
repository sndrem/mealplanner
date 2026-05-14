import { Form, Link, useNavigation, type MetaFunction } from "react-router";

import { requireUser } from "../lib/auth.server";
import {
  copyMealPlan,
  createMealPlan,
  deleteMealPlan,
  formatDateOnly,
  listMealPlansForFamily,
} from "../lib/meal-plan.server";

type MealPlanNotice = "meal-plan-copied" | "meal-plan-created" | "meal-plan-deleted";

interface MealPlanActionData {
  fieldErrors?: {
    endDate?: string;
    startDate?: string;
    title?: string;
  };
  formError?: string;
  intent?: "create-meal-plan" | "delete-meal-plan";
  targetMealPlanId?: string;
  values?: {
    endDate?: string;
    sourceMealPlanId?: string;
    startDate?: string;
    title?: string;
  };
}

interface MealPlanListRouteProps {
  actionData?: MealPlanActionData;
  loaderData: Awaited<ReturnType<typeof loader>>;
}

export const meta: MetaFunction = () => {
  return [
    { title: "Ukeplaner | Mealplanner" },
    { name: "description", content: "Administrer familieukeplaner i Mealplanner." },
  ];
};

export async function loader({
  params,
  request,
}: {
  params: {
    familyId?: string;
  };
  request: Request;
}) {
  const user = await requireUser(request);
  const familyId = requireFamilyId(params.familyId);
  const result = await listMealPlansForFamily({
    familyId,
    userId: user.id,
  });

  return {
    family: result.family,
    mealPlans: result.mealPlans.map((mealPlan) => ({
      ...mealPlan,
      endDate: formatDateOnly(mealPlan.endDate),
      startDate: formatDateOnly(mealPlan.startDate),
    })),
    notice: getMealPlanNotice(request),
  };
}

export async function action({
  params,
  request,
}: {
  params: {
    familyId?: string;
  };
  request: Request;
}) {
  const user = await requireUser(request);
  const familyId = requireFamilyId(params.familyId);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "create-meal-plan") {
    const values = {
      endDate: String(formData.get("endDate") ?? ""),
      sourceMealPlanId: String(formData.get("sourceMealPlanId") ?? "").trim(),
      startDate: String(formData.get("startDate") ?? ""),
      title: String(formData.get("title") ?? ""),
    };
    const result = values.sourceMealPlanId
      ? await copyMealPlan({
          endDate: values.endDate,
          familyId,
          sourceMealPlanId: values.sourceMealPlanId,
          startDate: values.startDate,
          title: values.title,
          userId: user.id,
        })
      : await createMealPlan({
          endDate: values.endDate,
          familyId,
          startDate: values.startDate,
          title: values.title,
          userId: user.id,
        });

    if (result.status === "VALIDATION_ERROR") {
      return {
        fieldErrors: result.fieldErrors,
        intent,
        values: {
          ...result.values,
          sourceMealPlanId: values.sourceMealPlanId,
        },
      } satisfies MealPlanActionData;
    }

    if (result.status === "NOT_FOUND") {
      return {
        formError: "Fant ikke ukeplanen du ville gjenbruke. Velg en annen ukeplan og prov igjen.",
        intent,
        values,
      } satisfies MealPlanActionData;
    }

    return buildMealPlanRedirect({
      familyId,
      notice: values.sourceMealPlanId ? "meal-plan-copied" : "meal-plan-created",
      request,
    });
  }

  if (intent === "delete-meal-plan") {
    const mealPlanId = String(formData.get("mealPlanId") ?? "");

    if (!mealPlanId) {
      return {
        formError: "Fant ikke ukeplanen som skulle slettes.",
      } satisfies MealPlanActionData;
    }

    const result = await deleteMealPlan({
      familyId,
      mealPlanId,
      userId: user.id,
    });

    if (result.status === "NOT_FOUND") {
      return {
        formError: "Fant ikke ukeplanen som skulle slettes.",
        intent,
        targetMealPlanId: mealPlanId,
      } satisfies MealPlanActionData;
    }

    return buildMealPlanRedirect({
      familyId,
      notice: "meal-plan-deleted",
      request,
    });
  }

  return {
    formError: "Ukjent handling.",
  } satisfies MealPlanActionData;
}

export default function FamilyMealPlansRoute({ actionData, loaderData }: MealPlanListRouteProps) {
  const navigation = useNavigation();
  const noticeContent = loaderData.notice ? getMealPlanNoticeContent(loaderData.notice) : null;
  const pendingIntent = navigation.formData?.get("intent");
  const pendingMealPlanId = String(navigation.formData?.get("mealPlanId") ?? "");
  const isCreatingMealPlan = navigation.state === "submitting" && pendingIntent === "create-meal-plan";
  const isDeletingMealPlan = navigation.state === "submitting" && pendingIntent === "delete-meal-plan";
  const sourceMealPlanValue = actionData?.intent === "create-meal-plan" ? actionData.values?.sourceMealPlanId ?? "" : "";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="rounded-[32px] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
                Ukeplaner
              </span>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight">{loaderData.family.name}</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Opprett og administrer familieukeplaner med lagrede start- og sluttdatoer.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/15"
                to={`/families/${loaderData.family.id}`}
              >
                Tilbake til familie
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

        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-950">Opprett ukeplan</h2>
              <p className="text-sm leading-6 text-slate-600">
                Velg et navn og et datointervall pa maks 7 dager. Du kan starte fra en tom ukeplan eller
                gjenbruke middager og notater fra en tidligere plan.
              </p>
            </div>

            <Form className="mt-6 space-y-4" method="post">
              <input name="intent" type="hidden" value="create-meal-plan" />

              <label className="block text-sm font-medium text-slate-700">
                Navn
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  defaultValue={actionData?.intent === "create-meal-plan" ? actionData.values?.title ?? "" : ""}
                  name="title"
                  placeholder="For eksempel Uke 20"
                  type="text"
                />
              </label>

              {actionData?.intent === "create-meal-plan" && actionData.fieldErrors?.title ? (
                <p className="text-sm text-rose-600">{actionData.fieldErrors.title}</p>
              ) : null}

              <label className="block text-sm font-medium text-slate-700">
                Start med eksisterende ukeplan
                <select
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  defaultValue={sourceMealPlanValue}
                  name="sourceMealPlanId"
                >
                  <option value="">Tom ukeplan</option>
                  {loaderData.mealPlans.map((mealPlan) => (
                    <option key={mealPlan.id} value={mealPlan.id}>
                      {mealPlan.title} ({formatMealPlanWindow(mealPlan.startDate, mealPlan.endDate)})
                    </option>
                  ))}
                </select>
              </label>

              <p className="text-sm leading-6 text-slate-500">
                Velg en tidligere ukeplan for a kopiere middager og notater til samme relative dager i den
                nye perioden.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Startdato
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    defaultValue={
                      actionData?.intent === "create-meal-plan" ? actionData.values?.startDate ?? "" : ""
                    }
                    name="startDate"
                    type="date"
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Sluttdato
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    defaultValue={actionData?.intent === "create-meal-plan" ? actionData.values?.endDate ?? "" : ""}
                    name="endDate"
                    type="date"
                  />
                </label>
              </div>

              {actionData?.intent === "create-meal-plan" && actionData.fieldErrors?.startDate ? (
                <p className="text-sm text-rose-600">{actionData.fieldErrors.startDate}</p>
              ) : null}
              {actionData?.intent === "create-meal-plan" && actionData.fieldErrors?.endDate ? (
                <p className="text-sm text-rose-600">{actionData.fieldErrors.endDate}</p>
              ) : null}
              {actionData?.formError ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {actionData.formError}
                </p>
              ) : null}

              <button
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={isCreatingMealPlan}
                type="submit"
              >
                {isCreatingMealPlan ? "Lagrer..." : "Opprett ukeplan"}
              </button>
            </Form>
          </article>

          <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-950">Lagrede ukeplaner</h2>
              <p className="text-sm leading-6 text-slate-600">
                Velg en ukeplan for a redigere navn og datoer, eller slett planer familien ikke trenger
                lenger.
              </p>
            </div>

            {loaderData.mealPlans.length > 0 ? (
              <div className="mt-6 grid gap-4">
                {loaderData.mealPlans.map((mealPlan) => {
                  const isPendingDelete = isDeletingMealPlan && pendingMealPlanId === mealPlan.id;
                  const deleteError =
                    actionData?.targetMealPlanId === mealPlan.id ? actionData.formError : undefined;

                  return (
                    <article key={mealPlan.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-base font-semibold text-slate-950">{mealPlan.title}</h3>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
                              {mealPlan.status === "APPROVED" ? "Godkjent" : "Utkast"}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {formatMealPlanWindow(mealPlan.startDate, mealPlan.endDate)}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Link
                            className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                            to={`/families/${loaderData.family.id}/meal-plans/${mealPlan.id}`}
                          >
                            Apne ukeplan
                          </Link>

                          <Form method="post">
                            <input name="intent" type="hidden" value="delete-meal-plan" />
                            <input name="mealPlanId" type="hidden" value={mealPlan.id} />
                            <button
                              className="inline-flex items-center justify-center rounded-2xl bg-rose-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
                              disabled={isDeletingMealPlan}
                              type="submit"
                            >
                              {isPendingDelete ? "Sletter..." : "Slett"}
                            </button>
                          </Form>
                        </div>
                      </div>

                      {deleteError ? (
                        <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                          {deleteError}
                        </p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6">
                <h3 className="text-base font-semibold text-slate-950">Ingen ukeplaner ennå</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Opprett familiens forste ukeplan for a komme i gang med serverlagret planlegging.
                </p>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

function requireFamilyId(familyId: string | undefined) {
  if (!familyId) {
    throw new Response("Fant ikke familien.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  return familyId;
}

function getMealPlanNotice(request: Request): MealPlanNotice | null {
  const notice = new URL(request.url).searchParams.get("notice");

  if (notice === "meal-plan-copied" || notice === "meal-plan-created" || notice === "meal-plan-deleted") {
    return notice;
  }

  return null;
}

function buildMealPlanRedirect({
  familyId,
  notice,
  request,
}: {
  familyId: string;
  notice: MealPlanNotice;
  request: Request;
}) {
  const url = new URL(`/families/${familyId}/meal-plans`, request.url);
  url.searchParams.set("notice", notice);

  return Response.redirect(url, 302);
}

function getMealPlanNoticeContent(notice: MealPlanNotice) {
  switch (notice) {
    case "meal-plan-copied":
      return {
        description: "Den nye ukeplanen ble opprettet med kopierte middager og notater i den valgte perioden.",
        title: "Ukeplan gjenbrukt",
      };
    case "meal-plan-created":
      return {
        description: "Ukeplanen ble lagret med start- og sluttdato for familien.",
        title: "Ukeplan opprettet",
      };
    case "meal-plan-deleted":
      return {
        description: "Ukeplanen ble slettet fra familien.",
        title: "Ukeplan slettet",
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
