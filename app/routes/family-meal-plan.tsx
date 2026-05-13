import { Form, Link, isRouteErrorResponse, useNavigation, type MetaFunction } from "react-router";

import { requireUser } from "../lib/auth.server";
import { formatDateOnly, getMealPlanForFamily, updateMealPlan } from "../lib/meal-plan.server";

type MealPlanNotice = "meal-plan-created" | "meal-plan-updated";

interface MealPlanActionData {
  fieldErrors?: {
    endDate?: string;
    startDate?: string;
    title?: string;
  };
  formError?: string;
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
  const result = await getMealPlanForFamily({
    familyId,
    mealPlanId,
    userId: user.id,
  });

  return {
    family: result.family,
    mealPlan: {
      ...result.mealPlan,
      endDate: formatDateOnly(result.mealPlan.endDate),
      startDate: formatDateOnly(result.mealPlan.startDate),
    },
    notice: getMealPlanNotice(request),
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
  const isSubmitting = navigation.state === "submitting";
  const noticeContent = loaderData.notice ? getMealPlanNoticeContent(loaderData.notice) : null;
  const titleValue = actionData?.values?.title ?? loaderData.mealPlan.title;
  const startDateValue = actionData?.values?.startDate ?? loaderData.mealPlan.startDate;
  const endDateValue = actionData?.values?.endDate ?? loaderData.mealPlan.endDate;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="rounded-[32px] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
                Rediger ukeplan
              </span>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight">{loaderData.mealPlan.title}</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Oppdater navn og datointervall for denne familieukeplanen. Daglige malinger og handleliste
                kan bygges videre pa denne ruten senere.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
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

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-950">Detaljer</h2>
              <p className="text-sm leading-6 text-slate-600">
                Planen tilhorer familien {loaderData.family.name} og bruker et lagret datointervall som
                grunnlag for neste steg i planleggingsflyten.
              </p>
            </div>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <dt className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Status</dt>
                <dd className="mt-2 text-base font-semibold text-slate-950">
                  {loaderData.mealPlan.status === "APPROVED" ? "Godkjent" : "Utkast"}
                </dd>
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
          </article>

          <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-950">Oppdater ukeplan</h2>
              <p className="text-sm leading-6 text-slate-600">
                Datointervallet kan vare maks 7 dager og ma alltid ha en gyldig start- og sluttdato.
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

              {actionData?.fieldErrors?.title ? <p className="text-sm text-rose-600">{actionData.fieldErrors.title}</p> : null}

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

              {actionData?.fieldErrors?.startDate ? (
                <p className="text-sm text-rose-600">{actionData.fieldErrors.startDate}</p>
              ) : null}
              {actionData?.fieldErrors?.endDate ? (
                <p className="text-sm text-rose-600">{actionData.fieldErrors.endDate}</p>
              ) : null}
              {actionData?.formError ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {actionData.formError}
                </p>
              ) : null}

              <button
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Lagrer..." : "Lagre endringer"}
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

  if (notice === "meal-plan-created" || notice === "meal-plan-updated") {
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
    case "meal-plan-created":
      return {
        description: "Ukeplanen er klar for videre arbeid med innhold og handleliste.",
        title: "Ukeplan opprettet",
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
