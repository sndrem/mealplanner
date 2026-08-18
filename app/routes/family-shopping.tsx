import { ShoppingItemSource } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Form,
  Link,
  isRouteErrorResponse,
  useNavigation,
  useRevalidator,
  type MetaFunction,
} from "react-router";

import { ManualShoppingQuickAdd } from "../components/manual-shopping-quick-add";
import { ShoppingListItemExpanded } from "../components/shopping-list-item-expanded";
import { requireUser } from "../lib/auth.server";
import { formatDateOnly } from "../lib/meal-plan-dates";
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
  formatGeneratedItemSummary,
  formatGeneratedQuantityBadge,
} from "../lib/shopping-display";
import {
  parseFamilyShoppingListMode,
  updateFamilyShoppingListMode,
} from "../lib/shopping-preference-write.server";
import { getToggleExpectedVersion } from "../lib/shopping-store-mode-client";
import {
  applyOptimisticShoppingListFormOverlay,
  buildOptimisticManualShoppingItem,
  dropResolvedOptimisticItemsFromStoreGroups,
  filterStoreGroupsBySourceType,
  getOptimisticChecked,
  insertProjectedItemIntoStoreGroups,
  prependRecentManualItem,
  removeProjectedItemFromStoreGroups,
} from "../lib/shopping-list-client";
import type {
  OptimisticQuickAddDraft,
  QuickAddShoppingSuccess,
} from "../lib/shopping-quick-add";
import { scrollToShoppingItem } from "../lib/shopping-quick-add-feedback.client";
import {
  serializeProjectedShoppingItem,
  type SerializedProjectedShoppingItem,
} from "../lib/shopping-serialize";
import {
  getFamilyShoppingData,
  listRecentManualShoppingItemsForFamily,
  type RecentManualShoppingItem,
} from "../lib/shopping.server";
import { toggleShoppingItemChecked } from "../lib/shopping-write.server";
import { useDebouncedRevalidate } from "../lib/use-debounced-revalidate";

type FamilyShoppingNotice =
  | "family-shopping-item-added"
  | "family-shopping-item-deleted"
  | "family-shopping-item-updated"
  | "family-shopping-item-check-state-updated"
  | "family-shopping-list-mode-updated";

type FamilyShoppingIntent =
  | "add-family-shopping-item"
  | "quick-add-family-shopping-item"
  | "delete-family-shopping-item"
  | "set-family-shopping-list-mode"
  | "toggle-family-shopping-item-checked"
  | "toggle-meal-plan-shopping-item-checked"
  | "update-family-shopping-item";

interface FamilyShoppingActionData {
  familyFieldErrors?: FamilyShoppingItemFieldErrors;
  familyValues?: FamilyShoppingItemValues;
  formError?: string;
  intent?: FamilyShoppingIntent;
  item?: QuickAddShoppingSuccess["item"];
  itemTarget?: {
    sourceKey: string;
  };
  ok?: true;
  recentManualItem?: RecentManualShoppingItem;
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
    activeListMode: result.activeListMode,
    canOfferCombined: result.canOfferCombined,
    categories: result.categories,
    family: result.family,
    itemCounts: result.itemCounts,
    mealPlanItemCount: result.mealPlanItemCount,
    notice: getFamilyShoppingNotice(request),
    recentManualItems,
    savedListMode: result.savedListMode,
    storeGroups: result.storeGroups.map((group) => ({
      sections: group.sections.map((section) => ({
        ...section,
        items: section.items.map(serializeProjectedShoppingItem),
      })),
      store: group.store,
    })),
    stores: result.stores,
    todayMealPlan: result.todayMealPlan,
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

  if (intent === "set-family-shopping-list-mode") {
    const listMode = parseFamilyShoppingListMode(formData.get("listMode"));

    if (!listMode) {
      return {
        formError: "Ugyldig visningsmodus for handlelisten.",
        intent,
      } satisfies FamilyShoppingActionData;
    }

    const result = await updateFamilyShoppingListMode({
      familyId,
      listMode,
      userId: user.id,
    });

    if (result.status === "VALIDATION_ERROR") {
      return {
        formError: result.formError,
        intent,
      } satisfies FamilyShoppingActionData;
    }

    return buildFamilyShoppingRedirect({
      familyId,
      notice: "family-shopping-list-mode-updated",
      request,
    });
  }

