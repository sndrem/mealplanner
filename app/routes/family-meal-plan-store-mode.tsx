import { ShoppingItemSource } from "@prisma/client";
import type { ChangeEvent, ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Form,
  Link,
  isRouteErrorResponse,
  useFetcher,
  useNavigation,
  useRevalidator,
  useSubmit,
  type MetaFunction,
} from "react-router";

import { ManualShoppingQuickAdd } from "../components/manual-shopping-quick-add";
import { StoreModeDeprioritizeBoughtToggle } from "../components/store-mode-deprioritize-bought-toggle";
import { StoreModeShoppingItemCard } from "../components/store-mode-shopping-item-card";
import { StoreModeShoppingViewToggle } from "../components/store-mode-shopping-view-toggle";
import { requireUser } from "../lib/auth.server";
import {
  createQuickFamilyShoppingItem,
  parseQuickAddFamilyShoppingItemInput,
  toggleFamilyShoppingItemChecked,
} from "../lib/family-shopping-write.server";
import {
  buildStoreModeDeprioritizeBoughtStorageKey,
  buildStoreModeViewStorageKey,
  computeStoreModeProgress,
  partitionStoreModeSections,
  readStoreModeDeprioritizeBought,
  readStoreModeShoppingView,
  type StoreModeShoppingView,
  writeStoreModeDeprioritizeBought,
  writeStoreModeShoppingView,
} from "../lib/shopping-store-mode-client";
import {
  getMealPlanStoreModeData,
  listRecentManualShoppingItemsForFamily,
} from "../lib/shopping.server";
import {
  toggleShoppingItemChecked,
  updateActiveShoppingDate,
} from "../lib/shopping-write.server";
import { updateSelectedStorePreference } from "../lib/store-write.server";
import {
  STORE_MODE_SYNC_PROGRESS_MESSAGE,
  useStoreModeToggleSync,
} from "../lib/use-store-mode-toggle-sync";

type StoreModeNotice =
  | "active-shopping-date-updated"
  | "family-shopping-item-added"
  | "selected-store-updated"
  | "shopping-item-check-state-updated";

