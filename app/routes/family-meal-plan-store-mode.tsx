import { ShoppingItemSource } from "@prisma/client";
import {
  Form,
  Link,
  isRouteErrorResponse,
  useFetcher,
  useNavigation,
  type MetaFunction,
} from "react-router";

import { requireUser } from "../lib/auth.server";
import { getMealPlanStoreModeData } from "../lib/shopping.server";
import {
  toggleShoppingItemChecked,
  updateActiveShoppingDate,
} from "../lib/shopping-write.server";
import { updateSelectedStorePreference } from "../lib/store-write.server";

type StoreModeNotice =
  | "active-shopping-date-updated"
  | "selected-store-updated"
  | "shopping-item-check-state-updated";

type StoreModeIntent =
  | "toggle-shopping-item-checked"
  | "update-active-shopping-date"
  | "update-selected-store";

interface StoreModeActionData {
  activeShoppingDateFieldErrors?: {
    activeShoppingDate?: string;
  };
  activeShoppingDateValue?: string;
  formError?: string;
  intent?: StoreModeIntent;
  ok?: boolean;
  selectedStoreFieldErrors?: {
    selectedStoreId?: string;
  };
  selectedStoreValue?: string;
}

interface FamilyMealPlanStoreModeRouteProps {
  actionData?: StoreModeActionData;
  loaderData: Awaited<ReturnType<typeof loader>>;
}