  if (intent === "toggle-meal-plan-shopping-item-checked") {
    const mealPlanId = String(formData.get("mealPlanId") ?? "").trim();
    const sourceKey = String(formData.get("sourceKey") ?? "").trim();
    const sourceType = parseMealPlanShoppingItemSource(
      formData.get("sourceType"),
    );
    const checked = String(formData.get("checked") ?? "") === "true";

    if (!mealPlanId || !sourceKey || !sourceType) {
      return {
        formError: "Fant ikke varelinjen som skulle oppdateres.",
        intent,
      } satisfies FamilyShoppingActionData;
    }

    const result = await toggleShoppingItemChecked({
      checked,
      expectedUpdatedAt: parseExpectedUpdatedAt(formData),
      familyId,
      mealPlanId,
      sourceKey,
      sourceType,
      userId: user.id,
    });

    if (result.status === "NOT_FOUND") {
      return {
        formError: "Fant ikke ukeplanen eller varelinjen.",
        intent,
      } satisfies FamilyShoppingActionData;
    }

    if (result.status === "CONFLICT") {
      return {
        formError: result.formError,
        intent,
        itemTarget: { sourceKey },
      } satisfies FamilyShoppingActionData;
    }

    return buildFamilyShoppingRedirect({
      familyId,
      notice: "family-shopping-item-check-state-updated",
      request,
    });
  }

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

    return {
      intent,
      item: serializeProjectedShoppingItem(result.item),
      ok: true,
      recentManualItem: result.recentManualItem,
    } satisfies FamilyShoppingActionData;
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
  const revalidator = useRevalidator();
  const scheduleRevalidate = useDebouncedRevalidate(revalidator.revalidate);
  const isLg = useIsLgViewport();
  const [storeGroups, setStoreGroups] = useState(loaderData.storeGroups);
  const [recentManualItems, setRecentManualItems] = useState(
    loaderData.recentManualItems,
  );
  const [recentlyAddedSourceKey, setRecentlyAddedSourceKey] = useState<
    string | null
  >(null);
  const noticeContent =
    loaderData.notice !== null
      ? getFamilyShoppingNoticeContent(loaderData.notice)
      : null;
  const pendingIntent = navigation.formData?.get("intent");
  const pendingSourceKey = getPendingSourceKey(navigation.formData);
  const displayListMode =
    navigation.state !== "idle" &&
    pendingIntent === "set-family-shopping-list-mode"
      ? String(
          navigation.formData?.get("listMode") ?? loaderData.activeListMode,
        )
      : loaderData.activeListMode;
  const ingredientSearchPath = `/families/${loaderData.family.id}/shopping/ingredient-search`;
  const generalFormError =
    actionData?.formError &&
    actionData.intent !== "quick-add-family-shopping-item"
      ? actionData.formError
      : undefined;

  useEffect(() => {
    setStoreGroups(
      dropResolvedOptimisticItemsFromStoreGroups(
        loaderData.storeGroups,
        loaderData.storeGroups.flatMap((group) =>
          group.sections.flatMap((section) => section.items),
        ),
      ),
    );
    setRecentManualItems(loaderData.recentManualItems);
  }, [loaderData.recentManualItems, loaderData.storeGroups]);

  const fallbackCategory = useMemo(
    () =>
      loaderData.categories[0] ?? {
        displayName: "Annet",
        id: "uncategorized",
      },
    [loaderData.categories],
  );

  const handleQuickAddSubmit = useCallback(
    (draft: OptimisticQuickAddDraft) => {
      const placeholder = buildOptimisticManualShoppingItem({
        category: {
          id: fallbackCategory.id,
          name: fallbackCategory.displayName,
        },
        name: draft.name,
        quantity: draft.quantity,
        sourceKey: draft.sourceKey,
        sourceType: "FAMILY",
      });
      setStoreGroups((currentGroups) =>
        insertProjectedItemIntoStoreGroups(currentGroups, placeholder),
      );
      setRecentlyAddedSourceKey(draft.sourceKey);
    },
    [fallbackCategory.displayName, fallbackCategory.id],
  );