type StoreModeIntent =
  | "quick-add-family-shopping-item"
  | "toggle-family-shopping-item-checked"
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
  const [result, recentManualItems] = await Promise.all([
    getMealPlanStoreModeData({
      familyId,
      mealPlanId,
      userId: user.id,
    }),
    listRecentManualShoppingItemsForFamily({
      familyId,
    }),
  ]);

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
    recentManualItems,
    selectedStore: result.selectedStore,
    stockIngredientCount: result.stockIngredientCount,
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
      expectedMealPlanUpdatedAt: String(
        formData.get("mealPlanUpdatedAt") ?? "",
      ),
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

  if (intent === "quick-add-family-shopping-item") {
    const result = await createQuickFamilyShoppingItem({
      familyId,
      input: parseQuickAddFamilyShoppingItemInput(formData),
      userId: user.id,
    });

    if (result.status === "VALIDATION_ERROR") {
      return {
        formError: "formError" in result ? result.formError : undefined,
        intent,
      } satisfies StoreModeActionData;
    }

    return buildStoreModeRedirect({
      familyId,
      mealPlanId,
      notice: "family-shopping-item-added",
      request,
    });
  }

  if (intent === "toggle-family-shopping-item-checked") {
    const familyItemId = String(formData.get("sourceKey") ?? "").trim();
    const checked = String(formData.get("checked") ?? "") === "true";

    if (!familyItemId) {
      return {
        formError: "Vi fant ikke handlelinjen som skulle oppdateres.",
        intent,
      } satisfies StoreModeActionData;
    }

    const result = await toggleFamilyShoppingItemChecked({
      checked,
      expectedUpdatedAt: String(formData.get("expectedUpdatedAt") ?? ""),
      familyId,
      familyItemId,
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
  const submit = useSubmit();
  const revalidator = useRevalidator();
  const toggleFetcher = useFetcher<StoreModeActionData>();
  const pendingIntent = navigation.formData?.get("intent");
  const isSavingStore =
    navigation.state === "submitting" &&
    pendingIntent === "update-selected-store";
  const isSavingShoppingDate =
    navigation.state === "submitting" &&
    pendingIntent === "update-active-shopping-date";
  const loaderDueItems = useMemo(
    () => loaderData.dueSectionGroups.flatMap((section) => section.items),
    [loaderData.dueSectionGroups],
  );
  const {
    displayItemsBySourceKey,
    handleToggle,
    syncBannerMessage,
  } = useStoreModeToggleSync({
    activeShoppingDate: loaderData.activeShoppingDate,
    familyId: loaderData.family.id,
    loaderItems: loaderDueItems,
    mealPlanId: loaderData.mealPlan.id,
    revalidate: revalidator.revalidate,
    toggleFetcher,
  });
  const displayDueItems = useMemo(
    () =>
      loaderDueItems.map(
        (item) => displayItemsBySourceKey.get(item.sourceKey) ?? item,
      ),
    [displayItemsBySourceKey, loaderDueItems],
  );
  const displayProgress = useMemo(
    () => computeStoreModeProgress(displayDueItems),
    [displayDueItems],
  );
  const displaySectionGroups = useMemo(
    () =>
      loaderData.dueSectionGroups.map((section) => ({
        ...section,
        items: section.items.map(
          (item) => displayItemsBySourceKey.get(item.sourceKey) ?? item,
        ),
      })),
    [displayItemsBySourceKey, loaderData.dueSectionGroups],
  );
  const viewStorageKey = useMemo(
    () =>
      buildStoreModeViewStorageKey({
        familyId: loaderData.family.id,
        mealPlanId: loaderData.mealPlan.id,
      }),
    [loaderData.family.id, loaderData.mealPlan.id],
  );
  const deprioritizeBoughtStorageKey = useMemo(
    () =>
      buildStoreModeDeprioritizeBoughtStorageKey({
        familyId: loaderData.family.id,
        mealPlanId: loaderData.mealPlan.id,
      }),
    [loaderData.family.id, loaderData.mealPlan.id],
  );
  const [shoppingView, setShoppingView] = useState<StoreModeShoppingView>(
    () => readStoreModeShoppingView(viewStorageKey),
  );
  const [deprioritizeBought, setDeprioritizeBought] = useState(() =>
    readStoreModeDeprioritizeBought(deprioritizeBoughtStorageKey),
  );
  const handleShoppingViewChange = useCallback(
    (nextView: StoreModeShoppingView) => {
      setShoppingView(nextView);
      writeStoreModeShoppingView(viewStorageKey, nextView);
    },
    [viewStorageKey],
  );
  const handleDeprioritizeBoughtChange = useCallback(
    (enabled: boolean) => {
      setDeprioritizeBought(enabled);
      writeStoreModeDeprioritizeBought(deprioritizeBoughtStorageKey, enabled);
    },
    [deprioritizeBoughtStorageKey],
  );
  useEffect(() => {
    setShoppingView(readStoreModeShoppingView(viewStorageKey));
  }, [viewStorageKey]);
  useEffect(() => {
    setDeprioritizeBought(
      readStoreModeDeprioritizeBought(deprioritizeBoughtStorageKey),
    );
  }, [deprioritizeBoughtStorageKey]);
  type StoreModeDisplayItem = (typeof displayDueItems)[number];
  type StoreModeDisplaySection = (typeof displaySectionGroups)[number];
  const { activeSections, boughtItems } = useMemo((): {
    activeSections: StoreModeDisplaySection[];
    boughtItems: StoreModeDisplayItem[];
  } => partitionStoreModeSections(displaySectionGroups, deprioritizeBought), [
    deprioritizeBought,
    displaySectionGroups,
  ]);
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

  return (
    <main className="min-h-screen bg-slate-100 px-4 pb-36 pt-8 text-slate-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <section className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-slate-200">
          <h1 className="min-w-0 truncate font-semibold text-slate-950">
            {loaderData.mealPlan.title}
          </h1>
          <span className="hidden text-slate-300 sm:inline" aria-hidden="true">
            ·
          </span>
          <span className="truncate text-slate-600">
            {loaderData.selectedStore?.name ?? "Ingen butikk"}
          </span>
          <span className="hidden text-slate-300 sm:inline" aria-hidden="true">
            ·
          </span>
          <span className="truncate text-slate-600">
            {formatDateLabel(loaderData.activeShoppingDate)}
          </span>
          <span className="hidden text-slate-300 sm:inline" aria-hidden="true">
            ·
          </span>
          <span className="shrink-0 font-medium text-emerald-700">
            {displayProgress.checkedCount}/{displayProgress.totalCount}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <Link
              className="text-slate-600 underline-offset-2 hover:text-slate-950 hover:underline"
              to={`/families/${loaderData.family.id}/meal-plans/${loaderData.mealPlan.id}/shopping`}
            >
              Handleliste
            </Link>
            <Link
              className="text-slate-600 underline-offset-2 hover:text-slate-950 hover:underline"
              to={`/families/${loaderData.family.id}/stores`}
            >
              Butikker
            </Link>
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

        {syncBannerMessage ? (
          <section
            className={
              syncBannerMessage === STORE_MODE_SYNC_PROGRESS_MESSAGE
                ? "rounded-[28px] border border-amber-200 bg-amber-50 px-6 py-5 text-amber-950 shadow-sm"
                : "rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-5 text-rose-900 shadow-sm"
            }
          >
            <h2 className="text-base font-semibold">
              {syncBannerMessage === STORE_MODE_SYNC_PROGRESS_MESSAGE
                ? "Synkroniserer"
                : "Kunne ikke synkronisere"}
            </h2>
            <p className="mt-2 text-sm leading-6">{syncBannerMessage}</p>
          </section>
        ) : null}

        {generalFormError ? (
          <section className="rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-5 text-rose-900 shadow-sm">
            <h2 className="text-base font-semibold">
              Kunne ikke oppdatere butikkmodus
            </h2>
            <p className="mt-2 text-sm leading-6">{generalFormError}</p>
          </section>
        ) : null}

        {loaderData.stockIngredientCount > 0 ? (
          <section className="rounded-[28px] border border-amber-200 bg-amber-50 px-6 py-5 text-amber-950 shadow-sm">
            <p className="text-sm font-semibold">
              {loaderData.stockIngredientCount} basisvarer brukt denne uken
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              Basisvarer ligger utenfor butikkmodus med mindre de er lagt til i
              handlelisten.
            </p>
            <Link
              className="mt-4 inline-flex rounded-2xl bg-amber-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-950"
              to={`/families/${loaderData.family.id}/meal-plans/${loaderData.mealPlan.id}/shopping`}
            >
              Åpne handlelisten
            </Link>
          </section>
        ) : null}

        <details className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <summary className="cursor-pointer text-sm font-medium text-slate-800">
            Butikk og handledato
            <span className="ml-2 font-normal text-slate-500">
              {loaderData.selectedStore?.name ?? "Ingen butikk"} ·{" "}
              {formatDateLabel(loaderData.activeShoppingDate)}
            </span>
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <article>
              <h2 className="text-base font-semibold text-slate-950">
                Velg butikk
              </h2>
              <Form className="mt-4 space-y-3" method="post">
                <input
                  name="intent"
                  type="hidden"
                  value="update-selected-store"
                />
                <select
                  aria-busy={isSavingStore}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:cursor-wait disabled:bg-slate-50"
                  defaultValue={selectedStoreValue}
                  disabled={isSavingStore}
                  name="selectedStoreId"
                  onChange={(event) => {
                    submitSelectForm(event, selectedStoreValue, submit);
                  }}
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
              </Form>
            </article>

            <article>
              <h2 className="text-base font-semibold text-slate-950">
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
                  aria-busy={isSavingShoppingDate}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:cursor-wait disabled:bg-slate-50"
                  defaultValue={activeShoppingDateValue}
                  disabled={isSavingShoppingDate}
                  name="activeShoppingDate"
                  onChange={(event) => {
                    submitSelectForm(event, activeShoppingDateValue, submit);
                  }}
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
                    {
                      actionData.activeShoppingDateFieldErrors
                        .activeShoppingDate
                    }
                  </p>
                ) : null}
              </Form>
            </article>
          </div>
        </details>

        {displaySectionGroups.length > 0 ? (
          <section className="grid gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-slate-950">
                Varer å handle
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <StoreModeDeprioritizeBoughtToggle
                  enabled={deprioritizeBought}
                  onChange={handleDeprioritizeBoughtChange}
                />
                <StoreModeShoppingViewToggle
                  onChange={handleShoppingViewChange}
                  view={shoppingView}
                />
              </div>
            </div>
            {activeSections.length > 0 ? (
              activeSections.map((section) => (
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

                  <StoreModeItemGrid
                    items={section.items}
                    layout={shoppingView}
                    onToggleItem={handleToggle}
                    selectedStoreId={loaderData.selectedStore?.id}
                  />
                </article>
              ))
            ) : deprioritizeBought ? (
              <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h3 className="text-base font-semibold text-slate-950">
                  Alt er krysset av
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Du har handlet alle varene for denne turen. Kjøpte varer ligger
                  nedenfor hvis du vil se eller endre dem.
                </p>
              </article>
            ) : null}
            {deprioritizeBought && boughtItems.length > 0 ? (
              <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-950">Kjøpt</h2>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {boughtItems.length} varer
                  </span>
                </div>

                <StoreModeItemGrid
                  items={boughtItems}
                  layout={shoppingView}
                  onToggleItem={handleToggle}
                  selectedStoreId={loaderData.selectedStore?.id}
                />
              </article>
            ) : null}
          </section>
        ) : (
          <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-950">
              Ingen varer må handles nå
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Alt er enten ferdig handlet, utenfor denne handleturen, eller
              allerede passert.
            </p>
          </section>
        )}

        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-950">
            Før handledato
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
                    : item.sourceType === "MANUAL" && item.buyOnDate
                      ? formatDateLabel(item.buyOnDate)
                      : item.sourceType === "FAMILY"
                        ? "Alltid på listen"
                        : "Ingen dato"}
                </span>
              ))
            ) : (
              <p className="text-sm leading-6 text-slate-600">
                Ingen varer ligger før handledato akkurat nå.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-4 pt-3">
        <div className="pointer-events-auto mx-auto max-w-4xl">
          <div className="rounded-[28px] bg-white p-4 shadow-2xl ring-1 ring-slate-200">
            {quickAddFormError ? (
              <p className="mb-3 text-sm text-rose-600">{quickAddFormError}</p>
            ) : null}
            <ManualShoppingQuickAdd
              ingredientSearchPath={ingredientSearchPath}
              quickAddIntent="quick-add-family-shopping-item"
              recentManualItems={loaderData.recentManualItems}
              revealOnFocus
            />
          </div>
        </div>
      </div>
    </main>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  let title = "Noe gikk galt";
  let message = "Vi klarte ikke å laste butikkmodus akkurat nå.";

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
  >["laterItems"][number] | Awaited<
    ReturnType<typeof getMealPlanStoreModeData>
  >["dueSectionGroups"][number]["items"][number],
) {
  if (item.sourceType === "FAMILY") {
    return item;
  }

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
    notice === "family-shopping-item-added" ||
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
    case "family-shopping-item-added":
      return {
        description: "Varen ble lagt til og vises i handlelisten.",
        title: "Vare lagt til",
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

function StoreModeItemGrid<TItem extends ComponentProps<typeof StoreModeShoppingItemCard>["item"]>({
  items,
  layout,
  onToggleItem,
  selectedStoreId,
}: {
  items: TItem[];
  layout: StoreModeShoppingView;
  onToggleItem: (item: TItem) => void;
  selectedStoreId?: string;
}) {
  return (
    <div
      className={
        layout === "grid"
          ? "mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
          : "mt-4 flex flex-col gap-2"
      }
    >
      {items.map((item) => (
        <StoreModeShoppingItemCard
          key={item.sourceKey}
          item={item}
          layout={layout}
          onToggle={() => onToggleItem(item)}
          selectedStoreId={selectedStoreId}
        />
      ))}
    </div>
  );
}

function submitSelectForm(
  event: ChangeEvent<HTMLSelectElement>,
  currentValue: string,
  submit: ReturnType<typeof useSubmit>,
) {
  const nextValue = event.currentTarget.value;

  if (nextValue === currentValue) {
    return;
  }

  const form = event.currentTarget.form;

  if (form) {
    void submit(form);
  }
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