export const meta: MetaFunction = () => {
  return [
    { title: "Butikkmodus | Mealplanner" },
    {
      name: "description",
      content: "Kompakt butikkmodus for handlelisten i Mealplanner.",
    },
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
  const mealPlanId = requireRouteParam(
    params.mealPlanId,
    "Fant ikke ukeplanen.",
  );
  const result = await getMealPlanStoreModeData({
    familyId,
    mealPlanId,
    userId: user.id,
  });

  return {
    activeShoppingDate: formatDateOnly(result.activeShoppingDate),
    dueSectionGroups: result.dueSectionGroups.map((section) => ({
      ...section,
      items: section.items.map(serializeProjectedShoppingItem),
    })),
    family: result.family,
    laterItems: result.laterItems.map(serializeProjectedShoppingItem),
    mealPlan: {
      ...result.mealPlan,
      activeShoppingDate: result.mealPlan.activeShoppingDate
        ? formatDateOnly(result.mealPlan.activeShoppingDate)
        : null,
      endDate: formatDateOnly(result.mealPlan.endDate),
      entries: undefined,
      manualShoppingItems: undefined,
      shoppingOverrides: undefined,
      startDate: formatDateOnly(result.mealPlan.startDate),
      updatedAt: result.mealPlan.updatedAt.toISOString(),
    },
    notice: getStoreModeNotice(request),
    progress: result.progress,
    selectedStore: result.selectedStore,
    stores: result.stores,
    userRole: result.userRole,
    visibleDates: result.visibleDates,
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
  const mealPlanId = requireRouteParam(
    params.mealPlanId,
    "Fant ikke ukeplanen.",
  );
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "update-active-shopping-date") {
    const activeShoppingDate = String(formData.get("activeShoppingDate") ?? "");
    const result = await updateActiveShoppingDate({
      activeShoppingDate,
      expectedMealPlanUpdatedAt: String(formData.get("mealPlanUpdatedAt") ?? ""),
      familyId,
      mealPlanId,
      userId: user.id,
    });

    if (result.status === "NOT_FOUND") {
      throw buildMealPlanNotFoundResponse();
    }

    if (result.status === "VALIDATION_ERROR") {
      return {
        activeShoppingDateFieldErrors: result.fieldErrors,
        activeShoppingDateValue: result.values.activeShoppingDate,
        intent,
      } satisfies StoreModeActionData;
    }

    if (result.status === "CONFLICT") {
      return {
        formError: result.formError,
        intent,
      } satisfies StoreModeActionData;
    }

    return buildStoreModeRedirect({
      familyId,
      mealPlanId,
      notice: "active-shopping-date-updated",
      request,
    });
  }

  if (intent === "update-selected-store") {
    const selectedStoreId = String(formData.get("selectedStoreId") ?? "");
    const result = await updateSelectedStorePreference({
      familyId,
      selectedStoreId,
      userId: user.id,
    });

    if (result.status === "VALIDATION_ERROR") {
      return {
        intent,
        selectedStoreFieldErrors: result.fieldErrors,
        selectedStoreValue: result.values.selectedStoreId,
      } satisfies StoreModeActionData;
    }

    return buildStoreModeRedirect({
      familyId,
      mealPlanId,
      notice: "selected-store-updated",
      request,
    });
  }

  if (intent === "toggle-shopping-item-checked") {
    const sourceKey = String(formData.get("sourceKey") ?? "").trim();
    const sourceType = parseShoppingItemSource(formData.get("sourceType"));
    const checked = String(formData.get("checked") ?? "") === "true";

    if (!sourceKey || !sourceType) {
      return {
        formError: "Vi fant ikke handlelinjen som skulle oppdateres.",
        intent,
      } satisfies StoreModeActionData;
    }

    const result = await toggleShoppingItemChecked({
      checked,
      expectedUpdatedAt: String(formData.get("expectedUpdatedAt") ?? ""),
      familyId,
      mealPlanId,
      sourceKey,
      sourceType,
      userId: user.id,
    });

    if (result.status === "NOT_FOUND") {
      throw buildMealPlanNotFoundResponse();
    }

    if (result.status === "CONFLICT") {
      return {
        formError: result.formError,
        intent,
      } satisfies StoreModeActionData;
    }

    return {
      intent,
      ok: true,
    } satisfies StoreModeActionData;
  }

  return {
    formError: "Ukjent handling.",
  } satisfies StoreModeActionData;
}

export default function FamilyMealPlanStoreModeRoute({
  actionData,
  loaderData,
}: FamilyMealPlanStoreModeRouteProps) {
  const navigation = useNavigation();
  const toggleFetcher = useFetcher<StoreModeActionData>();
  const pendingIntent = navigation.formData?.get("intent");
  const pendingSourceKey = getPendingSourceKey(toggleFetcher.formData);
  const toggleFormError =
    toggleFetcher.data?.intent === "toggle-shopping-item-checked" &&
    toggleFetcher.data.formError
      ? toggleFetcher.data.formError
      : null;
  const noticeContent = loaderData.notice
    ? getStoreModeNoticeContent(loaderData.notice)
    : null;
  const selectedStoreValue =
    actionData?.intent === "update-selected-store" &&
    actionData.selectedStoreValue !== undefined
      ? actionData.selectedStoreValue
      : (loaderData.selectedStore?.id ?? "");
  const activeShoppingDateValue =
    actionData?.intent === "update-active-shopping-date" &&
    actionData.activeShoppingDateValue
      ? actionData.activeShoppingDateValue
      : loaderData.activeShoppingDate;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <section className="rounded-[32px] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
                  Butikkmodus
                </span>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight">
                  {loaderData.mealPlan.title}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  Storflatevisning for handleturen med seksjonsrekkefolge fra
                  valgt butikk og bare varer som er relevante innen
                  handledatoen.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-600"
                  to={`/families/${loaderData.family.id}/meal-plans/${loaderData.mealPlan.id}/shopping`}
                >
                  Åpne handleliste
                </Link>
                <Link
                  className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/15"
                  to={`/families/${loaderData.family.id}/stores`}
                >
                  Administrer butikker
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] bg-white/10 p-4">
                <p className="text-sm text-slate-300">Aktiv butikk</p>
                <p className="mt-1 text-lg font-semibold">
                  {loaderData.selectedStore?.name ?? "Ingen valgt butikk"}
                </p>
              </div>
              <div className="rounded-[24px] bg-white/10 p-4">
                <p className="text-sm text-slate-300">Handledato</p>
                <p className="mt-1 text-lg font-semibold">
                  {formatDateLabel(loaderData.activeShoppingDate)}
                </p>
              </div>
              <div className="rounded-[24px] bg-emerald-500/20 p-4 ring-1 ring-emerald-400/30">
                <p className="text-sm text-emerald-100">Fremdrift</p>
                <p className="mt-1 text-lg font-semibold">
                  {loaderData.progress.checkedCount}/
                  {loaderData.progress.totalCount} varer krysset av
                </p>
              </div>
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

        {actionData?.formError || toggleFormError ? (
          <section className="rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-5 text-rose-900 shadow-sm">
            <h2 className="text-base font-semibold">
              Kunne ikke oppdatere butikkmodus
            </h2>
            <p className="mt-2 text-sm leading-6">
              {actionData?.formError ?? toggleFormError}
            </p>
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-950">
              Velg butikk
            </h2>
            <Form className="mt-4 space-y-3" method="post">
              <input
                name="intent"
                type="hidden"
                value="update-selected-store"
              />
              <select
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                defaultValue={selectedStoreValue}
                name="selectedStoreId"
              >
                {loaderData.stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
              {actionData?.intent === "update-selected-store" &&
              actionData.selectedStoreFieldErrors?.selectedStoreId ? (
                <p className="text-sm text-rose-600">
                  {actionData.selectedStoreFieldErrors.selectedStoreId}
                </p>
              ) : null}
              <button
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={
                  navigation.state === "submitting" &&
                  pendingIntent === "update-selected-store"
                }
                type="submit"
              >
                {navigation.state === "submitting" &&
                pendingIntent === "update-selected-store"
                  ? "Lagrer butikk..."
                  : "Lagre butikkvalg"}
              </button>
            </Form>
          </article>

          <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-950">
              Velg handledato
            </h2>
            <Form className="mt-4 space-y-3" method="post">
              <input
                name="intent"
                type="hidden"
                value="update-active-shopping-date"
              />
              <input
                name="mealPlanUpdatedAt"
                type="hidden"
                value={loaderData.mealPlan.updatedAt}
              />
              <select
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                defaultValue={activeShoppingDateValue}
                name="activeShoppingDate"
              >
                {loaderData.visibleDates.map((date) => (
                  <option key={date} value={date}>
                    {formatDateLabel(date)}
                  </option>
                ))}
              </select>
              {actionData?.intent === "update-active-shopping-date" &&
              actionData.activeShoppingDateFieldErrors?.activeShoppingDate ? (
                <p className="text-sm text-rose-600">
                  {actionData.activeShoppingDateFieldErrors.activeShoppingDate}
                </p>
              ) : null}
              <button
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={
                  navigation.state === "submitting" &&
                  pendingIntent === "update-active-shopping-date"
                }
                type="submit"
              >
                {navigation.state === "submitting" &&
                pendingIntent === "update-active-shopping-date"
                  ? "Lagrer dato..."
                  : "Lagre handledato"}
              </button>
            </Form>
          </article>
        </section>

        {loaderData.dueSectionGroups.length > 0 ? (
          <section className="grid gap-4">
            {loaderData.dueSectionGroups.map((section) => (
              <article
                key={`${loaderData.selectedStore?.id ?? "no-store"}:${section.category.id}`}
                className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200"
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-950">
                    {section.displayName}
                  </h2>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {section.items.length} varer
                  </span>
                </div>

                <div className="mt-4 grid gap-3">
                  {section.items.map((item) => {
                    const isPendingToggle =
                      toggleFetcher.state !== "idle" &&
                      toggleFetcher.formData?.get("intent") ===
                        "toggle-shopping-item-checked" &&
                      pendingSourceKey === item.sourceKey;

                    return (
                      <toggleFetcher.Form
                        key={item.sourceKey}
                        className="block"
                        method="post"
                        preventScrollReset
                      >
                            <input
                              name="intent"
                              type="hidden"
                              value="toggle-shopping-item-checked"
                            />
                            <input
                              name="sourceKey"
                              type="hidden"
                              value={item.sourceKey}
                            />
                            <input
                              name="sourceType"
                              type="hidden"
                              value={item.sourceType}
                            />
                            <input
                              name="checked"
                              type="hidden"
                              value={item.checked ? "false" : "true"}
                            />
                            <input
                              name="expectedUpdatedAt"
                              type="hidden"
                              value={getToggleExpectedVersion(item)}
                            />
                        <button
                          aria-label={
                            item.checked
                              ? `Marker ${item.name} som ikke handlet`
                              : `Marker ${item.name} som handlet`
                          }
                          aria-pressed={item.checked}
                          className={
                            item.checked
                              ? "flex w-full cursor-pointer touch-manipulation items-start gap-4 rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 text-left transition hover:bg-emerald-100 active:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
                              : "flex w-full cursor-pointer touch-manipulation items-start gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-left transition hover:bg-slate-100 active:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
                          }
                          disabled={isPendingToggle}
                          type="submit"
                        >
                          <span
                            aria-hidden="true"
                            className={
                              item.checked
                                ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-semibold text-white"
                                : "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 bg-white text-lg font-semibold text-slate-400"
                            }
                          >
                            {item.checked ? "✓" : ""}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-base font-semibold text-slate-950">
                                {item.name}
                              </span>
                              {item.quantityLabel ? (
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                                  {item.quantityLabel}
                                </span>
                              ) : null}
                              {item.sourceType === "MANUAL" ? (
                                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
                                  Manuell
                                </span>
                              ) : null}
                              {item.preferredStore &&
                              item.preferredStore.id !==
                                loaderData.selectedStore?.id ? (
                                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                                  Foretrekker {item.preferredStore.name}
                                </span>
                              ) : null}
                            </span>

                            <span className="mt-2 block text-sm leading-6 text-slate-600">
                              {item.sourceType === "GENERATED"
                                ? `Fra ${item.occurrenceCount} planlagte ${
                                    item.occurrenceCount === 1
                                      ? "middag"
                                      : "middager"
                                  } fram til ${formatDateLabel(item.lastDate)}.`
                                : item.buyOnDate
                                  ? `Manuell vare planlagt for ${formatDateLabel(item.buyOnDate)}.`
                                  : "Manuell vare uten spesifikk handledato."}
                            </span>

                            {item.note ? (
                              <span className="mt-2 block text-sm leading-6 text-slate-700">
                                Notat: {item.note}
                              </span>
                            ) : null}
                            {item.sourceType === "GENERATED" &&
                            item.postponedUntilDate ? (
                              <span className="mt-2 block text-sm leading-6 text-amber-800">
                                Utsatt til{" "}
                                {formatDateLabel(item.postponedUntilDate)}.
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </toggleFetcher.Form>
                    );
                  })}
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-950">
              Ingen varer ma handles na
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Alt er enten ferdig handlet eller planlagt for senere i den aktive
              ukeplanen.
            </p>
          </section>
        )}

        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-950">
            Senere i perioden
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {loaderData.laterItems.length > 0 ? (
              loaderData.laterItems.map((item) => (
                <span
                  key={`later:${item.sourceKey}`}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  {item.name}
                  {" · "}
                  {item.sourceType === "GENERATED"
                    ? formatDateLabel(item.postponedUntilDate ?? item.firstDate)
                    : item.buyOnDate
                      ? formatDateLabel(item.buyOnDate)
                      : "Ingen dato"}
                </span>
              ))
            ) : (
              <p className="text-sm leading-6 text-slate-600">
                Ingen senere varer akkurat na.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  let title = "Noe gikk galt";
  let message = "Vi klarte ikke a laste butikkmodus akkurat na.";

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Fant ikke ukeplanen" : title;
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

function serializeProjectedShoppingItem(
  item: Awaited<
    ReturnType<typeof getMealPlanStoreModeData>
  >["laterItems"][number],
) {
  if (item.sourceType === ShoppingItemSource.GENERATED) {
    return {
      ...item,
      firstDate: formatDateOnly(item.firstDate),
      lastDate: formatDateOnly(item.lastDate),
      occurrences: item.occurrences.map((occurrence) => ({
        ...occurrence,
        date: formatDateOnly(occurrence.date),
      })),
      postponedUntilDate: item.postponedUntilDate
        ? formatDateOnly(item.postponedUntilDate)
        : null,
    };
  }

  return {
    ...item,
    buyOnDate: item.buyOnDate ? formatDateOnly(item.buyOnDate) : null,
  };
}

function getStoreModeNotice(request: Request): StoreModeNotice | null {
  const notice = new URL(request.url).searchParams.get("notice");

  if (
    notice === "active-shopping-date-updated" ||
    notice === "selected-store-updated" ||
    notice === "shopping-item-check-state-updated"
  ) {
    return notice;
  }

  return null;
}

function getStoreModeNoticeContent(notice: StoreModeNotice) {
  switch (notice) {
    case "selected-store-updated":
      return {
        description: "Butikkvalget ditt ble lagret for denne familien.",
        title: "Butikkvalg lagret",
      };
    case "active-shopping-date-updated":
      return {
        description: "Handledatoen for ukeplanen ble oppdatert.",
        title: "Handledato lagret",
      };
    case "shopping-item-check-state-updated":
      return {
        description: "Avkryssingen for varelinjen ble oppdatert.",
        title: "Vare oppdatert",
      };
  }
}

function buildStoreModeRedirect({
  familyId,
  mealPlanId,
  notice,
  request,
}: {
  familyId: string;
  mealPlanId: string;
  notice: StoreModeNotice;
  request: Request;
}) {
  const url = new URL(
    `/families/${familyId}/meal-plans/${mealPlanId}/store-mode`,
    request.url,
  );
  url.searchParams.set("notice", notice);

  return Response.redirect(url, 302);
}

function parseShoppingItemSource(value: FormDataEntryValue | null) {
  if (
    value === ShoppingItemSource.GENERATED ||
    value === ShoppingItemSource.MANUAL
  ) {
    return value;
  }

  return null;
}

function getPendingSourceKey(formData: FormData | undefined) {
  if (!formData) {
    return null;
  }

  const sourceKey = formData.get("sourceKey");

  if (typeof sourceKey === "string" && sourceKey.trim()) {
    return sourceKey;
  }

  return null;
}

function buildMealPlanNotFoundResponse() {
  return new Response("Fant ikke ukeplanen.", {
    status: 404,
    statusText: "Not Found",
  });
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

function getToggleExpectedVersion(item: {
  collaborationVersion: string;
  overrideVersion?: string;
  sourceType: ShoppingItemSource;
}) {
  if (item.sourceType === ShoppingItemSource.MANUAL) {
    return item.overrideVersion ?? "";
  }

  return item.collaborationVersion;
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
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}
