import { ShoppingItemSource } from "@prisma/client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Form,
  Link,
  isRouteErrorResponse,
  useFetcher,
  useNavigation,
  useRevalidator,
  type MetaFunction,
} from "react-router";

import { requireUser } from "../lib/auth.server";
import {
  formatCompactShoppingSourceLine,
  formatGeneratedItemSummary,
  formatGeneratedQuantityBadge,
} from "../lib/shopping-display";
import { ManualShoppingQuickAdd } from "../components/manual-shopping-quick-add";
import {
  ShoppingDateSelect,
  ShoppingListItemExpanded,
} from "../components/shopping-list-item-expanded";
import { ShoppingQuantityEditModal } from "../components/shopping-quantity-edit-modal";
import { getToggleExpectedVersion } from "../lib/shopping-store-mode-client";
import {
  insertProjectedItemIntoStoreGroups,
  prependRecentManualItem,
} from "../lib/shopping-list-client";
import type { QuickAddShoppingSuccess } from "../lib/shopping-quick-add";
import { serializeProjectedShoppingItem } from "../lib/shopping-serialize";
import {
  getMealPlanShoppingData,
  listRecentManualShoppingItemsForFamily,
  type RecentManualShoppingItem,
} from "../lib/shopping.server";
import { toggleFamilyShoppingItemChecked } from "../lib/family-shopping-write.server";
import {
  createManualShoppingItem,
  createQuickManualShoppingItem,
  deleteManualShoppingItem,
  excludeGeneratedShoppingItem,
  optInStockShoppingItems,
  restoreGeneratedShoppingItem,
  toggleShoppingItemChecked,
  updateGeneratedShoppingItemOverride,
  updateGeneratedShoppingItemQuantity,
  updateManualShoppingItem,
  type GeneratedShoppingItemOverrideFieldErrors,
  type GeneratedShoppingItemOverrideValues,
  type ManualShoppingItemFieldErrors,
  type ManualShoppingItemValues,
} from "../lib/shopping-write.server";
import { useDebouncedRevalidate } from "../lib/use-debounced-revalidate";

type ShoppingNotice =
  | "generated-shopping-item-excluded"
  | "generated-shopping-item-restored"
  | "generated-shopping-item-updated"
  | "manual-shopping-item-added"
  | "manual-shopping-item-deleted"
  | "manual-shopping-item-updated"
  | "shopping-item-check-state-updated"
  | "stock-shopping-items-opted-in";

type ShoppingIntent =
  | "add-manual-shopping-item"
  | "quick-add-manual-shopping-item"
  | "delete-manual-shopping-item"
  | "exclude-generated-shopping-item"
  | "opt-in-stock-shopping-item"
  | "restore-generated-shopping-item"
  | "opt-in-stock-shopping-items"
  | "toggle-family-shopping-item-checked"
  | "toggle-shopping-item-checked"
  | "update-generated-shopping-item"
  | "update-generated-shopping-item-quantity"
  | "update-manual-shopping-item";

interface ShoppingActionData {
  formError?: string;
  generatedOverrideFieldErrors?: GeneratedShoppingItemOverrideFieldErrors;
  intent?: ShoppingIntent;
  item?: QuickAddShoppingSuccess["item"];
  itemTarget?: {
    sourceKey: string;
    sourceType: ShoppingItemSource;
  };
  manualFieldErrors?: ManualShoppingItemFieldErrors;
  manualValues?: ManualShoppingItemValues;
  ok?: true;
  overrideValues?: GeneratedShoppingItemOverrideValues;
  recentManualItem?: RecentManualShoppingItem;
}

interface FamilyMealPlanShoppingRouteProps {
  actionData?: ShoppingActionData;
  loaderData: Awaited<ReturnType<typeof loader>>;
}

const defaultManualShoppingItemValues: ManualShoppingItemValues = {
  buyOnDate: "",
  categoryId: "",
  name: "",
  note: "",
  preferredStoreId: "",
  quantity: "",
};

