import { Link } from "react-router";

import {
  FamilyFormErrorBanner,
  FamilyNoticeBanner,
  FamilyPageHeader,
  FamilyUnexpectedError,
  familyBandLinkClassName,
  familyBandPrimaryLinkClassName,
} from "../components/family-page";
import { FamilyRecipeEditorCard } from "../components/family-recipe-editor-card";
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
import {
  readFamilyRouteForm,
  requireFamilyRouteUser,
} from "../lib/family-route.server";

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
  const { familyId, user } = await requireFamilyRouteUser({ params, request });
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
  const { familyId, formData, intent, user } = await readFamilyRouteForm({
    params,
    request,
  });
  const recipeId = requireRecipeId(params.recipeId);

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
    <main className="min-h-screen bg-page px-4 py-12 text-ink">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <FamilyPageHeader
          actions={
            <>
              <Link
                className={familyBandPrimaryLinkClassName}
                to={`/families/${loaderData.family.id}/recipes`}
              >
                Alle oppskrifter
              </Link>
              <Link
                className={familyBandLinkClassName}
                to={`/families/${loaderData.family.id}/meal-plans`}
              >
                Ukeplaner
              </Link>
            </>
          }
          description={
            <>
              Rediger oppskriften for {loaderData.family.name}. Endringer vises
              i ukeplaner og handlelister som bruker denne oppskriften.
            </>
          }
          kicker="Familieoppskrift"
          title={loaderData.recipe.title}
        />

        {noticeContent ? (
          <FamilyNoticeBanner
            description={noticeContent.description}
            title={noticeContent.title}
            tone="success"
          />
        ) : null}

        {actionData?.formError ? (
          <FamilyFormErrorBanner
            message={actionData.formError}
            title="Handlingen feilet"
            tone="danger"
          />
        ) : null}

        <FamilyRecipeEditorCard
          canManageRecipes={canManageRecipes}
          categories={loaderData.categories}
          familyId={loaderData.family.id}
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
  return (
    <FamilyUnexpectedError
      error={error}
      fallbackMessage="Vi kunne ikke laste oppskriften akkurat nå."
      notFoundTitle="Fant ikke oppskriften"
    />
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

function requireRecipeId(recipeId: string | undefined) {
  if (!recipeId) {
    throw new Response("Fant ikke oppskriften.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  return recipeId;
}
