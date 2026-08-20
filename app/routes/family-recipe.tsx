import { Link, isRouteErrorResponse } from "react-router";

import { FamilyRecipeEditorCard } from "../components/family-recipe-editor-card";
import { requireUser } from "../lib/auth.server";
import { getFamilyRecipeDetail, getRecipeManagementData } from "../lib/recipe.server";
import {
  deleteFamilyRecipe,
  parseFamilyRecipeCoverInput,
  parseFamilyRecipeValues,
  updateFamilyRecipe,
  type FamilyRecipeFieldErrors,
  type FamilyRecipeValues,
} from "../lib/recipe-write.server";
import { isR2Configured } from "../lib/r2.server";

type RecipeDetailNotice = "recipe-created" | "recipe-deleted" | "recipe-updated";

type RecipeDetailIntent = "delete-recipe" | "update-recipe";

interface RecipeDetailActionData {
  formError?: string;
  intent?: RecipeDetailIntent;
  updateFieldErrors?: FamilyRecipeFieldErrors;
  updateValues?: FamilyRecipeValues;
}

interface FamilyRecipeRouteProps {
  actionData?: RecipeDetailActionData;
  loaderData: Awaited<ReturnType<typeof loader>>;
}

export const meta = () => {
  return [
    { title: "Oppskrift | Mealplanner" },
    {
      name: "description",
      content: "Rediger en familieoppskrift i Mealplanner.",
    },
  ];
};

export async function loader({
  params,
  request,
}: {
  params: {
    familyId?: string;
    recipeId?: string;
  };
  request: Request;
}) {
  const user = await requireUser(request);
  const familyId = requireFamilyId(params.familyId);
  const recipeId = requireRecipeId(params.recipeId);
  const [managementData, detail] = await Promise.all([
    getRecipeManagementData({
      familyId,
      userId: user.id,
    }),
    getFamilyRecipeDetail({
      familyId,
      recipeId,
      userId: user.id,
    }),
  ]);

  if (detail.status === "NOT_FOUND") {
    throw new Response("Fant ikke oppskriften.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  return {
    categories: detail.categories,
    family: managementData.family,
    familyStores: detail.familyStores,
    mealPlanEntryCount: detail.mealPlanEntryCount,
    notice: getRecipeDetailNotice(request),
    recipe: detail.recipe,
    r2Configured: isR2Configured(),
    startInEditMode: shouldStartInEditMode(request),
    userRole: managementData.userRole,
  };
}

export async function action({
  params,
  request,
}: {
  params: {
    familyId?: string;
    recipeId?: string;
  };
  request: Request;
}) {
  const user = await requireUser(request);
  const familyId = requireFamilyId(params.familyId);
  const recipeId = requireRecipeId(params.recipeId);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "update-recipe") {
    const submittedRecipeId = String(formData.get("recipeId") ?? "").trim();
    const values = parseFamilyRecipeValues(formData);
    const cover = parseFamilyRecipeCoverInput(formData);

    if (!submittedRecipeId || submittedRecipeId !== recipeId) {
      return {
        formError: "Fant ikke oppskriften som skulle oppdateres.",
        intent,
      } satisfies RecipeDetailActionData;
    }

    const result = await updateFamilyRecipe({
      cover,
      familyId,
      recipeId,
      userId: user.id,
      values,
    });

    if (result.status === "NOT_FOUND") {
      return {
        formError: "Fant ikke oppskriften som skulle oppdateres.",
        intent,
      } satisfies RecipeDetailActionData;
    }

    if (result.status === "VALIDATION_ERROR") {
      return {
        intent,
        updateFieldErrors: result.fieldErrors,
        updateValues: result.values,
      } satisfies RecipeDetailActionData;
    }

    return buildRecipeDetailRedirect({
      familyId,
      notice: "recipe-updated",
      recipeId,
      request,
    });
  }

  if (intent === "delete-recipe") {
    const submittedRecipeId = String(formData.get("recipeId") ?? "").trim();

    if (!submittedRecipeId || submittedRecipeId !== recipeId) {
      return {
        formError: "Fant ikke oppskriften som skulle slettes.",
        intent,
      } satisfies RecipeDetailActionData;
    }

    const result = await deleteFamilyRecipe({
      familyId,
      recipeId,
      userId: user.id,
    });

    if (result.status === "NOT_FOUND") {
      return {
        formError: "Fant ikke oppskriften som skulle slettes.",
        intent,
      } satisfies RecipeDetailActionData;
    }

    if (result.status === "IN_USE") {
      return {
        formError: `«${result.title}» brukes i ${result.entryCount} ${
          result.entryCount === 1 ? "ukeplan" : "ukeplaner"
        } og kan ikke slettes før du fjerner den fra planene.`,
        intent,
      } satisfies RecipeDetailActionData;
    }

    const url = new URL(`/families/${familyId}/recipes`, request.url);
    url.searchParams.set("notice", "recipe-deleted");

    return Response.redirect(url, 302);
  }

  return {
    formError: "Ukjent handling.",
  } satisfies RecipeDetailActionData;
}

