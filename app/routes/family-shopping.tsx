import {
  Form,
  Link,
  isRouteErrorResponse,
  useNavigation,
  type MetaFunction,
} from "react-router";

import { ManualShoppingQuickAdd } from "../components/manual-shopping-quick-add";
import { ShoppingListItemExpanded } from "../components/shopping-list-item-expanded";
import { requireUser } from "../lib/auth.server";
import { useIsLgViewport } from "../lib/use-lg-viewport";
import {
  createFamilyShoppingItem,
  createQuickFamilyShoppingItem,
  deleteFamilyShoppingItem,
  parseFamilyShoppingItemValues,
  parseQuickAddFamilyShoppingItemInput,
  toggleFamilyShoppingItemChecked,
  updateFamilyShoppingItem,
  type FamilyShoppingItemFieldErrors,
  type FamilyShoppingItemValues,
} from "../lib/family-shopping-write.server";
import {
  formatCompactShoppingSourceLine,
  formatGeneratedQuantityBadge,
} from "../lib/shopping-display";
import { getToggleExpectedVersion } from "../lib/shopping-store-mode-client";
import {
  getFamilyShoppingData,
  listRecentManualShoppingItemsForFamily,
} from "../lib/shopping.server";

type FamilyShoppingNotice =
  | "family-shopping-item-added"
  | "family-shopping-item-deleted"
  | "family-shopping-item-updated"
  | "family-shopping-item-check-state-updated";

type FamilyShoppingIntent =
  | "add-family-shopping-item"
  | "quick-add-family-shopping-item"
  | "delete-family-shopping-item"
  | "toggle-family-shopping-item-checked"
  | "update-family-shopping-item";

interface FamilyShoppingActionData {
  familyFieldErrors?: FamilyShoppingItemFieldErrors;
  familyValues?: FamilyShoppingItemValues;
  formError?: string;
  intent?: FamilyShoppingIntent;
  itemTarget?: {
    sourceKey: string;
  };
}

const defaultFamilyShoppingItemValues: FamilyShoppingItemValues = {
  categoryId: "",
  name: "",
  note: "",
  preferredStoreId: "",
  quantity: "",
};

