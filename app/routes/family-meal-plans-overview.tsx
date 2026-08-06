import { Link, type MetaFunction } from "react-router";

import { requireUser } from "../lib/auth.server";
import {
  formatDateOnly,
  getDinnerAnalyticsForFamily,
  type DinnerAnalyticsTimeframe,
} from "../lib/meal-plan.server";

const TIMEFRAME_OPTIONS: Array<{
  description: string;
  label: string;
  value: DinnerAnalyticsTimeframe;
}> = [
  {
    description: "Gir deg et raskt bilde av den siste måneden.",
    label: "Siste 30 dager",
    value: "30d",
  },
  {
    description: "Passer for å se sesongmønstre over et kvartal.",
    label: "Siste 90 dager",
    value: "90d",
  },
  {
    description: "Bruk hele historikken for et langsiktig bilde.",
    label: "Hele historikken",
    value: "all",
  },
];

export const meta: MetaFunction = () => {
  return [
    { title: "Middagstatistikk | Mealplanner" },
    {
      name: "description",
      content:
        "Se hvilke oppskrifter og ingredienser som brukes mest i familiens middager.",
    },
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
  const timeframe = parseDinnerAnalyticsTimeframe(
    new URL(request.url).searchParams.get("timeframe"),
  );
  const result = await getDinnerAnalyticsForFamily({
    familyId,
    timeframe,
    userId: user.id,
  });

  return {
    family: result.family,
    latestRecipesUsed: result.latestRecipesUsed.map((usage) => ({
      ...usage,
      date: formatDateOnly(usage.date),
    })),
    mostUsedIngredients: result.mostUsedIngredients,
    mostUsedRecipes: result.mostUsedRecipes,
    timeframe: result.timeframe,
    timeframeStartDate: result.timeframeStartDate
      ? formatDateOnly(result.timeframeStartDate)
      : null,
  };
}

export default function FamilyMealPlansOverviewRoute({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const hasData =
    loaderData.mostUsedIngredients.length > 0 ||
    loaderData.mostUsedRecipes.length > 0 ||
    loaderData.latestRecipesUsed.length > 0;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="rounded-4xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
                Middagstatistikk
              </span>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight">
                {loaderData.family.name}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Se hvilke middager som går igjen, og bruk innsikten til å variere
                ukeplanene mer.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-600"
                to={`/families/${loaderData.family.id}/meal-plans`}
              >
                Til ukeplaner
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Tidsrom</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Bytt tidsrom for å sammenligne nyere vaner med hele historikken.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {TIMEFRAME_OPTIONS.map((option) => {
              const isActive = loaderData.timeframe === option.value;

              return (
                <Link
                  key={option.value}
                  className={[
                    "rounded-2xl border px-4 py-3 text-sm transition",
                    isActive
                      ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                  ].join(" ")}
                  to={`?timeframe=${option.value}`}
                >
                  <p className="font-medium">{option.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {option.description}
                  </p>
                </Link>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            {getTimeframeDescription(
              loaderData.timeframe,
              loaderData.timeframeStartDate,
            )}
          </p>
        </section>

        {!hasData ? (
          <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-8 text-slate-700 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Ingen middager å analysere ennå
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6">
              Legg til middager i ukeplanene, så får dere fort oversikt over hvilke
              oppskrifter og ingredienser som brukes mest.
            </p>
          </section>
        ) : null}

        {hasData ? (
          <section className="grid gap-6 md:grid-cols-2">
            <article className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Mest brukte ingredienser
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Antall ganger ingrediensen forekommer i planlagte middager.
              </p>
              <ol className="mt-4 space-y-3">
                {loaderData.mostUsedIngredients.map((ingredient) => (
                  <li
                    className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                    key={ingredient.ingredientName}
                  >
                    <span className="text-sm font-medium text-slate-800">
                      {ingredient.ingredientName}
                    </span>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      {ingredient.count}
                    </span>
                  </li>
                ))}
              </ol>
            </article>

            <article className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Mest brukte oppskrifter
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Oppskrifter som går igjen oftest i middagene.
              </p>
              <ol className="mt-4 space-y-3">
                {loaderData.mostUsedRecipes.map((recipe) => (
                  <li
                    className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                    key={recipe.recipeId}
                  >
                    <Link
                      className="text-sm font-medium text-emerald-800 hover:text-emerald-900 hover:underline"
                      to={`/families/${loaderData.family.id}/recipes/${recipe.recipeId}`}
                    >
                      {recipe.recipeTitle}
                    </Link>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      {recipe.count}
                    </span>
                  </li>
                ))}
              </ol>
            </article>
          </section>
        ) : null}

        {loaderData.latestRecipesUsed.length > 0 ? (
          <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Sist brukte oppskrifter
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Siste registrerte middager i valgt tidsrom.
            </p>
            <ol className="mt-4 space-y-3">
              {loaderData.latestRecipesUsed.map((usage, index) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                  key={`${usage.recipeId}-${usage.date}-${index}`}
                >
                  <Link
                    className="text-sm font-medium text-emerald-800 hover:text-emerald-900 hover:underline"
                    to={`/families/${loaderData.family.id}/recipes/${usage.recipeId}`}
                  >
                    {usage.recipeTitle}
                  </Link>
                  <span className="text-xs font-medium text-slate-500">
                    {usage.date}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
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

function parseDinnerAnalyticsTimeframe(
  value: string | null,
): DinnerAnalyticsTimeframe {
  if (value === "30d" || value === "90d" || value === "all") {
    return value;
  }

  return "90d";
}

function getTimeframeDescription(
  timeframe: DinnerAnalyticsTimeframe,
  timeframeStartDate: string | null,
) {
  if (timeframe === "all") {
    return "Viser alle registrerte middager.";
  }

  if (!timeframeStartDate) {
    return "Viser et avgrenset tidsrom.";
  }

  return `Viser middager fra og med ${timeframeStartDate}.`;
}