  const handleQuickAddSuccess = useCallback(
    (payload: QuickAddShoppingSuccess) => {
      setStoreGroups((currentGroups) =>
        insertProjectedItemIntoStoreGroups(
          dropResolvedOptimisticItemsFromStoreGroups(currentGroups, [
            payload.item,
          ]),
          payload.item,
        ),
      );
      setRecentManualItems((currentRecents) =>
        prependRecentManualItem(currentRecents, payload.recentManualItem),
      );
      setRecentlyAddedSourceKey(payload.item.sourceKey);
      scheduleRevalidate();
    },
    [scheduleRevalidate],
  );

  const handleQuickAddError = useCallback((sourceKey: string) => {
    setStoreGroups((currentGroups) =>
      removeProjectedItemFromStoreGroups(currentGroups, sourceKey),
    );
  }, []);

  useEffect(() => {
    if (!recentlyAddedSourceKey) {
      return;
    }

    scrollToShoppingItem(recentlyAddedSourceKey);

    const clearHighlightTimeoutId = window.setTimeout(() => {
      setRecentlyAddedSourceKey((current) =>
        current === recentlyAddedSourceKey ? null : current,
      );
    }, 900);

    return () => {
      window.clearTimeout(clearHighlightTimeoutId);
    };
  }, [recentlyAddedSourceKey, storeGroups]);

  const quickAddProps = {
    ingredientSearchPath,
    onQuickAddError: handleQuickAddError,
    onQuickAddSubmit: handleQuickAddSubmit,
    onQuickAddSuccess: handleQuickAddSuccess,
    quickAddIntent: "quick-add-family-shopping-item" as const,
    recentManualItems,
  };
  const addFamilyValues =
    actionData?.intent === "add-family-shopping-item" && actionData.familyValues
      ? actionData.familyValues
      : defaultFamilyShoppingItemValues;
  const displayStoreGroups = useMemo(() => {
    if (navigation.state === "idle" || !navigation.formData) {
      return storeGroups;
    }

    const overlayGroups = applyOptimisticShoppingListFormOverlay({
      categories: loaderData.categories,
      formData: navigation.formData,
      groups: storeGroups,
      intent: pendingIntent,
      sourceKey: pendingSourceKey,
      stores: loaderData.stores,
    });

    if (pendingIntent !== "add-family-shopping-item") {
      return overlayGroups;
    }

    const name = String(navigation.formData.get("name") ?? "").trim();

    if (!name) {
      return overlayGroups;
    }

    const categoryId = String(navigation.formData.get("categoryId") ?? "");
    const category =
      loaderData.categories.find((entry) => entry.id === categoryId) ??
      fallbackCategory;

    return insertProjectedItemIntoStoreGroups(
      overlayGroups,
      buildOptimisticManualShoppingItem({
        category: {
          id: category.id,
          name: category.displayName,
        },
        name,
        quantity: String(navigation.formData.get("quantity") ?? ""),
        sourceKey: "optimistic:pending-add-family",
        sourceType: "FAMILY",
      }),
    );
  }, [
    fallbackCategory,
    loaderData.categories,
    loaderData.stores,
    navigation.formData,
    navigation.state,
    pendingIntent,
    pendingSourceKey,
    storeGroups,
  ]);
  const visibleStoreGroups =
    displayListMode === "GLOBAL"
      ? filterStoreGroupsBySourceType(displayStoreGroups, "FAMILY")
      : displayStoreGroups;