export const meta: MetaFunction = () => {
  return [
    { title: "Alltid på listen | Mealplanner" },
    {
      name: "description",
      content:
        "Familiens faste handleliste med varer som følger på tvers av ukeplaner.",
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
  const familyId = requireRouteParam(params.familyId, "Fant ikke familien.");
  const [result, recentManualItems] = await Promise.all([
    getFamilyShoppingData({
      familyId,
      userId: user.id,
    }),
    listRecentManualShoppingItemsForFamily({
      familyId,
    }),
  ]);

  return {
    categories: result.categories,
    family: result.family,
    itemCounts: result.itemCounts,
    notice: getFamilyShoppingNotice(request),
    recentManualItems,
    storeGroups: result.storeGroups.map((group) => ({
      sections: group.sections.map((section) => ({
        ...section,
        items: section.items.map((item) => ({
          ...item,
          collaborationVersion: item.collaborationVersion,
        })),
      })),
      store: group.store,
    })),
    stores: result.stores,
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
  const familyId = requireRouteParam(params.familyId, "Fant ikke familien.");
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "add-family-shopping-item") {
    const result = await createFamilyShoppingItem({
      familyId,
      userId: user.id,
      values: parseFamilyShoppingItemValues(formData),
    });

    if (result.status === "VALIDATION_ERROR") {
      return {
        familyFieldErrors: result.fieldErrors,
        familyValues: result.values,
        intent,
      } satisfies FamilyShoppingActionData;
    }

    return buildFamilyShoppingRedirect({
      familyId,
      notice: "family-shopping-item-added",
      request,
    });
  }

  if (intent === "quick-add-family-shopping-item") {
    const result = await createQuickFamilyShoppingItem({
      familyId,
      input: parseQuickAddFamilyShoppingItemInput(formData),
      userId: user.id,
    });

    if (result.status === "VALIDATION_ERROR") {
      return {
        familyFieldErrors: result.fieldErrors,
        familyValues: result.values,
        formError: "formError" in result ? result.formError : undefined,
        intent,
      } satisfies FamilyShoppingActionData;
    }

    return buildFamilyShoppingRedirect({
      familyId,
      notice: "family-shopping-item-added",
      request,
    });
  }

  if (intent === "update-family-shopping-item") {
    const familyItemId = String(formData.get("familyItemId") ?? "");

    if (!familyItemId) {
      return {
        formError: "Fant ikke varelinjen som skulle oppdateres.",
        intent,
      } satisfies FamilyShoppingActionData;
    }

    const result = await updateFamilyShoppingItem({
      expectedUpdatedAt: parseExpectedUpdatedAt(formData),
      familyId,
      familyItemId,
      userId: user.id,
      values: parseFamilyShoppingItemValues(formData),
    });

    if (result.status === "NOT_FOUND") {
      return {
        formError: "Fant ikke varelinjen som skulle oppdateres.",
        intent,
        itemTarget: { sourceKey: familyItemId },
      } satisfies FamilyShoppingActionData;
    }

    if (result.status === "CONFLICT") {
      return {
        formError: result.formError,
        intent,
        itemTarget: { sourceKey: familyItemId },
      } satisfies FamilyShoppingActionData;
    }

    if (result.status === "VALIDATION_ERROR") {
      return {
        familyFieldErrors: result.fieldErrors,
        familyValues: result.values,
        intent,
        itemTarget: { sourceKey: familyItemId },
      } satisfies FamilyShoppingActionData;
    }

    return buildFamilyShoppingRedirect({
      familyId,
      notice: "family-shopping-item-updated",
      request,
    });
  }

  if (intent === "delete-family-shopping-item") {
    const familyItemId = String(formData.get("familyItemId") ?? "");

    if (!familyItemId) {
      return {
        formError: "Fant ikke varelinjen som skulle slettes.",
        intent,
      } satisfies FamilyShoppingActionData;
    }

    const result = await deleteFamilyShoppingItem({
      expectedUpdatedAt: parseExpectedUpdatedAt(formData),
      familyId,
      familyItemId,
      userId: user.id,
    });

    if (result.status === "NOT_FOUND") {
      return {
        formError: "Fant ikke varelinjen som skulle slettes.",
        intent,
        itemTarget: { sourceKey: familyItemId },
      } satisfies FamilyShoppingActionData;
    }

    if (result.status === "CONFLICT") {
      return {
        formError: result.formError,
        intent,
        itemTarget: { sourceKey: familyItemId },
      } satisfies FamilyShoppingActionData;
    }

    return buildFamilyShoppingRedirect({
      familyId,
      notice: "family-shopping-item-deleted",
      request,
    });
  }

  if (intent === "toggle-family-shopping-item-checked") {
    const familyItemId = String(formData.get("sourceKey") ?? "").trim();
    const checked = String(formData.get("checked") ?? "") === "true";

    if (!familyItemId) {
      return {
        formError: "Fant ikke varelinjen som skulle oppdateres.",
        intent,
      } satisfies FamilyShoppingActionData;
    }

    const result = await toggleFamilyShoppingItemChecked({
      checked,
      expectedUpdatedAt: parseExpectedUpdatedAt(formData),
      familyId,
      familyItemId,
      userId: user.id,
    });

    if (result.status === "NOT_FOUND") {
      return {
        formError: "Fant ikke varelinjen som skulle oppdateres.",
        intent,
        itemTarget: { sourceKey: familyItemId },
      } satisfies FamilyShoppingActionData;
    }

    if (result.status === "CONFLICT") {
      return {
        formError: result.formError,
        intent,
        itemTarget: { sourceKey: familyItemId },
      } satisfies FamilyShoppingActionData;
    }

    return buildFamilyShoppingRedirect({
      familyId,
      notice: "family-shopping-item-check-state-updated",
      request,
    });
  }

  return {
    formError: "Ukjent handling.",
  } satisfies FamilyShoppingActionData;
}

export default function FamilyShoppingRoute({
  actionData,
  loaderData,
}: {
  actionData?: FamilyShoppingActionData;
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  const navigation = useNavigation();
  const isLg = useIsLgViewport();
  const noticeContent =
    loaderData.notice !== null
      ? getFamilyShoppingNoticeContent(loaderData.notice)
      : null;
  const pendingIntent = navigation.formData?.get("intent");
  const pendingSourceKey = getPendingSourceKey(navigation.formData);
  const ingredientSearchPath = `/families/${loaderData.family.id}/shopping/ingredient-search`;
  const quickAddFormError =
    actionData?.intent === "quick-add-family-shopping-item"
      ? actionData.formError
      : undefined;
  const generalFormError =
    actionData?.formError &&
    actionData.intent !== "quick-add-family-shopping-item"
      ? actionData.formError
      : undefined;
  const quickAddProps = {
    ingredientSearchPath,
    quickAddIntent: "quick-add-family-shopping-item" as const,
    recentManualItems: loaderData.recentManualItems,
  };
  const addFamilyValues =
    actionData?.intent === "add-family-shopping-item" && actionData.familyValues
      ? actionData.familyValues
      : defaultFamilyShoppingItemValues;

  return (
    <main className="min-h-screen bg-slate-100 px-4 pb-36 pt-8 text-slate-900 lg:pb-12 lg:py-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="rounded-[32px] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-8 lg:py-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
                Alltid på listen
              </span>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight lg:text-4xl">
                {loaderData.family.name}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Varer her følger familien på tvers av ukeplaner og vises i
                handlelisten når dere handler for en uke.
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

        {generalFormError ? (
          <section className="rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-5 text-rose-900 shadow-sm">
            <h2 className="text-base font-semibold">
              Kunne ikke oppdatere listen
            </h2>
            <p className="mt-2 text-sm leading-6">{generalFormError}</p>
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-950">Oversikt</h2>
            <dl className="mt-6 grid gap-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <dt className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                  Totalt
                </dt>
                <dd className="mt-2 text-base font-semibold text-slate-950">
                  {loaderData.itemCounts.total} varelinjer
                </dd>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <dt className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                  Gjenstår
                </dt>
                <dd className="mt-2 text-sm leading-6 text-slate-700">
                  {loaderData.itemCounts.unchecked} å handle,{" "}
                  {loaderData.itemCounts.checked} kjøpt.
                </dd>
              </div>
            </dl>
          </article>

          <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-950">
              Legg til vare
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {isLg
                ? "Bruk hurtigvalg eller det avanserte skjemaet for å legge til varer som skal med uansett ukeplan."
                : "Bruk feltet nederst for hurtig innlegging, eller det avanserte skjemaet under."}
            </p>

            {isLg ? (
              <>
                {quickAddFormError ? (
                  <p className="mt-4 text-sm text-rose-600">
                    {quickAddFormError}
                  </p>
                ) : null}

                <div className="mt-6">
                  <ManualShoppingQuickAdd {...quickAddProps} />
                </div>
              </>
            ) : null}

            <details
              className={`rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 ${isLg ? "mt-6" : "mt-4"}`}
            >
              <summary className="cursor-pointer text-sm font-medium text-slate-800">
                Avansert: legg til med alle felt
              </summary>
              <Form className="mt-4 space-y-4" method="post">
                <input
                  name="intent"
                  type="hidden"
                  value="add-family-shopping-item"
                />
                <label className="block text-sm font-medium text-slate-700">
                  Varenavn
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
                    defaultValue={addFamilyValues.name}
                    name="name"
                    type="text"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Mengde
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
                    defaultValue={addFamilyValues.quantity}
                    name="quantity"
                    type="text"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Kategori
                  <select
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
                    defaultValue={addFamilyValues.categoryId}
                    name="categoryId"
                  >
                    <option value="">Velg kategori</option>
                    {loaderData.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white"
                  type="submit"
                >
                  Legg til vare
                </button>
              </Form>
            </details>
          </article>
        </section>

        {loaderData.storeGroups.length ? (
          <section className="grid gap-6">
            {loaderData.storeGroups.map((group) => (
              <article
                key={group.store?.id ?? "no-store"}
                className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200"
              >
                <h2 className="text-lg font-semibold text-slate-950">
                  {group.store?.name ?? "Ingen valgt butikk"}
                </h2>
                <div className="mt-6 grid gap-5">
                  {group.sections.map((section) => (
                    <section
                      key={`${group.store?.id ?? "no-store"}:${section.category.id}`}
                    >
                      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                        {section.displayName}
                      </h3>
                      <div className="mt-3 grid gap-2">
                        {section.items
                          .filter((item) => item.sourceType === "FAMILY")
                          .map((item) => {
                            const isPendingCheckToggle =
                              navigation.state === "submitting" &&
                              pendingIntent ===
                                "toggle-family-shopping-item-checked" &&
                              pendingSourceKey === item.sourceKey;
                            const isPendingFamilySave =
                              navigation.state === "submitting" &&
                              pendingIntent === "update-family-shopping-item" &&
                              pendingSourceKey === item.sourceKey;
                            const isPendingFamilyDelete =
                              navigation.state === "submitting" &&
                              pendingIntent === "delete-family-shopping-item" &&
                              pendingSourceKey === item.sourceKey;
                            const familyValues =
                              actionData?.intent ===
                                "update-family-shopping-item" &&
                              actionData.itemTarget?.sourceKey ===
                                item.sourceKey &&
                              actionData.familyValues
                                ? actionData.familyValues
                                : item.sourceType === "FAMILY"
                                  ? {
                                      categoryId: item.category.id,
                                      name: item.name,
                                      note: item.note ?? "",
                                      preferredStoreId:
                                        item.preferredStore?.id ?? "",
                                      quantity: item.quantity ?? "",
                                    }
                                  : null;

                            return (
                              <article
                                key={item.sourceKey}
                                className={`rounded-[24px] border p-4 ${
                                  item.checked
                                    ? "border-slate-200 bg-slate-100 opacity-80"
                                    : "border-slate-200 bg-slate-50"
                                }`}
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4
                                    className={`text-base font-semibold ${
                                      item.checked
                                        ? "text-slate-500 line-through"
                                        : "text-slate-950"
                                    }`}
                                  >
                                    {item.name}
                                  </h4>
                                  {formatGeneratedQuantityBadge(item) ? (
                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                                      {formatGeneratedQuantityBadge(item)}
                                    </span>
                                  ) : null}
                                  <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-800">
                                    Alltid på listen
                                  </span>
                                </div>
                                {formatCompactShoppingSourceLine(item) ? (
                                  <p className="mt-2 text-xs text-slate-600">
                                    {formatCompactShoppingSourceLine(item)}
                                  </p>
                                ) : null}
                                <details className="mt-4">
                                  <summary className="cursor-pointer text-sm font-medium text-slate-800">
                                    Detaljer
                                  </summary>
                                  <div className="mt-4">
                                    <ShoppingListItemExpanded
                                      actionData={actionData}
                                      categories={loaderData.categories}
                                      familyValues={familyValues}
                                      isPendingCheckToggle={
                                        isPendingCheckToggle
                                      }
                                      isPendingFamilyDelete={
                                        isPendingFamilyDelete
                                      }
                                      isPendingFamilySave={isPendingFamilySave}
                                      isPendingGeneratedExclude={false}
                                      isPendingGeneratedSave={false}
                                      isPendingManualDelete={false}
                                      isPendingManualSave={false}
                                      item={item}
                                      manualValues={null}
                                      overrideValues={null}
                                      stores={loaderData.stores}
                                      toggleExpectedVersion={getToggleExpectedVersion(
                                        item,
                                      )}
                                    />
                                  </div>
                                </details>
                              </article>
                            );
                          })}
                      </div>
                    </section>
                  ))}
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-950">
              Listen er tom
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {isLg
                ? "Legg til den første varen med skjemaet over."
                : "Legg til den første varen med feltet nederst."}
            </p>
          </section>
        )}
      </div>

      {!isLg ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto mx-auto max-w-5xl">
            <div className="rounded-[28px] bg-white p-4 shadow-2xl ring-1 ring-slate-200">
              {quickAddFormError ? (
                <p className="mb-3 text-sm text-rose-600">{quickAddFormError}</p>
              ) : null}
              <ManualShoppingQuickAdd
                {...quickAddProps}
                autoFocus
                revealOnFocus
              />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  let title = "Noe gikk galt";
  let message = "Vi klarte ikke å laste familiens handleliste akkurat nå.";

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

function requireRouteParam(value: string | undefined, message: string) {
  if (!value) {
    throw new Response(message, {
      status: 404,
      statusText: "Not Found",
    });
  }

  return value;
}

function buildFamilyShoppingRedirect({
  familyId,
  notice,
  request,
}: {
  familyId: string;
  notice: FamilyShoppingNotice;
  request: Request;
}) {
  const url = new URL(`/families/${familyId}/shopping`, request.url);
  url.searchParams.set("notice", notice);

  return Response.redirect(url, 302);
}

function getFamilyShoppingNotice(
  request: Request,
): FamilyShoppingNotice | null {
  const notice = new URL(request.url).searchParams.get("notice");

  if (
    notice === "family-shopping-item-added" ||
    notice === "family-shopping-item-deleted" ||
    notice === "family-shopping-item-updated" ||
    notice === "family-shopping-item-check-state-updated"
  ) {
    return notice;
  }

  return null;
}

function getFamilyShoppingNoticeContent(notice: FamilyShoppingNotice) {
  switch (notice) {
    case "family-shopping-item-added":
      return {
        description: "Varen er lagt til på familiens faste liste.",
        title: "Vare lagt til",
      };
    case "family-shopping-item-deleted":
      return {
        description: "Varen er fjernet fra familiens faste liste.",
        title: "Vare fjernet",
      };
    case "family-shopping-item-updated":
      return {
        description: "Endringene på varelinjen er lagret.",
        title: "Vare oppdatert",
      };
    case "family-shopping-item-check-state-updated":
      return {
        description: "Avkryssingen er oppdatert.",
        title: "Status oppdatert",
      };
  }
}

function parseExpectedUpdatedAt(formData: FormData) {
  return String(formData.get("expectedUpdatedAt") ?? "");
}

function getPendingSourceKey(formData: FormData | undefined) {
  if (!formData) {
    return null;
  }

  const sourceKey = formData.get("sourceKey");
  const familyItemId = formData.get("familyItemId");

  if (typeof sourceKey === "string" && sourceKey.length > 0) {
    return sourceKey;
  }

  if (typeof familyItemId === "string" && familyItemId.length > 0) {
    return familyItemId;
  }

  return null;
}