export const meta: MetaFunction = () => {
  return [
    { title: "Handleliste | Mealplanner" },
    {
      name: "description",
      content:
        "Handleliste med genererte og manuelle varelinjer for valgt ukeplan.",
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
    getMealPlanShoppingData({
      familyId,
      mealPlanId,
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
    excludedGeneratedCount: result.excludedGeneratedCount,
    excludedGeneratedItems: result.excludedGeneratedItems.map(
      serializeProjectedShoppingItem,
    ),
    notice: getShoppingNotice(request),
    recentManualItems,
    familyStoreGroups: result.familyStoreGroups.map((group) => ({
      sections: group.sections.map((section) => ({
        ...section,
        items: section.items.map(serializeProjectedShoppingItem),
      })),
      store: group.store,
    })),
    storeGroups: result.storeGroups.map((group) => ({
      sections: group.sections.map((section) => ({
        ...section,
        items: section.items.map(serializeProjectedShoppingItem),
      })),
      store: group.store,
    })),
    stockIngredientCount: result.stockIngredientCount,
    stockIngredientsForPlan: result.stockIngredientsForPlan.map(
      (ingredient) => ({
        ...ingredient,
        occurrences: ingredient.occurrences.map((occurrence) => ({
          ...occurrence,
          date: formatDateOnly(occurrence.date),
        })),
      }),
    ),
    stores: result.stores,
    userRole: result.userRole,
    selectableShoppingDates: result.selectableShoppingDates,
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

  if (intent === "add-manual-shopping-item") {
    const result = await createManualShoppingItem({
      familyId,
      mealPlanId,
      userId: user.id,
      values: parseManualShoppingItemValues(formData),
    });

    if (result.status === "NOT_FOUND") {
      throw buildMealPlanNotFoundResponse();
    }

    if (result.status === "VALIDATION_ERROR") {
      return {
        intent,
        manualFieldErrors: result.fieldErrors,
        manualValues: result.values,
      } satisfies ShoppingActionData;
    }

    return buildShoppingRedirect({
      familyId,
      mealPlanId,
      notice: "manual-shopping-item-added",
      request,
    });
  }

  if (intent === "quick-add-manual-shopping-item") {
    const result = await createQuickManualShoppingItem({
      familyId,
      input: parseQuickAddManualShoppingItemInput(formData),
      mealPlanId,
      userId: user.id,
    });

    if (result.status === "NOT_FOUND") {
      throw buildMealPlanNotFoundResponse();
    }

    if (result.status === "VALIDATION_ERROR") {
      return {
        formError: "formError" in result ? result.formError : undefined,
        intent,
        manualFieldErrors: result.fieldErrors,
        manualValues: result.values,
      } satisfies ShoppingActionData;
    }

    return {
      intent,
      item: serializeProjectedShoppingItem(result.item),
      ok: true,
      recentManualItem: result.recentManualItem,
    } satisfies ShoppingActionData;
  }

  if (intent === "update-manual-shopping-item") {
    const manualItemId = String(formData.get("manualItemId") ?? "").trim();
    const result = await updateManualShoppingItem({
      expectedUpdatedAt: parseExpectedUpdatedAt(formData),
      familyId,
      manualItemId,
      mealPlanId,
      userId: user.id,
      values: parseManualShoppingItemValues(formData),
    });

    if (result.status === "NOT_FOUND") {
      throw buildMealPlanNotFoundResponse();
    }

    if (result.status === "CONFLICT") {
      return {
        formError: result.formError,
        intent,
      } satisfies ShoppingActionData;
    }

    if (result.status === "VALIDATION_ERROR") {
      return {
        intent,
        itemTarget: {
          sourceKey: manualItemId,
          sourceType: ShoppingItemSource.MANUAL,
        },
        manualFieldErrors: result.fieldErrors,
        manualValues: result.values,
      } satisfies ShoppingActionData;
    }

    return buildShoppingRedirect({
      familyId,
      mealPlanId,
      notice: "manual-shopping-item-updated",
      request,
    });
  }

  if (intent === "delete-manual-shopping-item") {
    const manualItemId = String(formData.get("manualItemId") ?? "").trim();
    const result = await deleteManualShoppingItem({
      expectedUpdatedAt: parseExpectedUpdatedAt(formData),
      familyId,
      manualItemId,
      mealPlanId,
      userId: user.id,
    });

    if (result.status === "NOT_FOUND") {
      throw buildMealPlanNotFoundResponse();
    }

    if (result.status === "CONFLICT") {
      return {
        formError: result.formError,
        intent,
      } satisfies ShoppingActionData;
    }

    return buildShoppingRedirect({
      familyId,
      mealPlanId,
      notice: "manual-shopping-item-deleted",
      request,
    });
  }

  if (intent === "exclude-generated-shopping-item") {
    const sourceKey = String(formData.get("sourceKey") ?? "").trim();

    if (!sourceKey) {
      return {
        formError: "Vi fant ikke handlelinjen som skulle fjernes.",
        intent,
      } satisfies ShoppingActionData;
    }

    const result = await excludeGeneratedShoppingItem({
      expectedUpdatedAt: parseExpectedUpdatedAt(formData),
      familyId,
      mealPlanId,
      sourceKey,
      userId: user.id,
    });

    if (result.status === "NOT_FOUND") {
      throw buildMealPlanNotFoundResponse();
    }

    if (result.status === "CONFLICT") {
      return {
        formError: result.formError,
        intent,
      } satisfies ShoppingActionData;
    }

    return buildShoppingRedirect({
      familyId,
      mealPlanId,
      notice: "generated-shopping-item-excluded",
      request,
    });
  }

  if (intent === "restore-generated-shopping-item") {
    const sourceKey = String(formData.get("sourceKey") ?? "").trim();

    if (!sourceKey) {
      return {
        formError: "Vi fant ikke handlelinjen som skulle legges tilbake.",
        intent,
      } satisfies ShoppingActionData;
    }

    const result = await restoreGeneratedShoppingItem({
      expectedUpdatedAt: parseExpectedUpdatedAt(formData),
      familyId,
      mealPlanId,
      sourceKey,
      userId: user.id,
    });

    if (result.status === "NOT_FOUND") {
      throw buildMealPlanNotFoundResponse();
    }

    if (result.status === "NOT_EXCLUDED") {
      return {
        formError: result.formError,
        intent,
      } satisfies ShoppingActionData;
    }

    if (result.status === "CONFLICT") {
      return {
        formError: result.formError,
        intent,
      } satisfies ShoppingActionData;
    }

    return buildShoppingRedirect({
      familyId,
      mealPlanId,
      notice: "generated-shopping-item-restored",
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
      } satisfies ShoppingActionData;
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
        formError: "Vi fant ikke handlelinjen som skulle oppdateres.",
        intent,
        itemTarget: {
          sourceKey: familyItemId,
          sourceType: ShoppingItemSource.MANUAL,
        },
      } satisfies ShoppingActionData;
    }

    if (result.status === "CONFLICT") {
      return {
        formError: result.formError,
        intent,
        itemTarget: {
          sourceKey: familyItemId,
          sourceType: ShoppingItemSource.MANUAL,
        },
      } satisfies ShoppingActionData;
    }

    return buildShoppingRedirect({
      familyId,
      mealPlanId,
      notice: "shopping-item-check-state-updated",
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
      } satisfies ShoppingActionData;
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
      throw buildMealPlanNotFoundResponse();
    }

    if (result.status === "CONFLICT") {
      return {
        formError: result.formError,
        intent,
      } satisfies ShoppingActionData;
    }

    return buildShoppingRedirect({
      familyId,
      mealPlanId,
      notice: "shopping-item-check-state-updated",
      request,
    });
  }

  if (
    intent === "opt-in-stock-shopping-item" ||
    intent === "opt-in-stock-shopping-items"
  ) {
    const sourceKeys =
      intent === "opt-in-stock-shopping-items"
        ? formData.getAll("sourceKey").map((value) => String(value))
        : [String(formData.get("sourceKey") ?? "")];

    const result = await optInStockShoppingItems({
      familyId,
      mealPlanId,
      sourceKeys,
      userId: user.id,
    });

    if (result.status === "NOT_FOUND") {
      throw buildMealPlanNotFoundResponse();
    }

    if (result.status === "VALIDATION_ERROR") {
      return {
        formError: result.formError,
        intent,
      } satisfies ShoppingActionData;
    }

    return buildShoppingRedirect({
      familyId,
      mealPlanId,
      notice: "stock-shopping-items-opted-in",
      request,
    });
  }

  if (intent === "update-generated-shopping-item") {
    const sourceKey = String(formData.get("sourceKey") ?? "").trim();

    if (!sourceKey) {
      return {
        formError: "Vi fant ikke handlelinjen som skulle oppdateres.",
        intent,
      } satisfies ShoppingActionData;
    }

    const result = await updateGeneratedShoppingItemOverride({
      expectedUpdatedAt: parseExpectedUpdatedAt(formData),
      familyId,
      mealPlanId,
      sourceKey,
      userId: user.id,
      values: parseGeneratedShoppingItemOverrideValues(formData),
    });

    if (result.status === "NOT_FOUND") {
      throw buildMealPlanNotFoundResponse();
    }

    if (result.status === "CONFLICT") {
      return {
        formError: result.formError,
        intent,
      } satisfies ShoppingActionData;
    }

    if (result.status === "VALIDATION_ERROR") {
      return {
        generatedOverrideFieldErrors: result.fieldErrors,
        intent,
        itemTarget: {
          sourceKey,
          sourceType: ShoppingItemSource.GENERATED,
        },
        overrideValues: result.values,
      } satisfies ShoppingActionData;
    }

    return buildShoppingRedirect({
      familyId,
      mealPlanId,
      notice: "generated-shopping-item-updated",
      request,
    });
  }

  if (intent === "update-generated-shopping-item-quantity") {
    const sourceKey = String(formData.get("sourceKey") ?? "").trim();

    if (!sourceKey) {
      return {
        formError: "Vi fant ikke handlelinjen som skulle oppdateres.",
        intent,
      } satisfies ShoppingActionData;
    }

    const result = await updateGeneratedShoppingItemQuantity({
      expectedUpdatedAt: parseExpectedUpdatedAt(formData),
      familyId,
      mealPlanId,
      quantity: String(formData.get("quantity") ?? ""),
      sourceKey,
      userId: user.id,
    });

    if (result.status === "NOT_FOUND") {
      throw buildMealPlanNotFoundResponse();
    }

    if (result.status === "CONFLICT") {
      return {
        formError: result.formError,
        intent,
      } satisfies ShoppingActionData;
    }

    return {
      intent,
      ok: true,
    } satisfies ShoppingActionData;
  }

  return {
    formError: "Ukjent handling.",
  } satisfies ShoppingActionData;
}

export default function FamilyMealPlanShoppingRoute({
  actionData,
  loaderData,
}: FamilyMealPlanShoppingRouteProps) {
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const scheduleRevalidate = useDebouncedRevalidate(revalidator.revalidate);
  const quantityFetcher = useFetcher<ShoppingActionData>();
  const pendingIntent = navigation.formData?.get("intent");
  const pendingSourceKey = getPendingSourceKey(navigation.formData);
  const [storeGroups, setStoreGroups] = useState(loaderData.storeGroups);
  const [recentManualItems, setRecentManualItems] = useState(
    loaderData.recentManualItems,
  );
  const [quantityEditItem, setQuantityEditItem] = useState<{
    collaborationVersion: string;
    name: string;
    quantity: string;
    sourceKey: string;
  } | null>(null);
  const [quantityDraft, setQuantityDraft] = useState("");
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const addManualValues =
    actionData?.intent === "add-manual-shopping-item" && actionData.manualValues
      ? actionData.manualValues
      : defaultManualShoppingItemValues;
  const ingredientSearchPath = `/families/${loaderData.family.id}/meal-plans/${loaderData.mealPlan.id}/shopping/ingredient-search`;
  const noticeContent = loaderData.notice
    ? getShoppingNoticeContent(loaderData.notice)
    : null;

  useEffect(() => {
    setStoreGroups(loaderData.storeGroups);
    setRecentManualItems(loaderData.recentManualItems);
  }, [loaderData.recentManualItems, loaderData.storeGroups]);

  const handleQuickAddSuccess = useCallback(
    (payload: QuickAddShoppingSuccess) => {
      setStoreGroups((currentGroups) =>
        insertProjectedItemIntoStoreGroups(currentGroups, payload.item),
      );
      setRecentManualItems((currentRecents) =>
        prependRecentManualItem(currentRecents, payload.recentManualItem),
      );
      scheduleRevalidate();
    },
    [scheduleRevalidate],
  );

  const closeQuantityEdit = useCallback(() => {
    setQuantityEditItem(null);
  }, []);

  const submitGeneratedQuantity = useCallback(
    (item: { collaborationVersion: string; sourceKey: string }, quantity: string) => {
      const formData = new FormData();
      formData.set("intent", "update-generated-shopping-item-quantity");
      formData.set("sourceKey", item.sourceKey);
      formData.set("expectedUpdatedAt", item.collaborationVersion);
      formData.set("quantity", quantity);
      quantityFetcher.submit(formData, { method: "post" });
      closeQuantityEdit();
    },
    [closeQuantityEdit, quantityFetcher],
  );

  useEffect(() => {
    if (!quantityEditItem) {
      return;
    }

    quantityInputRef.current?.focus();
    quantityInputRef.current?.select();
  }, [quantityEditItem]);

  useEffect(() => {
    if (
      quantityFetcher.state !== "idle" ||
      quantityFetcher.data?.intent !==
        "update-generated-shopping-item-quantity" ||
      !quantityFetcher.data.ok
    ) {
      return;
    }

    scheduleRevalidate();
  }, [quantityFetcher.data, quantityFetcher.state, scheduleRevalidate]);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="rounded-[32px] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">
                Handleliste
              </span>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight">
                {loaderData.mealPlan.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Handlelisten kombinerer deterministisk genererte ingredienser
                fra ukeplanen med manuelle varelinjer. Avkryssing, notater,
                handledato og butikkvalg lagres på serveren.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-600"
                to={`/families/${loaderData.family.id}/store-mode`}
              >
                Åpne butikkmodus
              </Link>
              <Link
                className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/15"
                to={`/families/${loaderData.family.id}/meal-plans/${loaderData.mealPlan.id}`}
              >
                Tilbake til ukeplan
              </Link>
              <Link
                className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/15"
                to={`/families/${loaderData.family.id}/meal-plans`}
              >
                Alle ukeplaner
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
              Kunne ikke oppdatere handlelisten
            </h2>
            <p className="mt-2 text-sm leading-6">{actionData.formError}</p>
          </section>
        ) : null}

        {loaderData.stockIngredientCount > 0 ? (
          <section className="rounded-[28px] border border-amber-200 bg-amber-50 px-6 py-5 text-amber-950 shadow-sm">
            <details>
              <summary className="cursor-pointer text-base font-semibold">
                {loaderData.stockIngredientCount} basisvarer brukt denne uken
              </summary>
              <div className="mt-4 space-y-4">
                <p className="text-sm leading-6 text-amber-900">
                  Disse varene er vanligvis på lager og vises ikke i
                  handlelisten med mindre du legger dem til for denne uken.
                </p>
                <Form className="flex flex-wrap gap-3" method="post">
                  <input
                    name="intent"
                    type="hidden"
                    value="opt-in-stock-shopping-items"
                  />
                  {loaderData.stockIngredientsForPlan.map((ingredient) => (
                    <input
                      key={ingredient.sourceKey}
                      name="sourceKey"
                      type="hidden"
                      value={ingredient.sourceKey}
                    />
                  ))}
                  <button
                    className="rounded-2xl bg-amber-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-950 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={
                      navigation.state === "submitting" &&
                      pendingIntent === "opt-in-stock-shopping-items"
                    }
                    type="submit"
                  >
                    Legg til alle i handlelisten
                  </button>
                </Form>
                <ul className="grid gap-3">
                  {loaderData.stockIngredientsForPlan.map((ingredient) => (
                    <li
                      key={ingredient.sourceKey}
                      className="rounded-[20px] border border-amber-200 bg-white px-4 py-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            {ingredient.name}
                            {ingredient.quantityLabel
                              ? ` · ${ingredient.quantityLabel}`
                              : ""}
                          </p>
                          {ingredient.occurrenceCount > 1 ? (
                            <ul className="mt-1 space-y-1 text-xs leading-5 text-slate-600">
                              {ingredient.occurrences.map((occurrence) => (
                                <li
                                  key={`${occurrence.mealPlanEntryId}:${occurrence.recipeIngredientId}`}
                                >
                                  {occurrence.recipeTitle}
                                  {occurrence.quantityLabel
                                    ? ` · ${occurrence.quantityLabel}`
                                    : ""}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                              {`Brukt i ${ingredient.occurrences[0]?.recipeTitle ?? "oppskrift"}`}
                              {ingredient.occurrences[0]?.date
                                ? ` · ${formatDateLabel(ingredient.occurrences[0].date)}`
                                : ""}
                              {ingredient.occurrences[0]?.quantityLabel
                                ? ` · ${ingredient.occurrences[0].quantityLabel}`
                                : ""}
                            </p>
                          )}
                        </div>
                        <Form method="post">
                          <input
                            name="intent"
                            type="hidden"
                            value="opt-in-stock-shopping-item"
                          />
                          <input
                            name="sourceKey"
                            type="hidden"
                            value={ingredient.sourceKey}
                          />
                          <button
                            className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={
                              navigation.state === "submitting" &&
                              pendingIntent === "opt-in-stock-shopping-item" &&
                              navigation.formData?.get("sourceKey") ===
                                ingredient.sourceKey
                            }
                            type="submit"
                          >
                            Legg til i handlelisten
                          </button>
                        </Form>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </section>
        ) : null}

        {loaderData.excludedGeneratedCount > 0 ? (
          <section className="rounded-[28px] border border-slate-200 bg-slate-50 px-6 py-5 text-slate-950 shadow-sm">
            <details open>
              <summary className="cursor-pointer text-base font-semibold">
                {loaderData.excludedGeneratedCount} varelinjer fjernet fra
                listen
              </summary>
              <div className="mt-4 space-y-4">
                <p className="text-sm leading-6 text-slate-600">
                  Disse varene er skjult fra handlelisten, men ligger fortsatt i
                  ukeplanen. Du kan legge dem tilbake når du trenger dem.
                </p>
                <ul className="grid gap-3">
                  {loaderData.excludedGeneratedItems.map((item) => {
                    const isPendingRestore =
                      navigation.state === "submitting" &&
                      pendingIntent === "restore-generated-shopping-item" &&
                      pendingSourceKey === item.sourceKey;

                    return (
                      <li
                        key={item.sourceKey}
                        className="rounded-[20px] border border-slate-200 bg-white px-4 py-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">
                              {item.name}
                              {item.quantityLabel
                                ? ` · ${item.quantityLabel}`
                                : ""}
                            </p>
                            {item.sourceType === "GENERATED" ? (
                              <p className="mt-1 text-xs leading-5 text-slate-600">
                                {item.occurrenceCount === 1
                                  ? `Fra ${item.occurrences[0]?.recipeTitle}`
                                  : `Fra ${item.occurrenceCount} planlagte middager`}
                              </p>
                            ) : null}
                          </div>
                          <Form method="post">
                            <input
                              name="intent"
                              type="hidden"
                              value="restore-generated-shopping-item"
                            />
                            <input
                              name="sourceKey"
                              type="hidden"
                              value={item.sourceKey}
                            />
                            <input
                              name="expectedUpdatedAt"
                              type="hidden"
                              value={item.collaborationVersion}
                            />
                            <button
                              className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={isPendingRestore}
                              type="submit"
                            >
                              {isPendingRestore
                                ? "Legger tilbake..."
                                : "Legg tilbake i handlelisten"}
                            </button>
                          </Form>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </details>
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-950">Oversikt</h2>
              <p className="text-sm leading-6 text-slate-600">
                Listen dekker perioden{" "}
                {formatMealPlanWindow(
                  loaderData.mealPlan.startDate,
                  loaderData.mealPlan.endDate,
                )}{" "}
                og inneholder {loaderData.itemCounts.total} varelinjer totalt.
              </p>
            </div>

            <dl className="mt-6 grid gap-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <dt className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                  Status
                </dt>
                <dd className="mt-2 text-base font-semibold text-slate-950">
                  {loaderData.mealPlan.status === "APPROVED"
                    ? "Godkjent"
                    : "Utkast"}
                </dd>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <dt className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                  Varelinjer
                </dt>
                <dd className="mt-2 text-sm leading-6 text-slate-700">
                  {loaderData.itemCounts.generated} genererte og{" "}
                  {loaderData.itemCounts.manual} manuelle linjer.
                </dd>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <dt className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                  Synlige datoer
                </dt>
                <dd className="mt-2 text-sm leading-6 text-slate-700">
                  {loaderData.visibleDates.map(formatDateLabel).join(", ")}
                </dd>
              </div>
            </dl>
          </article>

          <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-950">
                Legg til manuell varelinje
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                Bruk dette for varer som ikke kommer direkte fra oppskriftene,
                men som skal med i samme handleliste og sortering.
              </p>
            </div>

            {actionData?.intent === "add-manual-shopping-item" &&
            actionData.manualFieldErrors?.name ? (
              <p className="mt-2 text-sm text-rose-600">
                {actionData.manualFieldErrors.name}
              </p>
            ) : null}

            <div className="mt-6">
              <ManualShoppingQuickAdd
                ingredientSearchPath={ingredientSearchPath}
                onQuickAddSuccess={handleQuickAddSuccess}
                recentManualItems={recentManualItems}
              />
            </div>

            <details className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-800">
                Avansert: legg til med alle felt
              </summary>

              <Form className="mt-4 space-y-4" method="post">
                <input
                  name="intent"
                  type="hidden"
                  value="add-manual-shopping-item"
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Varenavn
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      defaultValue={addManualValues.name}
                      name="name"
                      type="text"
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Mengde
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      defaultValue={addManualValues.quantity}
                      name="quantity"
                      placeholder="F.eks. 2 poser"
                      type="text"
                    />
                  </label>
                </div>

                {actionData?.intent === "add-manual-shopping-item" &&
                actionData.manualFieldErrors?.name ? (
                  <p className="text-sm text-rose-600">
                    {actionData.manualFieldErrors.name}
                  </p>
                ) : null}

                <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
                  <label className="block min-w-0 text-sm font-medium text-slate-700">
                    Kategori
                    <select
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      defaultValue={addManualValues.categoryId}
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

                  <label className="block min-w-0 text-sm font-medium text-slate-700">
                    Foretrukket butikk
                    <select
                      className="mt-2 box-border w-full max-w-full min-w-0 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      defaultValue={addManualValues.preferredStoreId}
                      name="preferredStoreId"
                    >
                      <option value="">Ingen valgt butikk</option>
                      {loaderData.stores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block min-w-0 text-sm font-medium text-slate-700">
                    Handledato
                    <ShoppingDateSelect
                      defaultValue={addManualValues.buyOnDate}
                      emptyOptionLabel="Ingen handledato"
                      name="buyOnDate"
                      selectableShoppingDates={loaderData.selectableShoppingDates}
                    />
                  </label>
                </div>

                {actionData?.intent === "add-manual-shopping-item" &&
                actionData.manualFieldErrors?.categoryId ? (
                  <p className="text-sm text-rose-600">
                    {actionData.manualFieldErrors.categoryId}
                  </p>
                ) : null}
                {actionData?.intent === "add-manual-shopping-item" &&
                actionData.manualFieldErrors?.preferredStoreId ? (
                  <p className="text-sm text-rose-600">
                    {actionData.manualFieldErrors.preferredStoreId}
                  </p>
                ) : null}
                {actionData?.intent === "add-manual-shopping-item" &&
                actionData.manualFieldErrors?.buyOnDate ? (
                  <p className="text-sm text-rose-600">
                    {actionData.manualFieldErrors.buyOnDate}
                  </p>
                ) : null}

                <label className="block text-sm font-medium text-slate-700">
                  Notat
                  <textarea
                    className="mt-2 min-h-28 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    defaultValue={addManualValues.note}
                    name="note"
                    placeholder="F.eks. husk kampanjepris eller at varen skal kjøpes senere i uken"
                  />
                </label>

                <button
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={
                    navigation.state === "submitting" &&
                    pendingIntent === "add-manual-shopping-item"
                  }
                  type="submit"
                >
                  {navigation.state === "submitting" &&
                  pendingIntent === "add-manual-shopping-item"
                    ? "Legger til..."
                    : "Legg til varelinje"}
                </button>
              </Form>
            </details>
          </article>
        </section>

        {loaderData.familyStoreGroups.length ? (
          <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-violet-200">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-950">
                Alltid på listen
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                Faste varer som følger familien på tvers av ukeplaner. Rediger
                listen på{" "}
                <Link
                  className="font-medium text-emerald-700 underline"
                  to={`/families/${loaderData.family.id}/shopping`}
                >
                  familiens handleliste
                </Link>
                .
              </p>
            </div>
            <div className="mt-6 grid gap-5">
              {loaderData.familyStoreGroups.map((group) => (
                <div key={`family:${group.store?.id ?? "no-store"}`}>
                  <h3 className="text-sm font-semibold text-slate-800">
                    {group.store?.name ?? "Ingen valgt butikk"}
                  </h3>
                  <div className="mt-3 grid gap-2">
                    {group.sections.flatMap((section) =>
                      section.items.map((item) => {
                        const isPendingCheckToggle =
                          navigation.state === "submitting" &&
                          pendingIntent ===
                            "toggle-family-shopping-item-checked" &&
                          pendingSourceKey === item.sourceKey;

                        return (
                          <article
                            key={`family:${item.sourceKey}`}
                            className="rounded-[20px] border border-violet-100 bg-violet-50/60 px-4 py-4"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-slate-950">
                                  {item.name}
                                  {item.quantityLabel
                                    ? ` · ${item.quantityLabel}`
                                    : ""}
                                </p>
                                <p className="mt-1 text-xs text-violet-800">
                                  Alltid på listen
                                </p>
                              </div>
                              <Form method="post">
                                <input
                                  name="intent"
                                  type="hidden"
                                  value="toggle-family-shopping-item-checked"
                                />
                                <input
                                  name="sourceKey"
                                  type="hidden"
                                  value={item.sourceKey}
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
                                  className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
                                  disabled={isPendingCheckToggle}
                                  type="submit"
                                >
                                  {isPendingCheckToggle
                                    ? "Oppdaterer..."
                                    : item.checked
                                      ? "Fjern avkryssing"
                                      : "Marker som kjøpt"}
                                </button>
                              </Form>
                            </div>
                          </article>
                        );
                      }),
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {storeGroups.length ? (
          <section className="grid gap-6">
            {storeGroups.map((group) => (
              <article
                key={group.store?.id ?? "no-store"}
                className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200"
              >
                <div className="flex flex-col gap-2">
                  <h2 className="text-lg font-semibold text-slate-950">
                    {group.store?.name ?? "Ingen valgt butikk"}
                  </h2>
                  <p className="text-sm leading-6 text-slate-600">
                    {group.store
                      ? "Varene er sortert etter butikkens seksjoner der de finnes."
                      : "Disse varene har ingen foretrukket butikk ennå."}
                  </p>
                </div>

                <div className="mt-6 grid gap-5">
                  {group.sections.map((section) => (
                    <section
                      key={`${group.store?.id ?? "no-store"}:${section.category.id}`}
                    >
                      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                        {section.displayName}
                      </h3>

                      <div className="mt-3 grid gap-2 xl:gap-3">
                        {section.items.map((item) => {
                          const isPendingCheckToggle =
                            navigation.state === "submitting" &&
                            pendingIntent === "toggle-shopping-item-checked" &&
                            pendingSourceKey === item.sourceKey;
                          const isPendingManualSave =
                            navigation.state === "submitting" &&
                            pendingIntent === "update-manual-shopping-item" &&
                            pendingSourceKey === item.sourceKey;
                          const isPendingManualDelete =
                            navigation.state === "submitting" &&
                            pendingIntent === "delete-manual-shopping-item" &&
                            pendingSourceKey === item.sourceKey;
                          const isPendingGeneratedSave =
                            navigation.state === "submitting" &&
                            pendingIntent ===
                              "update-generated-shopping-item" &&
                            pendingSourceKey === item.sourceKey;
                          const isPendingGeneratedExclude =
                            navigation.state === "submitting" &&
                            pendingIntent ===
                              "exclude-generated-shopping-item" &&
                            pendingSourceKey === item.sourceKey;
                          const manualValues =
                            actionData?.intent ===
                              "update-manual-shopping-item" &&
                            actionData.itemTarget?.sourceKey ===
                              item.sourceKey &&
                            actionData.manualValues
                              ? actionData.manualValues
                              : item.sourceType === "MANUAL"
                                ? {
                                    buyOnDate: item.buyOnDate ?? "",
                                    categoryId: item.category.id,
                                    name: item.name,
                                    note: item.note ?? "",
                                    preferredStoreId:
                                      item.preferredStore?.id ?? "",
                                    quantity: item.quantity ?? "",
                                  }
                                : null;
                          const overrideValues =
                            actionData?.intent ===
                              "update-generated-shopping-item" &&
                            actionData.itemTarget?.sourceKey ===
                              item.sourceKey &&
                            actionData.overrideValues
                              ? actionData.overrideValues
                              : item.sourceType === "GENERATED"
                                ? {
                                    note: item.note ?? "",
                                    postponedUntilDate:
                                      item.postponedUntilDate ?? "",
                                    preferredStoreId:
                                      item.preferredStore?.id ?? "",
                                    quantity: item.quantity ?? "",
                                  }
                                : null;
                          const quantityBadge =
                            formatGeneratedQuantityBadge(item);
                          const compactSourceLine =
                            formatCompactShoppingSourceLine(item);
                          const shouldAutoOpenDetails =
                            shouldAutoOpenShoppingItemDetails(
                              actionData,
                              item.sourceKey,
                            );
                          const expandedProps = {
                            actionData,
                            categories: loaderData.categories,
                            isPendingCheckToggle,
                            isPendingGeneratedExclude,
                            isPendingGeneratedSave,
                            isPendingManualDelete,
                            isPendingManualSave,
                            item,
                            manualValues,
                            overrideValues,
                            selectableShoppingDates:
                              loaderData.selectableShoppingDates,
                            stores: loaderData.stores,
                            toggleExpectedVersion:
                              getToggleExpectedVersion(item),
                          };

                          return (
                            <article
                              key={item.sourceKey}
                              className="min-w-0 max-w-full overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50 p-3 xl:p-5"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-base font-semibold text-slate-950">
                                  {item.name}
                                </h4>
                                {item.sourceType === "GENERATED" ? (
                                  <button
                                    className={
                                      quantityBadge &&
                                      !item.quantityLabel &&
                                      item.occurrenceCount > 1
                                        ? "rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 transition hover:bg-amber-200"
                                        : "rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
                                    }
                                    onClick={() => {
                                      setQuantityDraft(
                                        item.quantity ??
                                          item.quantityLabel ??
                                          "",
                                      );
                                      setQuantityEditItem({
                                        collaborationVersion:
                                          item.collaborationVersion,
                                        name: item.name,
                                        quantity: item.quantity ?? "",
                                        sourceKey: item.sourceKey,
                                      });
                                    }}
                                    type="button"
                                  >
                                    <span className="inline-flex items-center gap-1">
                                      {quantityBadge ?? "Sett mengde"}
                                      <QuantityEditIcon className="h-3 w-3 opacity-80" />
                                    </span>
                                  </button>
                                ) : quantityBadge ? (
                                  <span
                                    className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                                  >
                                    {quantityBadge}
                                  </span>
                                ) : null}
                                {item.sourceType === "GENERATED" &&
                                item.recipeCount > 1 ? (
                                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                                    {item.recipeCount} oppskrifter
                                  </span>
                                ) : null}
                                {item.sourceType === "GENERATED" &&
                                item.preferredStoreConflict ? (
                                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                                    Ulike foretrukne butikker
                                  </span>
                                ) : null}
                                {item.sourceType === "MANUAL" ? (
                                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
                                    Manuell
                                  </span>
                                ) : null}
                                {item.checked ? (
                                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                                    Avkrysset
                                  </span>
                                ) : null}
                                {item.sourceType === "GENERATED" &&
                                item.postponedUntilDate ? (
                                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                                    Utsatt til{" "}
                                    {formatDateLabel(item.postponedUntilDate)}
                                  </span>
                                ) : null}
                                {item.sourceType === "MANUAL" &&
                                item.buyOnDate ? (
                                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                                    Kjøpes {formatDateLabel(item.buyOnDate)}
                                  </span>
                                ) : null}
                                {item.note ? (
                                  <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
                                    Har notat
                                  </span>
                                ) : null}
                              </div>

                              {compactSourceLine ? (
                                <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600 xl:hidden">
                                  {compactSourceLine}
                                </p>
                              ) : null}

                              <details
                                className="group mt-2 min-w-0 xl:hidden"
                                open={shouldAutoOpenDetails}
                              >
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500 [&::-webkit-details-marker]:hidden">
                                  <span>Detaljer</span>
                                  <span className="text-xs text-slate-400 group-open:hidden">
                                    Åpne
                                  </span>
                                  <span className="hidden text-xs text-slate-400 group-open:inline">
                                    Lukk
                                  </span>
                                </summary>
                                <div className="mt-3 min-w-0 space-y-3 border-t border-slate-200 pt-3">
                                  <p className="text-sm leading-6 text-slate-600">
                                    {item.sourceType === "GENERATED"
                                      ? formatGeneratedItemSummary(item)
                                      : item.sourceType === "MANUAL" && item.buyOnDate
                                        ? `Lagt til manuelt og planlagt for ${formatDateLabel(item.buyOnDate)}.`
                                        : "Lagt til manuelt uten spesifikk handledato."}
                                  </p>
                                  {item.note ? (
                                    <p className="text-sm leading-6 text-slate-700">
                                      Notat: {item.note}
                                    </p>
                                  ) : null}
                                  <ShoppingListItemExpanded {...expandedProps} />
                                </div>
                              </details>

                              <div className="mt-4 hidden xl:block">
                                <p className="text-sm leading-6 text-slate-600">
                                  {item.sourceType === "GENERATED"
                                    ? formatGeneratedItemSummary(item)
                                    : item.sourceType === "MANUAL" && item.buyOnDate
                                      ? `Lagt til manuelt og planlagt for ${formatDateLabel(item.buyOnDate)}.`
                                      : "Lagt til manuelt uten spesifikk handledato."}
                                </p>
                                {item.note ? (
                                  <p className="mt-2 text-sm leading-6 text-slate-700">
                                    Notat: {item.note}
                                  </p>
                                ) : null}
                                <div className="mt-4">
                                  <ShoppingListItemExpanded {...expandedProps} />
                                </div>
                              </div>
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
              Ingen varer ennå
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Legg til middager i ukeplanen eller opprett en manuell varelinje
              for å starte handlelisten.
            </p>
          </section>
        )}
      </div>
      {quantityEditItem ? (
        <ShoppingQuantityEditModal
          canReset={Boolean(quantityEditItem.quantity.trim())}
          name={quantityEditItem.name}
          onCancel={closeQuantityEdit}
          onReset={() =>
            submitGeneratedQuantity(quantityEditItem, "")
          }
          onSave={() =>
            submitGeneratedQuantity(quantityEditItem, quantityDraft)
          }
          quantity={quantityDraft}
          quantityInputRef={quantityInputRef}
          setQuantity={setQuantityDraft}
        />
      ) : null}
    </main>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  let title = "Noe gikk galt";
  let description = "Vi klarte ikke å laste handlelisten.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 403) {
      title = "Ingen tilgang";
      description = "Du har ikke tilgang til denne familiehandlelisten.";
    } else if (error.status === 404) {
      title = "Handlelisten finnes ikke";
      description =
        "Vi fant ikke ukeplanen du forsøkte å hente handlelisten for.";
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <div className="mx-auto max-w-3xl rounded-[28px] bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
        <Link
          className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          to="/app"
        >
          Tilbake til oversikten
        </Link>
      </div>
    </main>
  );
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

function parseExpectedUpdatedAt(formData: FormData) {
  return String(formData.get("expectedUpdatedAt") ?? "");
}

function shouldAutoOpenShoppingItemDetails(
  actionData: ShoppingActionData | undefined,
  sourceKey: string,
) {
  if (!actionData?.itemTarget || actionData.itemTarget.sourceKey !== sourceKey) {
    return false;
  }

  if (actionData.intent === "update-manual-shopping-item") {
    return Boolean(
      actionData.manualFieldErrors &&
        Object.values(actionData.manualFieldErrors).some(Boolean),
    );
  }

  if (actionData.intent === "update-generated-shopping-item") {
    return Boolean(
      actionData.generatedOverrideFieldErrors &&
        Object.values(actionData.generatedOverrideFieldErrors).some(Boolean),
    );
  }

  return false;
}

function parseQuickAddManualShoppingItemInput(formData: FormData) {
  return {
    ingredientId: String(formData.get("ingredientId") ?? ""),
    name: String(formData.get("name") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
    recentNameNormalized: String(formData.get("recentNameNormalized") ?? ""),
  };
}

function parseManualShoppingItemValues(
  formData: FormData,
): ManualShoppingItemValues {
  return {
    buyOnDate: String(formData.get("buyOnDate") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    name: String(formData.get("name") ?? ""),
    note: String(formData.get("note") ?? ""),
    preferredStoreId: String(formData.get("preferredStoreId") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
  };
}

function parseGeneratedShoppingItemOverrideValues(
  formData: FormData,
): GeneratedShoppingItemOverrideValues {
  return {
    note: String(formData.get("note") ?? ""),
    postponedUntilDate: String(formData.get("postponedUntilDate") ?? ""),
    preferredStoreId: String(formData.get("preferredStoreId") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
  };
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

  const manualItemId = formData.get("manualItemId");

  if (typeof manualItemId === "string" && manualItemId.trim()) {
    return manualItemId;
  }

  return null;
}

function getShoppingNotice(request: Request): ShoppingNotice | null {
  const notice = new URL(request.url).searchParams.get("notice");

  if (
    notice === "generated-shopping-item-excluded" ||
    notice === "generated-shopping-item-restored" ||
    notice === "generated-shopping-item-updated" ||
    notice === "manual-shopping-item-added" ||
    notice === "manual-shopping-item-deleted" ||
    notice === "manual-shopping-item-updated" ||
    notice === "shopping-item-check-state-updated" ||
    notice === "stock-shopping-items-opted-in"
  ) {
    return notice;
  }

  return null;
}

function buildShoppingRedirect({
  familyId,
  mealPlanId,
  notice,
  request,
}: {
  familyId: string;
  mealPlanId: string;
  notice: ShoppingNotice;
  request: Request;
}) {
  const url = new URL(
    `/families/${familyId}/meal-plans/${mealPlanId}/shopping`,
    request.url,
  );
  url.searchParams.set("notice", notice);

  return Response.redirect(url, 302);
}

function getShoppingNoticeContent(notice: ShoppingNotice) {
  switch (notice) {
    case "manual-shopping-item-added":
      return {
        description:
          "Den manuelle varelinjen ble lagt til i handlelisten og sortert sammen med de andre varene.",
        title: "Varelinje lagt til",
      };
    case "manual-shopping-item-updated":
      return {
        description: "Endringene i den manuelle varelinjen ble lagret.",
        title: "Varelinje oppdatert",
      };
    case "manual-shopping-item-deleted":
      return {
        description:
          "Den manuelle varelinjen og eventuell avkryssing ble fjernet fra handlelisten.",
        title: "Varelinje slettet",
      };
    case "generated-shopping-item-excluded":
      return {
        description:
          "Varelinjen ble fjernet fra handlelisten. Du kan legge den tilbake i seksjonen for fjernede varer.",
        title: "Varelinje fjernet",
      };
    case "generated-shopping-item-restored":
      return {
        description:
          "Varelinjen vises igjen i handlelisten med eventuelle tilpasninger du hadde lagret.",
        title: "Varelinje lagt tilbake",
      };
    case "generated-shopping-item-updated":
      return {
        description:
          "Butikkvalg, notat og handledato for den genererte varelinjen ble lagret.",
        title: "Tilpasninger lagret",
      };
    case "shopping-item-check-state-updated":
      return {
        description: "Avkryssingen for varelinjen ble oppdatert.",
        title: "Handleliste oppdatert",
      };
    case "stock-shopping-items-opted-in":
      return {
        description:
          "Basisvarene ble lagt til i handlelisten for denne ukeplanen.",
        title: "Basisvarer lagt til",
      };
  }
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

function formatMealPlanWindow(startDate: string, endDate: string) {
  return `${formatDateLabel(startDate)} til ${formatDateLabel(endDate)}`;
}

function QuantityEditIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 20h4l10.5-10.5-4-4L4 16v4Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
      <path
        d="m13.5 6.5 4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}