  return (
    <main className="min-h-screen bg-slate-100 px-4 pb-44 pt-8 text-slate-900 lg:pb-12 lg:py-12">
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

        {loaderData.canOfferCombined ? (
          <section className="rounded-[28px] border border-sky-200 bg-sky-50 px-6 py-5 text-sky-950 shadow-sm">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-base font-semibold">
                  {loaderData.todayMealPlan?.title ?? "Dagens ukeplan"} har{" "}
                  {loaderData.mealPlanItemCount} varelinjer
                </h2>
                <p className="mt-2 text-sm leading-6 text-sky-900">
                  {loaderData.todayMealPlan?.status === "DRAFT"
                    ? "Ukeplanen er fortsatt utkast. Du kan velge om dagens ukeplan skal vises sammen med familiens faste liste."
                    : "Du kan velge om dagens ukeplan skal vises sammen med familiens faste liste."}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Form method="post">
                  <input
                    name="intent"
                    type="hidden"
                    value="set-family-shopping-list-mode"
                  />
                  <input name="listMode" type="hidden" value="GLOBAL" />
                  <button
                    className={`rounded-2xl px-5 py-3 text-sm font-medium transition ${
                      displayListMode === "GLOBAL"
                        ? "bg-slate-950 text-white"
                        : "bg-white text-slate-900 ring-1 ring-sky-200 hover:bg-sky-100"
                    }`}
                    disabled={
                      navigation.state !== "idle" &&
                      pendingIntent === "set-family-shopping-list-mode"
                    }
                    type="submit"
                  >
                    Kun global liste
                  </button>
                </Form>
                <Form method="post">
                  <input
                    name="intent"
                    type="hidden"
                    value="set-family-shopping-list-mode"
                  />
                  <input name="listMode" type="hidden" value="COMBINED" />
                  <button
                    className={`rounded-2xl px-5 py-3 text-sm font-medium transition ${
                      displayListMode === "COMBINED"
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-slate-900 ring-1 ring-sky-200 hover:bg-sky-100"
                    }`}
                    disabled={
                      navigation.state !== "idle" &&
                      pendingIntent === "set-family-shopping-list-mode"
                    }
                    type="submit"
                  >
                    Vis kombinert
                  </button>
                </Form>
              </div>
            </div>
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
              {loaderData.activeListMode === "COMBINED" ? (
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <dt className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                    Visning
                  </dt>
                  <dd className="mt-2 text-sm leading-6 text-slate-700">
                    {loaderData.itemCounts.family} faste varer og{" "}
                    {loaderData.itemCounts.mealPlan} fra dagens ukeplan.
                  </dd>
                </div>
              ) : null}
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
              <div className="mt-6">
                <ManualShoppingQuickAdd {...quickAddProps} />
              </div>
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

        {visibleStoreGroups.length ? (
          <section className="grid gap-6">
            {visibleStoreGroups.map((group) => (
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
                        {section.items.map((item) =>
                          renderFamilyShoppingListItem({
                            actionData,
                            categories: loaderData.categories,
                            familyId: loaderData.family.id,
                            item,
                            navigation,
                            pendingIntent,
                            pendingSourceKey,
                            recentlyAddedSourceKey,
                            stores: loaderData.stores,
                            todayMealPlanId:
                              loaderData.todayMealPlan?.id ?? null,
                          }),
                        )}
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
              {getFamilyShoppingEmptyStateTitle(loaderData)}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {getFamilyShoppingEmptyStateDescription(loaderData, isLg)}
            </p>
          </section>
        )}
      </div>

      {!isLg ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 px-4 pt-3">
          <div className="pointer-events-auto mx-auto max-w-5xl min-w-0">
            <div className="rounded-[28px] bg-white p-4 shadow-2xl ring-1 ring-slate-200">
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
    notice === "family-shopping-item-check-state-updated" ||
    notice === "family-shopping-list-mode-updated"
  ) {
    return notice;
  }

  return null;
}

function formatCompactShoppingSourceLineForItem(
  item: SerializedProjectedShoppingItem,
) {
  if (item.sourceType === "GENERATED") {
    return formatCompactShoppingSourceLine({
      occurrenceCount: item.occurrenceCount,
      occurrences: item.occurrences.map((occurrence) => ({
        date:
          typeof occurrence.date === "string"
            ? occurrence.date
            : formatDateOnly(occurrence.date),
        recipeTitle: occurrence.recipeTitle,
      })),
      sourceType: item.sourceType,
    });
  }

  if (item.sourceType === "MANUAL") {
    return formatCompactShoppingSourceLine({
      buyOnDate: item.buyOnDate
        ? typeof item.buyOnDate === "string"
          ? item.buyOnDate
          : formatDateOnly(item.buyOnDate)
        : null,
      sourceType: item.sourceType,
    });
  }

  return formatCompactShoppingSourceLine({
    sourceType: item.sourceType,
  });
}

function parseMealPlanShoppingItemSource(value: FormDataEntryValue | null) {
  if (
    value === ShoppingItemSource.GENERATED ||
    value === ShoppingItemSource.MANUAL
  ) {
    return value;
  }

  return null;
}

function getFamilyShoppingSourceBadge(item: SerializedProjectedShoppingItem) {
  if (item.sourceType === "FAMILY") {
    return {
      className:
        "rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-800",
      label: "Global",
    };
  }

  if (item.sourceType === "GENERATED") {
    return {
      className:
        "rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800",
      label: "Ukeplan",
    };
  }

  return {
    className:
      "rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700",
    label: "Ukeplan · Manuell",
  };
}

function getFamilyShoppingEmptyStateTitle(
  loaderData: Awaited<ReturnType<typeof loader>>,
) {
  if (
    loaderData.activeListMode === "COMBINED" &&
    loaderData.itemCounts.family === 0 &&
    loaderData.mealPlanItemCount > 0
  ) {
    return "Ingen faste varer akkurat nå";
  }

  if (
    loaderData.activeListMode === "COMBINED" &&
    loaderData.itemCounts.family > 0 &&
    loaderData.mealPlanItemCount === 0
  ) {
    return "Ingen varer fra dagens ukeplan";
  }

  return "Listen er tom";
}

function getFamilyShoppingEmptyStateDescription(
  loaderData: Awaited<ReturnType<typeof loader>>,
  isLg: boolean,
) {
  if (
    loaderData.activeListMode === "COMBINED" &&
    loaderData.itemCounts.family === 0 &&
    loaderData.mealPlanItemCount > 0
  ) {
    return "Familiens faste liste er tom, men dagens ukeplan har varer. Bytt til kombinert visning for å se dem her.";
  }

  if (
    loaderData.activeListMode === "COMBINED" &&
    loaderData.itemCounts.family > 0 &&
    loaderData.mealPlanItemCount === 0
  ) {
    return "Du har faste varer på listen, men dagens ukeplan har ingen handlelinjer ennå.";
  }

  return isLg
    ? "Legg til den første varen med skjemaet over."
    : "Legg til den første varen med feltet nederst.";
}

function renderFamilyShoppingListItem({
  actionData,
  categories,
  familyId,
  item,
  navigation,
  pendingIntent,
  pendingSourceKey,
  recentlyAddedSourceKey,
  stores,
  todayMealPlanId,
}: {
  actionData?: FamilyShoppingActionData;
  categories: Awaited<ReturnType<typeof loader>>["categories"];
  familyId: string;
  item: SerializedProjectedShoppingItem;
  navigation: ReturnType<typeof useNavigation>;
  pendingIntent: FormDataEntryValue | null | undefined;
  pendingSourceKey: string | null;
  recentlyAddedSourceKey: string | null;
  stores: Awaited<ReturnType<typeof loader>>["stores"];
  todayMealPlanId: string | null;
}) {
  const sourceBadge = getFamilyShoppingSourceBadge(item);
  const isPendingCheckToggle =
    navigation.state !== "idle" &&
    ((pendingIntent === "toggle-family-shopping-item-checked" &&
      item.sourceType === "FAMILY") ||
      (pendingIntent === "toggle-meal-plan-shopping-item-checked" &&
        item.sourceType !== "FAMILY")) &&
    pendingSourceKey === item.sourceKey;
  const displayChecked = getOptimisticChecked({
    checkedValue: navigation.formData?.get("checked"),
    isPending: isPendingCheckToggle,
    itemChecked: item.checked,
  });
  const isPendingFamilySave =
    navigation.state !== "idle" &&
    pendingIntent === "update-family-shopping-item" &&
    pendingSourceKey === item.sourceKey;
  const isPendingFamilyDelete =
    navigation.state !== "idle" &&
    pendingIntent === "delete-family-shopping-item" &&
    pendingSourceKey === item.sourceKey;
  const familyValues =
    actionData?.intent === "update-family-shopping-item" &&
    actionData.itemTarget?.sourceKey === item.sourceKey &&
    actionData.familyValues
      ? actionData.familyValues
      : item.sourceType === "FAMILY"
        ? {
            categoryId: item.category.id,
            name: item.name,
            note: item.note ?? "",
            preferredStoreId: item.preferredStore?.id ?? "",
            quantity: item.quantity ?? "",
          }
        : null;
  const rowStateClass =
    recentlyAddedSourceKey === item.sourceKey
      ? "border-emerald-300 bg-emerald-100"
      : displayChecked
        ? "border-slate-200 bg-slate-100 opacity-80"
        : "border-slate-200 bg-slate-50";

  return (
    <article
      key={item.sourceKey}
      className={`scroll-mb-44 rounded-[24px] border p-4 transition-colors duration-250 ${rowStateClass}`}
      data-shopping-source-key={item.sourceKey}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h4
          className={`text-base font-semibold ${
            displayChecked ? "text-slate-500 line-through" : "text-slate-950"
          }`}
        >
          {item.name}
        </h4>
        {formatGeneratedQuantityBadge(item) ? (
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
            {formatGeneratedQuantityBadge(item)}
          </span>
        ) : null}
        <span className={sourceBadge.className}>{sourceBadge.label}</span>
      </div>
      {formatCompactShoppingSourceLineForItem(item) ? (
        <p className="mt-2 text-xs text-slate-600">
          {formatCompactShoppingSourceLineForItem(item)}
        </p>
      ) : null}
      {item.sourceType === "GENERATED" ? (
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {formatGeneratedItemSummary({
            firstDate:
              typeof item.firstDate === "string"
                ? item.firstDate
                : formatDateOnly(item.firstDate),
            lastDate:
              typeof item.lastDate === "string"
                ? item.lastDate
                : formatDateOnly(item.lastDate),
            occurrenceCount: item.occurrenceCount,
            occurrences: item.occurrences.map((occurrence) => ({
              date:
                typeof occurrence.date === "string"
                  ? occurrence.date
                  : formatDateOnly(occurrence.date),
              recipeTitle: occurrence.recipeTitle,
            })),
            sourceType: item.sourceType,
          })}
        </p>
      ) : null}
      {item.sourceType === "FAMILY" ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-800">
            Detaljer
          </summary>
          <div className="mt-4">
            <ShoppingListItemExpanded
              actionData={actionData}
              categories={categories}
              displayChecked={displayChecked}
              familyValues={familyValues}
              isPendingCheckToggle={isPendingCheckToggle}
              isPendingFamilyDelete={isPendingFamilyDelete}
              isPendingFamilySave={isPendingFamilySave}
              isPendingGeneratedExclude={false}
              isPendingGeneratedSave={false}
              isPendingManualDelete={false}
              isPendingManualSave={false}
              item={item}
              manualValues={null}
              overrideValues={null}
              stores={stores}
              toggleExpectedVersion={getToggleExpectedVersion(item)}
            />
          </div>
        </details>
      ) : todayMealPlanId ? (
        <Form className="mt-4" method="post">
          <input
            name="intent"
            type="hidden"
            value="toggle-meal-plan-shopping-item-checked"
          />
          <input name="mealPlanId" type="hidden" value={todayMealPlanId} />
          <input name="sourceKey" type="hidden" value={item.sourceKey} />
          <input name="sourceType" type="hidden" value={item.sourceType} />
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
            className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
            disabled={isPendingCheckToggle}
            type="submit"
          >
            {isPendingCheckToggle
              ? displayChecked
                ? "Krysser av..."
                : "Oppdaterer..."
              : displayChecked
                ? "Fjern avkryssing"
                : "Marker som kjøpt"}
          </button>
          <p className="mt-3 text-xs text-slate-500">
            <Link
              className="font-medium text-emerald-700 underline"
              to={`/families/${familyId}/meal-plans/${todayMealPlanId}/shopping`}
            >
              Åpne full handleliste for ukeplanen
            </Link>{" "}
            for redigering av detaljer.
          </p>
        </Form>
      ) : null}
    </article>
  );
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
    case "family-shopping-list-mode-updated":
      return {
        description: "Visningsmodus for handlelisten er lagret.",
        title: "Visning oppdatert",
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
