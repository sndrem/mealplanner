import {
  Form,
  Link,
  isRouteErrorResponse,
  useNavigation,
  type MetaFunction,
} from "react-router";

import { requireUser } from "../lib/auth.server";
import {
  listFamilyStockIngredients,
  searchCanonicalIngredients,
} from "../lib/stock.server";
import {
  addFamilyStockIngredient,
  removeFamilyStockIngredient,
  type AddFamilyStockIngredientFieldErrors,
  type AddFamilyStockIngredientValues,
} from "../lib/stock-write.server";

type StockNotice = "stock-ingredient-added" | "stock-ingredient-removed";

type StockIntent = "add-stock-ingredient" | "remove-stock-ingredient";

interface StockActionData {
  addFieldErrors?: AddFamilyStockIngredientFieldErrors;
  addValues?: AddFamilyStockIngredientValues;
  formError?: string;
  intent?: StockIntent;
  targetStockIngredientId?: string;
}

interface FamilyStockIngredientsRouteProps {
  actionData?: StockActionData;
  loaderData: Awaited<ReturnType<typeof loader>>;
}

export const meta: MetaFunction = () => {
  return [
    { title: "Basisvarer | Mealplanner" },
    {
      name: "description",
      content:
        "Administrer basisvarer som vanligvis er på lager og holdes utenfor handlelisten.",
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
  const searchQuery = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const result = await listFamilyStockIngredients({
    familyId,
    userId: user.id,
  });
  const searchResults =
    searchQuery.length > 0
      ? await searchCanonicalIngredients(searchQuery)
      : [];

  return {
    family: result.family,
    notice: getStockNotice(request),
    searchQuery,
    searchResults,
    stockIngredients: result.stockIngredients,
    userRole: result.userRole,
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

  if (intent === "add-stock-ingredient") {
    const result = await addFamilyStockIngredient({
      familyId,
      userId: user.id,
      values: {
        displayName: String(formData.get("displayName") ?? ""),
        ingredientId: String(formData.get("ingredientId") ?? ""),
        note: String(formData.get("note") ?? ""),
      },
    });

    if (result.status === "VALIDATION_ERROR") {
      return {
        addFieldErrors: result.fieldErrors,
        addValues: result.values,
        intent,
      } satisfies StockActionData;
    }

    return buildStockRedirect({
      familyId,
      notice: "stock-ingredient-added",
      request,
    });
  }

  if (intent === "remove-stock-ingredient") {
    const stockIngredientId = String(formData.get("stockIngredientId") ?? "");

    if (!stockIngredientId) {
      return {
        formError: "Fant ikke basisvaren som skulle fjernes.",
        intent,
      } satisfies StockActionData;
    }

    const result = await removeFamilyStockIngredient({
      familyId,
      stockIngredientId,
      userId: user.id,
    });

    if (result.status === "NOT_FOUND") {
      return {
        formError: "Fant ikke basisvaren som skulle fjernes.",
        intent,
        targetStockIngredientId: stockIngredientId,
      } satisfies StockActionData;
    }

    return buildStockRedirect({
      familyId,
      notice: "stock-ingredient-removed",
      request,
    });
  }

  return {
    formError: "Ukjent handling.",
  } satisfies StockActionData;
}

export default function FamilyStockIngredientsRoute({
  actionData,
  loaderData,
}: FamilyStockIngredientsRouteProps) {
  const navigation = useNavigation();
  const noticeContent = loaderData.notice
    ? getStockNoticeContent(loaderData.notice)
    : null;
  const pendingIntent = navigation.formData?.get("intent");
  const addValues =
    actionData?.intent === "add-stock-ingredient" && actionData.addValues
      ? actionData.addValues
      : {
          displayName: "",
          ingredientId: "",
          note: "",
        };
  const canManageStock = loaderData.userRole === "ADMIN";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="rounded-[32px] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
                Basisvarer
              </span>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight">
                {loaderData.family.name}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Vanligvis på lager. Basisvarer vises fortsatt i oppskrifter, men
                holdes utenfor den automatiske handlelisten med mindre dere
                velger å ta dem med for uken.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-600"
                to={`/families/${loaderData.family.id}/meal-plans`}
              >
                Åpne ukeplaner
              </Link>
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
            <p className="mt-2 text-sm leading-6 text-emerald-900">
              {noticeContent.description}
            </p>
          </section>
        ) : null}

        {actionData?.formError ? (
          <section className="rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-5 text-rose-900 shadow-sm">
            <h2 className="text-base font-semibold">
              Kunne ikke oppdatere basisvarene
            </h2>
            <p className="mt-2 text-sm leading-6">{actionData.formError}</p>
          </section>
        ) : null}

        {canManageStock ? (
          <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-950">
                Legg til basisvare
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                Søk etter en kanonisk ingrediens, eller skriv inn et navn som
                skal matches mot oppskriftslinjer uten kobling.
              </p>
            </div>

            <Form className="mt-6 space-y-4" method="get">
              <label className="block text-sm font-medium text-slate-700">
                Søk i ingrediensregister
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  defaultValue={loaderData.searchQuery}
                  name="q"
                  placeholder="For eksempel salt"
                  type="search"
                />
              </label>
              <button
                className="inline-flex rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                type="submit"
              >
                Søk
              </button>
            </Form>

            {loaderData.searchResults.length > 0 ? (
              <ul className="mt-4 grid gap-2">
                {loaderData.searchResults.map((ingredient) => (
                  <li key={ingredient.id}>
                    <Form className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" method="post">
                      <input name="intent" type="hidden" value="add-stock-ingredient" />
                      <input name="ingredientId" type="hidden" value={ingredient.id} />
                      <input name="displayName" type="hidden" value="" />
                      <input name="note" type="hidden" value="" />
                      <span className="text-sm font-medium text-slate-900">
                        {ingredient.canonicalName}
                      </span>
                      <button
                        className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-800"
                        type="submit"
                      >
                        Legg til
                      </button>
                    </Form>
                  </li>
                ))}
              </ul>
            ) : null}

            <Form className="mt-6 space-y-4 border-t border-slate-200 pt-6" method="post">
              <input name="intent" type="hidden" value="add-stock-ingredient" />
              <input name="ingredientId" type="hidden" value="" />
              <label className="block text-sm font-medium text-slate-700">
                Eller fritekstnavn
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  defaultValue={addValues.displayName}
                  name="displayName"
                  placeholder="For eksempel Olivenolje"
                  type="text"
                />
              </label>
              {actionData?.addFieldErrors?.displayName ? (
                <p className="text-sm text-rose-600">
                  {actionData.addFieldErrors.displayName}
                </p>
              ) : null}
              {actionData?.addFieldErrors?.ingredientId ? (
                <p className="text-sm text-rose-600">
                  {actionData.addFieldErrors.ingredientId}
                </p>
              ) : null}
              <label className="block text-sm font-medium text-slate-700">
                Notat (valgfritt)
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  defaultValue={addValues.note}
                  name="note"
                  type="text"
                />
              </label>
              <button
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={
                  navigation.state === "submitting" &&
                  pendingIntent === "add-stock-ingredient"
                }
                type="submit"
              >
                {navigation.state === "submitting" &&
                pendingIntent === "add-stock-ingredient"
                  ? "Legger til..."
                  : "Legg til basisvare"}
              </button>
            </Form>
          </section>
        ) : (
          <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-5 text-sm leading-6 text-slate-600 shadow-sm">
            Bare administratorer kan endre basisvarene. Du kan fortsatt se
            listen og legge dem til i handlelisten fra ukeplanen.
          </section>
        )}

        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-slate-950">
              Familiens basisvarer
            </h2>
            <p className="text-sm leading-6 text-slate-600">
              {loaderData.stockIngredients.length === 0
                ? "Ingen basisvarer er konfigurert ennå."
                : `${loaderData.stockIngredients.length} basisvarer er registrert.`}
            </p>
          </div>

          {loaderData.stockIngredients.length > 0 ? (
            <ul className="mt-6 grid gap-3">
              {loaderData.stockIngredients.map((ingredient) => (
                <li
                  key={ingredient.id}
                  className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-base font-semibold text-slate-950">
                      {ingredient.displayLabel}
                    </p>
                    {ingredient.note ? (
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {ingredient.note}
                      </p>
                    ) : null}
                  </div>
                  {canManageStock ? (
                    <Form method="post">
                      <input
                        name="intent"
                        type="hidden"
                        value="remove-stock-ingredient"
                      />
                      <input
                        name="stockIngredientId"
                        type="hidden"
                        value={ingredient.id}
                      />
                      <button
                        className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={
                          navigation.state === "submitting" &&
                          pendingIntent === "remove-stock-ingredient" &&
                          navigation.formData?.get("stockIngredientId") ===
                            ingredient.id
                        }
                        type="submit"
                      >
                        Fjern
                      </button>
                    </Form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  if (isRouteErrorResponse(error)) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-[28px] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-semibold text-slate-950">
            {error.status} {error.statusText}
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">{error.data}</p>
        </div>
      </main>
    );
  }

  throw error;
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

function getStockNotice(request: Request): StockNotice | null {
  const notice = new URL(request.url).searchParams.get("notice");

  if (notice === "stock-ingredient-added" || notice === "stock-ingredient-removed") {
    return notice;
  }

  return null;
}

function getStockNoticeContent(notice: StockNotice) {
  switch (notice) {
    case "stock-ingredient-added":
      return {
        description: "Basisvaren ble lagt til i familiens liste.",
        title: "Basisvare lagt til",
      };
    case "stock-ingredient-removed":
      return {
        description: "Basisvaren ble fjernet fra familiens liste.",
        title: "Basisvare fjernet",
      };
  }
}

function buildStockRedirect({
  familyId,
  notice,
  request,
}: {
  familyId: string;
  notice: StockNotice;
  request: Request;
}) {
  const url = new URL(`/families/${familyId}/stock-ingredients`, request.url);
  url.searchParams.set("notice", notice);

  return Response.redirect(url, 302);
}
