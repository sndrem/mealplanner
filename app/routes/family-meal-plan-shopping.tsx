import { Link, isRouteErrorResponse, type MetaFunction } from "react-router";

import { requireUser } from "../lib/auth.server";
import { getMealPlanShoppingData } from "../lib/shopping.server";

interface FamilyMealPlanShoppingRouteProps {
  loaderData: Awaited<ReturnType<typeof loader>>;
}

export const meta: MetaFunction = () => {
  return [
    { title: "Handleliste | Mealplanner" },
    { name: "description", content: "Servergenerert handleliste for valgt familieukeplan." },
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
  const result = await getMealPlanShoppingData({
    familyId,
    mealPlanId,
    userId: user.id,
  });

  return {
    family: result.family,
    mealPlan: {
      ...result.mealPlan,
      endDate: formatDateOnly(result.mealPlan.endDate),
      entries: undefined,
      shoppingOverrides: undefined,
      startDate: formatDateOnly(result.mealPlan.startDate),
    },
    projectedItemCount: result.projectedItems.length,
    storeGroups: result.storeGroups.map((group) => ({
      sections: group.sections.map((section) => ({
        ...section,
        items: section.items.map((item) => ({
          ...item,
          firstDate: formatDateOnly(item.firstDate),
          lastDate: formatDateOnly(item.lastDate),
          occurrences: item.occurrences.map((occurrence) => ({
            ...occurrence,
            date: formatDateOnly(occurrence.date),
          })),
          postponedUntilDate: item.postponedUntilDate ? formatDateOnly(item.postponedUntilDate) : null,
        })),
      })),
      store: group.store,
    })),
    userRole: result.userRole,
    visibleDates: result.visibleDates,
  };
}

export default function FamilyMealPlanShoppingRoute({ loaderData }: FamilyMealPlanShoppingRouteProps) {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="rounded-[32px] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
                Handleliste
              </span>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight">{loaderData.mealPlan.title}</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Dette er en servergenerert projeksjon av ingrediensene fra planlagte middager i den aktive
                perioden. Listen er deterministisk og viser hvilke oppskrifter hvert punkt kommer fra.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-600"
                to={`/families/${loaderData.family.id}/meal-plans/${loaderData.mealPlan.id}`}
              >
                Tilbake til ukeplan
              </Link>
              <Link
                className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/15"
                to={`/families/${loaderData.family.id}/meal-plans`}
              >
                Alle ukeplaner
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-950">Projeksjon</h2>
              <p className="text-sm leading-6 text-slate-600">
                Listen dekker perioden {formatMealPlanWindow(loaderData.mealPlan.startDate, loaderData.mealPlan.endDate)}
                {" "}og inneholder {loaderData.projectedItemCount} genererte varelinjer.
              </p>
            </div>

            <dl className="mt-6 grid gap-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <dt className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Status</dt>
                <dd className="mt-2 text-base font-semibold text-slate-950">
                  {loaderData.mealPlan.status === "APPROVED" ? "Godkjent" : "Utkast"}
                </dd>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <dt className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Synlige datoer</dt>
                <dd className="mt-2 text-sm leading-6 text-slate-700">
                  {loaderData.visibleDates.map(formatDateLabel).join(", ")}
                </dd>
              </div>
            </dl>
          </article>

          <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-950">Hvordan dette bygges</h2>
              <p className="text-sm leading-6 text-slate-600">
                Hvert punkt er laget fra lagrede oppskriftsingredienser pa serveren. Like ingredienser blir
                bare slaatt sammen nar navn, mengde, enhet, kategori og foretrukket butikk matcher eksakt.
              </p>
            </div>
          </article>
        </section>

        {loaderData.storeGroups.length ? (
          <section className="grid gap-6">
            {loaderData.storeGroups.map((group) => (
              <article
                key={group.store?.id ?? "no-store"}
                className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200"
              >
                <div className="flex flex-col gap-2">
                  <h2 className="text-lg font-semibold text-slate-950">
                    {group.store?.name ?? "Ingen valgt butikk"}
                  </h2>
                  <p className="text-sm leading-6 text-slate-600">
                    {group.store
                      ? "Varene er sortert etter butikkens seksjoner der de finnes."
                      : "Disse varene har ingen foretrukket butikk ennå."}
                  </p>
                </div>

                <div className="mt-6 grid gap-5">
                  {group.sections.map((section) => (
                    <section key={`${group.store?.id ?? "no-store"}:${section.category.id}`}>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                        {section.displayName}
                      </h3>

                      <div className="mt-3 grid gap-3">
                        {section.items.map((item) => (
                          <article
                            key={item.sourceKey}
                            className="rounded-[24px] border border-slate-200 bg-slate-50 p-5"
                          >
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-base font-semibold text-slate-950">{item.name}</h4>
                                  {item.quantityLabel ? (
                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                                      {item.quantityLabel}
                                    </span>
                                  ) : null}
                                  {item.checked ? (
                                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                                      Avkrysset
                                    </span>
                                  ) : null}
                                  {item.postponedUntilDate ? (
                                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                                      Utsatt til {formatDateLabel(item.postponedUntilDate)}
                                    </span>
                                  ) : null}
                                </div>

                                <p className="mt-3 text-sm leading-6 text-slate-600">
                                  Fra {item.occurrenceCount} planlagte {item.occurrenceCount === 1 ? "middag" : "middager"}
                                  {" "}mellom {formatDateLabel(item.firstDate)} og {formatDateLabel(item.lastDate)}.
                                </p>
                                {item.note ? (
                                  <p className="mt-2 text-sm leading-6 text-slate-700">Notat: {item.note}</p>
                                ) : null}
                              </div>

                              <div className="rounded-[20px] bg-white p-4 ring-1 ring-slate-200 md:max-w-sm">
                                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                                  Kilder
                                </p>
                                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                                  {item.occurrences.map((occurrence) => (
                                    <li key={`${occurrence.mealPlanEntryId}:${occurrence.recipeIngredientId}`}>
                                      {formatDateLabel(occurrence.date)}: {occurrence.recipeTitle}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-950">Ingen varer ennå</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Legg til middager i ukeplanen for a generere handlelisten pa serveren.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  let title = "Noe gikk galt";
  let description = "Vi klarte ikke a laste handlelisten.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 403) {
      title = "Ingen tilgang";
      description = "Du har ikke tilgang til denne familiehandlelisten.";
    } else if (error.status === 404) {
      title = "Handlelisten finnes ikke";
      description = "Vi fant ikke ukeplanen du forsokte a hente handlelisten for.";
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

function formatDateOnly(date: Date) {
  return [
    date.getUTCFullYear().toString().padStart(4, "0"),
    (date.getUTCMonth() + 1).toString().padStart(2, "0"),
    date.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatMealPlanWindow(startDate: string, endDate: string) {
  return `${formatDateLabel(startDate)} til ${formatDateLabel(endDate)}`;
}
