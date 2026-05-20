import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  Form,
  Link,
  isRouteErrorResponse,
  useNavigation,
  type MetaFunction,
} from "react-router";

import { requireUser } from "../lib/auth.server";
import { FamilyStoreEditorCard } from "../components/family-store-editor-card";
import { getStoreManagementData } from "../lib/store.server";
import {
  createFamilyStore,
  deleteFamilyStore,
  updateFamilyStore,
  type FamilyStoreFieldErrors,
  type FamilyStoreValues,
} from "../lib/store-write.server";

type StoresNotice = "store-created" | "store-deleted" | "store-updated";

type StoresIntent = "create-store" | "delete-store" | "update-store";

interface StoresActionData {
  createFieldErrors?: {
    name?: string;
  };
  createValues?: {
    name: string;
  };
  formError?: string;
  intent?: StoresIntent;
  targetStoreId?: string;
  updateFieldErrors?: FamilyStoreFieldErrors;
  updateValues?: FamilyStoreValues;
}

interface FamilyStoresRouteProps {
  actionData?: StoresActionData;
  loaderData: Awaited<ReturnType<typeof loader>>;
}

export const meta: MetaFunction = () => {
  return [
    { title: "Butikker | Mealplanner" },
    {
      name: "description",
      content:
        "Administrer familiebutikker og seksjonsrekkefølge i Mealplanner.",
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
  const result = await getStoreManagementData({
    familyId,
    userId: user.id,
  });

  return {
    categories: result.categories,
    family: result.family,
    familyStores: result.familyStores,
    globalStores: result.globalStores,
    notice: getStoresNotice(request),
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

  if (intent === "create-store") {
    const name = String(formData.get("name") ?? "");
    const result = await createFamilyStore({
      familyId,
      name,
      userId: user.id,
    });

    if (result.status === "VALIDATION_ERROR") {
      return {
        createFieldErrors: result.fieldErrors,
        createValues: result.values,
        intent,
      } satisfies StoresActionData;
    }

    return buildStoresRedirect({
      familyId,
      notice: "store-created",
      request,
    });
  }

  if (intent === "update-store") {
    const storeId = String(formData.get("storeId") ?? "").trim();
    const values = parseFamilyStoreValues(formData);

    if (!storeId) {
      return {
        formError: "Fant ikke butikken som skulle oppdateres.",
        intent,
      } satisfies StoresActionData;
    }

    const result = await updateFamilyStore({
      familyId,
      storeId,
      userId: user.id,
      values,
    });

    if (result.status === "NOT_FOUND") {
      return {
        formError: "Fant ikke butikken som skulle oppdateres.",
        intent,
        targetStoreId: storeId,
      } satisfies StoresActionData;
    }

    if (result.status === "VALIDATION_ERROR") {
      return {
        intent,
        targetStoreId: storeId,
        updateFieldErrors: result.fieldErrors,
        updateValues: result.values,
      } satisfies StoresActionData;
    }

    return buildStoresRedirect({
      familyId,
      notice: "store-updated",
      request,
    });
  }

  if (intent === "delete-store") {
    const storeId = String(formData.get("storeId") ?? "").trim();

    if (!storeId) {
      return {
        formError: "Fant ikke butikken som skulle slettes.",
        intent,
      } satisfies StoresActionData;
    }

    const result = await deleteFamilyStore({
      familyId,
      storeId,
      userId: user.id,
    });

    if (result.status === "NOT_FOUND") {
      return {
        formError: "Fant ikke butikken som skulle slettes.",
        intent,
        targetStoreId: storeId,
      } satisfies StoresActionData;
    }

    return buildStoresRedirect({
      familyId,
      notice: "store-deleted",
      request,
    });
  }

  return {
    formError: "Ukjent handling.",
  } satisfies StoresActionData;
}

export default function FamilyStoresRoute({
  actionData,
  loaderData,
}: FamilyStoresRouteProps) {
  const navigation = useNavigation();
  const noticeContent = loaderData.notice
    ? getStoresNoticeContent(loaderData.notice)
    : null;
  const pendingIntent = navigation.formData?.get("intent");
  const createValues =
    actionData?.intent === "create-store" && actionData.createValues
      ? actionData.createValues
      : { name: "" };
  const canManageStores = loaderData.userRole === "ADMIN";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="rounded-[32px] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
                Butikker
              </span>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight">
                {loaderData.family.name}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Administrer familiebutikker og bestem seksjonsrekkefølgen slik
                at butikkmodus følger handleturen deres.
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
              Kunne ikke oppdatere butikkene
            </h2>
            <p className="mt-2 text-sm leading-6">{actionData.formError}</p>
          </section>
        ) : null}

        {canManageStores ? (
          <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-950">
                Opprett familiebutikk
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                Nye butikker starter med alle kategorier og kan tilpasses videre
                under.
              </p>
            </div>

            <Form className="mt-6 space-y-4" method="post">
              <input name="intent" type="hidden" value="create-store" />
              <label className="block text-sm font-medium text-slate-700">
                Butikknavn
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  defaultValue={createValues.name}
                  name="name"
                  placeholder="For eksempel Helgebutikk"
                  type="text"
                />
              </label>
              {actionData?.intent === "create-store" &&
              actionData.createFieldErrors?.name ? (
                <p className="text-sm text-rose-600">
                  {actionData.createFieldErrors.name}
                </p>
              ) : null}
              <button
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={
                  navigation.state === "submitting" &&
                  pendingIntent === "create-store"
                }
                type="submit"
              >
                {navigation.state === "submitting" &&
                pendingIntent === "create-store"
                  ? "Oppretter..."
                  : "Opprett butikk"}
              </button>
            </Form>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-950">
                Seedede standardbutikker
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                Disse butikkene er tilgjengelige for familien som faste
                utgangspunkt og kan ikke redigeres.
              </p>
            </div>

            <div className="mt-6 grid gap-4">
              {loaderData.globalStores.map((store) => (
                <article
                  key={store.id}
                  className="rounded-[24px] border border-slate-200 bg-slate-50 p-5"
                >
                  <h3 className="text-base font-semibold text-slate-950">
                    {store.name}
                  </h3>
                  <ol className="mt-4 grid gap-2 text-sm leading-6 text-slate-700">
                    {store.sections.map((section, index) => (
                      <li key={section.id}>
                        {index + 1}. {section.displayName}
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          </article>

          <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-950">
                Familiebutikker
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                Gi butikkene egne navn og tilpass seksjonsrekkefølgen for
                akkurat denne familien.
              </p>
            </div>

            {loaderData.familyStores.length > 0 ? (
              <DndProvider backend={HTML5Backend}>
                <div className="mt-6 grid gap-5">
                  {loaderData.familyStores.map((store) => (
                    <FamilyStoreEditorCard
                      canManageStores={canManageStores}
                      key={store.id}
                      store={store}
                      updateFieldErrors={
                        actionData?.intent === "update-store" &&
                        actionData.targetStoreId === store.id
                          ? actionData.updateFieldErrors
                          : undefined
                      }
                      updateValues={
                        actionData?.intent === "update-store" &&
                        actionData.targetStoreId === store.id
                          ? actionData.updateValues
                          : undefined
                      }
                    />
                  ))}
                </div>
              </DndProvider>
            ) : (
              <p className="mt-6 text-sm leading-6 text-slate-600">
                Familien har ingen egne butikker ennå. Opprett en butikk for å
                få en egen seksjonsrekkefølge.
              </p>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  let title = "Noe gikk galt";
  let message = "Vi klarte ikke å laste butikkoppsettet akkurat nå.";

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Fant ikke familien" : title;
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

function getStoresNotice(request: Request): StoresNotice | null {
  const notice = new URL(request.url).searchParams.get("notice");

  if (
    notice === "store-created" ||
    notice === "store-deleted" ||
    notice === "store-updated"
  ) {
    return notice;
  }

  return null;
}

function getStoresNoticeContent(notice: StoresNotice) {
  switch (notice) {
    case "store-created":
      return {
        description:
          "Butikken ble opprettet med alle kategorier klare for videre tilpasning.",
        title: "Butikken er opprettet",
      };
    case "store-updated":
      return {
        description: "Butikknavn og seksjonsnavn ble lagret.",
        title: "Butikken er oppdatert",
      };
    case "store-deleted":
      return {
        description:
          "Butikken ble slettet. Eventuelle preferanser peker nå ikke lenger til denne butikken.",
        title: "Butikken er slettet",
      };
  }
}

function buildStoresRedirect({
  familyId,
  notice,
  request,
}: {
  familyId: string;
  notice: StoresNotice;
  request: Request;
}) {
  const url = new URL(`/families/${familyId}/stores`, request.url);
  url.searchParams.set("notice", notice);

  return Response.redirect(url, 302);
}

function parseFamilyStoreValues(formData: FormData): FamilyStoreValues {
  const categoryIds = formData
    .getAll("sectionCategoryId")
    .map((value) => String(value));

  return {
    name: String(formData.get("name") ?? ""),
    sections: categoryIds.map((categoryId) => ({
      categoryId,
      displayName: String(
        formData.get(`sectionDisplayName:${categoryId}`) ?? "",
      ),
    })),
  };
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