export default function FamilyRecipeRoute({
  actionData,
  loaderData,
}: FamilyRecipeRouteProps) {
  const noticeContent = loaderData.notice
    ? getRecipeDetailNoticeContent(loaderData.notice)
    : null;
  const canManageRecipes = loaderData.userRole === "ADMIN";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <section className="rounded-[32px] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
                Familieoppskrift
              </span>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight">
                {loaderData.recipe.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Rediger oppskriften for {loaderData.family.name}. Endringer
                vises i ukeplaner og handlelister som bruker denne oppskriften.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-600"
                to={`/families/${loaderData.family.id}/recipes`}
              >
                Alle oppskrifter
              </Link>
              <Link
                className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/15"
                to={`/families/${loaderData.family.id}/meal-plans`}
              >
                Ukeplaner
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
            <h2 className="text-base font-semibold">Handlingen feilet</h2>
            <p className="mt-2 text-sm leading-6">{actionData.formError}</p>
          </section>
        ) : null}

        <FamilyRecipeEditorCard
          canManageRecipes={canManageRecipes}
          categories={loaderData.categories}
          familyStores={loaderData.familyStores}
          initialEditing={loaderData.startInEditMode}
          mealPlanEntryCount={loaderData.mealPlanEntryCount}
          recipe={loaderData.recipe}
          r2Configured={loaderData.r2Configured}
          updateFieldErrors={
            actionData?.intent === "update-recipe"
              ? actionData.updateFieldErrors
              : undefined
          }
          updateValues={
            actionData?.intent === "update-recipe" ? actionData.updateValues : undefined
          }
        />
      </div>
    </main>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  let title = "Noe gikk galt";
  let message = "Vi kunne ikke laste oppskriften akkurat nå.";

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Fant ikke oppskriften" : title;
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

function getRecipeDetailNotice(request: Request): RecipeDetailNotice | null {
  const notice = new URL(request.url).searchParams.get("notice");

  if (
    notice === "recipe-created" ||
    notice === "recipe-deleted" ||
    notice === "recipe-updated"
  ) {
    return notice;
  }

  return null;
}

function shouldStartInEditMode(request: Request) {
  return new URL(request.url).searchParams.get("edit") === "1";
}

function getRecipeDetailNoticeContent(notice: RecipeDetailNotice) {
  switch (notice) {
    case "recipe-created":
      return {
        description:
          "Oppskriften ble opprettet. Legg til flere ingredienser og detaljer her.",
        title: "Oppskriften er opprettet",
      };
    case "recipe-updated":
      return {
        description: "Oppskriften og ingrediensene ble lagret.",
        title: "Endringene er lagret",
      };
    case "recipe-deleted":
      return {
        description: "Oppskriften ble fjernet fra familien.",
        title: "Oppskriften er slettet",
      };
  }
}

function buildRecipeDetailRedirect({
  familyId,
  notice,
  recipeId,
  request,
}: {
  familyId: string;
  notice: RecipeDetailNotice;
  recipeId: string;
  request: Request;
}) {
  const url = new URL(`/families/${familyId}/recipes/${recipeId}`, request.url);
  url.searchParams.set("notice", notice);

  return Response.redirect(url, 302);
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

function requireRecipeId(recipeId: string | undefined) {
  if (!recipeId) {
    throw new Response("Fant ikke oppskriften.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  return recipeId;
}
