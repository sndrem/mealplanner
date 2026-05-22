import { useMemo, useState } from "react";
import { Form, Link, isRouteErrorResponse, useNavigation } from "react-router";

import { requireUser } from "../lib/auth.server";
import {
  filterRecipeList,
  hasActiveRecipeSearch,
} from "../lib/recipe-list-search";
import { getRecipeManagementData } from "../lib/recipe.server";
import {
  createFamilyRecipe,
  parseFamilyRecipeValues,
  type FamilyRecipeFieldErrors,
  type FamilyRecipeValues,
} from "../lib/recipe-write.server";

type RecipesNotice = "recipe-created" | "recipe-deleted";

type RecipesIntent = "create-recipe";

interface RecipesActionData {
  createFieldErrors?: FamilyRecipeFieldErrors;
  createValues?: FamilyRecipeValues;
  formError?: string;
  intent?: RecipesIntent;
}

interface FamilyRecipesRouteProps {
  actionData?: RecipesActionData;
  loaderData: Awaited<ReturnType<typeof loader>>;
}

export const meta = () => {
  return [
    { title: "Oppskrifter | Mealplanner" },
    {
      name: "description",
      content: "Administrer familieoppskrifter og se standardoppskrifter.",
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
  const result = await getRecipeManagementData({
    familyId,
    userId: user.id,
  });

  return {
    categories: result.categories,
    family: result.family,
    familyRecipes: result.familyRecipes,
    globalRecipes: result.globalRecipes,
    notice: getRecipesNotice(request),
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

  if (intent === "create-recipe") {
    const values = parseFamilyRecipeValues(formData);
    const result = await createFamilyRecipe({
      familyId,
      userId: user.id,
      values,
    });

    if (result.status === "VALIDATION_ERROR") {
      return {
        createFieldErrors: result.fieldErrors,
        createValues: result.values,
        intent,
      } satisfies RecipesActionData;
    }

    const url = new URL(
      `/families/${familyId}/recipes/${result.recipe.id}`,
      request.url,
    );
    url.searchParams.set("notice", "recipe-created");

    return Response.redirect(url, 302);
  }

  return {
    formError: "Ukjent handling.",
  } satisfies RecipesActionData;
}

export default function FamilyRecipesRoute({
  actionData,
  loaderData,
}: FamilyRecipesRouteProps) {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState("");
  const noticeContent = loaderData.notice
    ? getRecipesNoticeContent(loaderData.notice)
    : null;
  const pendingIntent = navigation.formData?.get("intent");
  const canManageRecipes = loaderData.userRole === "ADMIN";
  const isSearchActive = hasActiveRecipeSearch(searchQuery);
  const filteredFamilyRecipes = useMemo(
    () => filterRecipeList(loaderData.familyRecipes, searchQuery),
    [loaderData.familyRecipes, searchQuery],
  );
  const filteredGlobalRecipes = useMemo(
    () => filterRecipeList(loaderData.globalRecipes, searchQuery),
    [loaderData.globalRecipes, searchQuery],
  );
  const createValues =
    actionData?.intent === "create-recipe" && actionData.createValues
      ? actionData.createValues
      : {
          defaultServings: "2",
          description: "",
          ingredients: [
            {
              amount: "",
              categoryId: loaderData.categories[0]?.id ?? "",
              displayName: "",
              preferredStoreId: "",
              unit: "",
            },
          ],
          prepMinutes: "45",
          tags: "",
          title: "",
        };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="rounded-[32px] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
                Oppskrifter
              </span>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight">
                {loaderData.family.name}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Familieoppskrifter kan redigeres her. Standardoppskrifter er
                felles for alle familier og kan bare leses i appen.
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
              Kunne ikke oppdatere oppskriftene
            </h2>
            <p className="mt-2 text-sm leading-6">{actionData.formError}</p>
          </section>
        ) : null}

        {canManageRecipes ? (
          <section className="rounded-[28px] border-2 border-emerald-200 bg-white p-6 shadow-sm ring-1 ring-emerald-100">
            <div className="flex flex-col gap-2">
              <span className="inline-flex w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                Familie — ny oppskrift
              </span>
              <h2 className="text-lg font-semibold text-slate-950">
                Opprett familieoppskrift
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                Legg inn oppskriftstittel og minst én ingrediens. Flere
                ingredienser og detaljer kan legges til etter opprettelsen.
              </p>
            </div>

            <Form className="mt-6 space-y-4" method="post">
              <input name="intent" type="hidden" value="create-recipe" />
              <input name="ingredientIndex" type="hidden" value="0" />
              <label className="block text-sm font-medium text-slate-700">
                Oppskriftstittel
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
                  defaultValue={createValues.title}
                  name="title"
                  placeholder="For eksempel Kyllingwok"
                  type="text"
                />
              </label>
              {actionData?.createFieldErrors?.title ? (
                <p className="text-sm text-rose-600">
                  {actionData.createFieldErrors.title}
                </p>
              ) : null}
              <fieldset className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <legend className="px-1 text-sm font-semibold text-slate-950">
                  Første ingrediens
                </legend>
                <p className="text-sm leading-6 text-slate-600">
                  Handlekategori gjelder denne ingrediensraden — ikke hele
                  oppskriften. Den brukes når handlelisten grupperes (for
                  eksempel «Kjøtt og fisk»).
                </p>
                <label className="block text-sm font-medium text-slate-700">
                  Ingrediensnavn
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
                    defaultValue={
                      createValues.ingredients[0]?.displayName ?? ""
                    }
                    name="ingredientDisplayName:0"
                    placeholder="For eksempel Kyllingfilet"
                    type="text"
                  />
                </label>
                {actionData?.createFieldErrors?.ingredientDisplayNames?.[0] ? (
                  <p className="text-sm text-rose-600">
                    {actionData.createFieldErrors.ingredientDisplayNames[0]}
                  </p>
                ) : null}
                <label className="block text-sm font-medium text-slate-700">
                  Handlekategori for ingrediensen
                  <select
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
                    defaultValue={createValues.ingredients[0]?.categoryId ?? ""}
                    name="ingredientCategoryId:0"
                  >
                    <option value="">Velg handlekategori</option>
                    {loaderData.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                {actionData?.createFieldErrors?.ingredientCategories?.[0] ? (
                  <p className="text-sm text-rose-600">
                    {actionData.createFieldErrors.ingredientCategories[0]}
                  </p>
                ) : null}
              </fieldset>
              {actionData?.createFieldErrors?.ingredients ? (
                <p className="text-sm text-rose-600">
                  {actionData.createFieldErrors.ingredients}
                </p>
              ) : null}
              <button
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={
                  navigation.state === "submitting" &&
                  pendingIntent === "create-recipe"
                }
                type="submit"
              >
                {navigation.state === "submitting" &&
                pendingIntent === "create-recipe"
                  ? "Oppretter..."
                  : "Opprett oppskrift"}
              </button>
            </Form>
          </section>
        ) : null}

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <label
            className="block text-sm font-medium text-slate-700"
            htmlFor="recipe-search"
          >
            Søk oppskrifter
            <div className="mt-2 flex gap-2">
              <input
                autoComplete="off"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                id="recipe-search"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="For eksempel tomatsuppe"
                type="search"
                value={searchQuery}
              />
              {isSearchActive ? (
                <button
                  className="shrink-0 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={() => setSearchQuery("")}
                  type="button"
                >
                  Nullstill
                </button>
              ) : null}
            </div>
          </label>
        </section>

        <section className="rounded-[28px] border-2 border-emerald-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <span className="inline-flex w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
              Familie
            </span>
            <h2 className="text-xl font-semibold text-slate-950">
              Familieoppskrifter
            </h2>
          </div>

          {loaderData.familyRecipes.length === 0 ? (
            <p className="mt-6 rounded-[24px] border border-dashed border-emerald-200 bg-emerald-50/50 px-5 py-8 text-center text-sm leading-6 text-slate-600">
              {canManageRecipes
                ? "Ingen familieoppskrifter ennå. Opprett den første oppskriften over."
                : "Familien har ingen egne oppskrifter ennå."}
            </p>
          ) : filteredFamilyRecipes.length === 0 && isSearchActive ? (
            <p className="mt-6 rounded-[24px] border border-dashed border-emerald-200 bg-emerald-50/50 px-5 py-8 text-center text-sm leading-6 text-slate-600">
              Ingen familieoppskrifter matcher søket.
            </p>
          ) : (
            <div className="mt-6 grid gap-3">
              {filteredFamilyRecipes.map((recipe) => (
                <RecipeListCard
                  key={recipe.id}
                  recipe={recipe}
                  scopeLabel="Familie"
                  scopeTone="family"
                  to={`/families/${loaderData.family.id}/recipes/${recipe.id}`}
                />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-slate-50 p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <span className="inline-flex w-fit rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
              Standard (global)
            </span>
            <h2 className="text-xl font-semibold text-slate-950">
              Standardoppskrifter
            </h2>
            <p className="text-sm leading-6 text-slate-600">
              Felles oppskrifter fra seed-data. De kan brukes i ukeplaner, men
              kan ikke redigeres eller slettes her.
            </p>
          </div>

          {loaderData.globalRecipes.length ===
          0 ? null : filteredGlobalRecipes.length === 0 && isSearchActive ? (
            <p className="mt-6 rounded-[24px] border border-dashed border-slate-200 bg-white px-5 py-8 text-center text-sm leading-6 text-slate-600">
              Ingen standardoppskrifter matcher søket.
            </p>
          ) : (
            <div className="mt-6 grid gap-3">
              {filteredGlobalRecipes.map((recipe) => (
                <RecipeListCard
                  key={recipe.id}
                  readOnly
                  recipe={recipe}
                  scopeLabel="Standard"
                  scopeTone="global"
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function RecipeListCard({
  readOnly = false,
  recipe,
  scopeLabel,
  scopeTone,
  to,
}: {
  readOnly?: boolean;
  recipe: {
    _count: {
      ingredients: number;
      mealPlanEntries: number;
    };
    defaultServings: number | null;
    description: string | null;
    id: string;
    prepMinutes: number | null;
    tags: string[];
    title: string;
  };
  scopeLabel: string;
  scopeTone: "family" | "global";
  to?: string;
}) {
  const scopeClasses =
    scopeTone === "family"
      ? "bg-emerald-100 text-emerald-800"
      : "bg-slate-200 text-slate-700";
  const content = (
    <article
      className={
        readOnly
          ? "rounded-[24px] border border-slate-200 bg-white p-5"
          : "rounded-[24px] border border-emerald-200 bg-emerald-50/40 p-5 transition hover:border-emerald-300 hover:bg-emerald-50"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${scopeClasses}`}
            >
              {scopeLabel}
            </span>
            {readOnly ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                Kun lesing
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-950">
            {recipe.title}
          </h3>
          {recipe.description ? (
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {recipe.description}
            </p>
          ) : null}
        </div>
        {!readOnly && to ? (
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
            Åpne
          </span>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-700">
        <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
          {recipe._count.ingredients} ingredienser
        </span>
        <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
          {recipe.prepMinutes ?? "?"} min
        </span>
        <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
          {recipe.defaultServings ?? "?"} personer
        </span>
        {recipe.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200"
          >
            {tag}
          </span>
        ))}
      </div>
    </article>
  );

  if (to) {
    return (
      <Link className="block" to={to}>
        {content}
      </Link>
    );
  }

  return content;
}

export function ErrorBoundary({ error }: { error: unknown }) {
  let title = "Noe gikk galt";
  let message = "Vi kunne ikke laste oppskriftene akkurat nå.";

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Fant ikke siden" : title;
    message =
      typeof error.data === "string" && error.data.length > 0
        ? error.data
        : error.statusText || message;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-16 text-slate-900">
      <div className="mx-auto max-w-2xl rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
        <Link
          className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white"
          to="/app"
        >
          Til appen
        </Link>
      </div>
    </main>
  );
}

function getRecipesNotice(request: Request): RecipesNotice | null {
  const notice = new URL(request.url).searchParams.get("notice");

  if (notice === "recipe-created" || notice === "recipe-deleted") {
    return notice;
  }

  return null;
}

function getRecipesNoticeContent(notice: RecipesNotice) {
  switch (notice) {
    case "recipe-created":
      return {
        description:
          "Oppskriften ble opprettet. Du kan legge til flere ingredienser og detaljer nedenfor.",
        title: "Oppskriften er opprettet",
      };
    case "recipe-deleted":
      return {
        description: "Familieoppskriften ble fjernet.",
        title: "Oppskriften er slettet",
      };
  }
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
