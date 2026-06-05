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
import { ShoppingDateSelect } from "../components/shopping-list-item-expanded";
import { StoreModeDeprioritizeBoughtToggle } from "../components/store-mode-deprioritize-bought-toggle";
import {
  StoreModeShoppingItemCard,
  type StoreModeCategoryUpdateRequest,
} from "../components/store-mode-shopping-item-card";
import { StoreModeShoppingViewToggle } from "../components/store-mode-shopping-view-toggle";
import { requireUser } from "../lib/auth.server";
import {
  createQuickFamilyShoppingItem,
  parseFamilyShoppingItemValues,
  parseQuickAddFamilyShoppingItemInput,
  toggleFamilyShoppingItemChecked,
  updateFamilyShoppingItem,
  updateFamilyShoppingItemQuantity,
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
  insertProjectedItemIntoSectionGroups,
  prependRecentManualItem,
  relocateProjectedItemInSectionGroups,
} from "../lib/shopping-list-client";
import type { QuickAddShoppingSuccess } from "../lib/shopping-quick-add";
import { scrollToShoppingItem } from "../lib/shopping-quick-add-feedback.client";
import { serializeProjectedShoppingItem } from "../lib/shopping-serialize";
import {
  getMealPlanStoreModeData,
  listRecentManualShoppingItemsForFamily,
  projectCreatedFamilyShoppingItem,
  projectCreatedManualShoppingItem,
  type RecentManualShoppingItem,
} from "../lib/shopping.server";
import {
  parseManualShoppingItemValues,
  toggleShoppingItemChecked,
  updateActiveShoppingDate,
  updateManualShoppingItem,
} from "../lib/shopping-write.server";
import { listIngredientCategories } from "../lib/store.server";
import { updateSelectedStorePreference } from "../lib/store-write.server";
import {
  getStoreModeBannerClass,
  storeModeAccentBarClass,
  storeModeCountChipClass,
  storeModeLaterChipClass,
  storeModeMetaDateSelectClass,
  storeModeMetaStoreSelectClass,
  storeModeMetaStripClass,
  storeModeMutedPanelClass,
  storeModePageClass,
  storeModeProgressDotClass,
  storeModeProgressPillClass,
  storeModeQuickAddDockClass,
  storeModeSectionCardClass,
  storeModeSurfaceCardClass,
} from "../lib/store-mode-theme";
import {
  STORE_MODE_SYNC_PROGRESS_MESSAGE,
  useStoreModeToggleSync,
} from "../lib/use-store-mode-toggle-sync";
import { useDebouncedRevalidate } from "../lib/use-debounced-revalidate";

type StoreModeNotice =
  | "active-shopping-date-updated"
  | "family-shopping-item-added"
  | "selected-store-updated"
  | "shopping-item-check-state-updated";

type StoreModeIntent =
  | "quick-add-family-shopping-item"
  | "update-family-shopping-item-category"
  | "update-family-shopping-item-quantity"
  | "update-manual-shopping-item-category"
  | "toggle-family-shopping-item-checked"
  | "toggle-shopping-item-checked"
  | "update-active-shopping-date"
  | "update-selected-store";

interface StoreModeActionData {
  activeShoppingDateFieldErrors?: {
    activeShoppingDate?: string;
  };
  activeShoppingDateValue?: string;
  categoryFieldErrors?: {
    categoryId?: string;
  };
  formError?: string;
  intent?: StoreModeIntent;
  item?: QuickAddShoppingSuccess["item"];
  ok?: boolean;
  recentManualItem?: RecentManualShoppingItem;
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
  const [result, recentManualItems, categories] = await Promise.all([
    getMealPlanStoreModeData({
      familyId,
      mealPlanId,
      userId: user.id,
    }),
    listRecentManualShoppingItemsForFamily({
      familyId,
    }),
    listIngredientCategories(),
  ]);

  return {
    activeShoppingDate: formatDateOnly(result.activeShoppingDate),
    categories,
    dueSectionGroups: result.dueSectionGroups.map((section) => ({
      ...section,
      items: section.items.map(serializeProjectedShoppingItem),
    })),
    family: result.family,
    includedMealPlans: result.includedMealPlans,
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
    selectableShoppingDates: result.selectableShoppingDates,
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

    return {
      intent,
      item: serializeProjectedShoppingItem(result.item),
      ok: true,
      recentManualItem: result.recentManualItem,
    } satisfies StoreModeActionData;
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

  if (intent === "update-family-shopping-item-quantity") {
    const familyItemId = String(formData.get("sourceKey") ?? "").trim();
    const quantity = String(formData.get("quantity") ?? "");

    if (!familyItemId) {
      return {
        formError: "Vi fant ikke handlelinjen som skulle oppdateres.",
        intent,
      } satisfies StoreModeActionData;
    }

    const result = await updateFamilyShoppingItemQuantity({
      expectedUpdatedAt: String(formData.get("expectedUpdatedAt") ?? ""),
      familyId,
      familyItemId,
      quantity,
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

  if (intent === "update-family-shopping-item-category") {
    const familyItemId = String(formData.get("sourceKey") ?? "").trim();

    if (!familyItemId) {
      return {
        formError: "Vi fant ikke handlelinjen som skulle oppdateres.",
        intent,
      } satisfies StoreModeActionData;
    }

    const result = await updateFamilyShoppingItem({
      expectedUpdatedAt: String(formData.get("expectedUpdatedAt") ?? ""),
      familyId,
      familyItemId,
      userId: user.id,
      values: parseFamilyShoppingItemValues(formData),
    });

    if (result.status === "NOT_FOUND") {
      return {
        formError: "Fant ikke varelinjen som skulle oppdateres.",
        intent,
      } satisfies StoreModeActionData;
    }

    if (result.status === "CONFLICT") {
      return {
        formError: result.formError,
        intent,
      } satisfies StoreModeActionData;
    }

    if (result.status === "VALIDATION_ERROR") {
      return {
        categoryFieldErrors: result.fieldErrors,
        formError: result.fieldErrors.categoryId,
        intent,
      } satisfies StoreModeActionData;
    }

    const item = await projectCreatedFamilyShoppingItem({
      familyId,
      familyItemId,
    });

    if (!item) {
      return {
        formError: "Fant ikke varelinjen etter oppdatering.",
        intent,
      } satisfies StoreModeActionData;
    }

    return {
      intent,
      item: serializeProjectedShoppingItem(item),
      ok: true,
    } satisfies StoreModeActionData;
  }

  if (intent === "update-manual-shopping-item-category") {
    const manualItemId = String(formData.get("sourceKey") ?? "").trim();

    if (!manualItemId) {
      return {
        formError: "Vi fant ikke handlelinjen som skulle oppdateres.",
        intent,
      } satisfies StoreModeActionData;
    }

    const itemMealPlanId = resolveItemMealPlanId(formData, mealPlanId);
    const result = await updateManualShoppingItem({
      expectedUpdatedAt: String(formData.get("expectedUpdatedAt") ?? ""),
      familyId,
      manualItemId,
      mealPlanId: itemMealPlanId,
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
      } satisfies StoreModeActionData;
    }

    if (result.status === "VALIDATION_ERROR") {
      return {
        categoryFieldErrors: result.fieldErrors,
        formError: result.fieldErrors.categoryId,
        intent,
      } satisfies StoreModeActionData;
    }

    const item = await projectCreatedManualShoppingItem({
      familyId,
      manualItemId,
      mealPlanId: itemMealPlanId,
    });

    if (!item) {
      return {
        formError: "Fant ikke varelinjen etter oppdatering.",
        intent,
      } satisfies StoreModeActionData;
    }

    return {
      intent,
      item: serializeProjectedShoppingItem(item),
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

    const itemMealPlanId = resolveItemMealPlanId(formData, mealPlanId);
    const result = await toggleShoppingItemChecked({
      checked,
      expectedUpdatedAt: String(formData.get("expectedUpdatedAt") ?? ""),
      familyId,
      mealPlanId: itemMealPlanId,
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
  const scheduleRevalidate = useDebouncedRevalidate(revalidator.revalidate);
  const toggleFetcher = useFetcher<StoreModeActionData>();
  const quantityFetcher = useFetcher<StoreModeActionData>();
  const categoryFetcher = useFetcher<StoreModeActionData>();
  const pendingIntent = navigation.formData?.get("intent");
  const [dueSectionGroups, setDueSectionGroups] = useState(
    loaderData.dueSectionGroups,
  );
  const [recentManualItems, setRecentManualItems] = useState(
    loaderData.recentManualItems,
  );
  const [quickAddPrefillRequest, setQuickAddPrefillRequest] = useState<{
    id: string;
    name: string;
    quantity: string | null;
  } | null>(null);
  const [recentlyAddedSourceKey, setRecentlyAddedSourceKey] = useState<
    string | null
  >(null);
  const isSavingStore =
    navigation.state === "submitting" &&
    pendingIntent === "update-selected-store";
  const isSavingShoppingDate =
    navigation.state === "submitting" &&
    pendingIntent === "update-active-shopping-date";

  useEffect(() => {
    setDueSectionGroups(loaderData.dueSectionGroups);
    setRecentManualItems(loaderData.recentManualItems);
  }, [loaderData.dueSectionGroups, loaderData.recentManualItems]);

  const handleQuickAddSuccess = useCallback(
    (payload: QuickAddShoppingSuccess) => {
      setDueSectionGroups((currentSections) =>
        insertProjectedItemIntoSectionGroups(currentSections, payload.item),
      );
      setRecentManualItems((currentRecents) =>
        prependRecentManualItem(currentRecents, payload.recentManualItem),
      );
      setRecentlyAddedSourceKey(payload.item.sourceKey);
      setQuickAddPrefillRequest(null);
      scheduleRevalidate();
    },
    [scheduleRevalidate],
  );

  const handleQuickAddFromCard = useCallback(
    (item: { name: string; quantityLabel: string | null }) => {
      setQuickAddPrefillRequest({
        id: `${Date.now()}-${item.name}`,
        name: item.name,
        quantity: item.quantityLabel,
      });
    },
    [],
  );

  const handleUpdateQuantity = useCallback(
    ({
      expectedUpdatedAt,
      quantity,
      sourceKey,
    }: {
      expectedUpdatedAt: string;
      quantity: string;
      sourceKey: string;
    }) => {
      const formData = new FormData();
      formData.set("intent", "update-family-shopping-item-quantity");
      formData.set("sourceKey", sourceKey);
      formData.set("expectedUpdatedAt", expectedUpdatedAt);
      formData.set("quantity", quantity);
      quantityFetcher.submit(formData, { method: "post" });
    },
    [quantityFetcher],
  );

  useEffect(() => {
    if (
      quantityFetcher.state !== "idle" ||
      quantityFetcher.data?.intent !== "update-family-shopping-item-quantity" ||
      !quantityFetcher.data.ok
    ) {
      return;
    }

    scheduleRevalidate();
  }, [quantityFetcher.data, quantityFetcher.state, scheduleRevalidate]);

  const handleUpdateCategory = useCallback(
    (request: StoreModeCategoryUpdateRequest) => {
      const formData = new FormData();
      formData.set(
        "intent",
        request.sourceType === "FAMILY"
          ? "update-family-shopping-item-category"
          : "update-manual-shopping-item-category",
      );
      formData.set("sourceKey", request.sourceKey);
      formData.set("expectedUpdatedAt", request.expectedUpdatedAt);
      formData.set("categoryId", request.categoryId);
      formData.set("name", request.name);
      formData.set("note", request.note);
      formData.set("preferredStoreId", request.preferredStoreId);
      formData.set("quantity", request.quantity);

      if (request.sourceType === "MANUAL") {
        formData.set("buyOnDate", request.buyOnDate);
        formData.set("itemMealPlanId", request.mealPlanId);
      }

      categoryFetcher.submit(formData, { method: "post" });
    },
    [categoryFetcher],
  );

  useEffect(() => {
    if (categoryFetcher.state !== "idle") {
      return;
    }

    const data = categoryFetcher.data;

    if (
      data?.intent !== "update-family-shopping-item-category" &&
      data?.intent !== "update-manual-shopping-item-category"
    ) {
      return;
    }

    if (!data.ok) {
      return;
    }

    const updatedItem = data.item;

    if (!updatedItem) {
      return;
    }

    setDueSectionGroups((currentSections) =>
      relocateProjectedItemInSectionGroups(
        currentSections,
        updatedItem.sourceKey,
        updatedItem,
      ),
    );
    setRecentlyAddedSourceKey(updatedItem.sourceKey);
    scheduleRevalidate();
  }, [categoryFetcher.data, categoryFetcher.state, scheduleRevalidate]);

  const categoryInteractionSourceKey = categoryFetcher.formData
    ? String(categoryFetcher.formData.get("sourceKey") ?? "")
    : "";
  const isSavingCategorySourceKey =
    categoryFetcher.state !== "idle" ? categoryInteractionSourceKey : null;
  const categoryFetcherError =
    categoryFetcher.data?.formError &&
    (categoryFetcher.data.intent === "update-family-shopping-item-category" ||
      categoryFetcher.data.intent === "update-manual-shopping-item-category")
      ? categoryFetcher.data.formError
      : null;

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
  }, [dueSectionGroups, recentlyAddedSourceKey]);

  const loaderDueItems = useMemo(
    () => dueSectionGroups.flatMap((section) => section.items),
    [dueSectionGroups],
  );
  const { displayItemsBySourceKey, handleToggle, syncBannerMessage } =
    useStoreModeToggleSync({
      activeShoppingDate: loaderData.activeShoppingDate,
      familyId: loaderData.family.id,
      loaderItems: loaderDueItems,
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
      dueSectionGroups.map((section) => ({
        ...section,
        items: section.items.map(
          (item) => displayItemsBySourceKey.get(item.sourceKey) ?? item,
        ),
      })),
    [displayItemsBySourceKey, dueSectionGroups],
  );
  const viewStorageKey = useMemo(
    () =>
      buildStoreModeViewStorageKey({
        familyId: loaderData.family.id,
      }),
    [loaderData.family.id],
  );
  const deprioritizeBoughtStorageKey = useMemo(
    () =>
      buildStoreModeDeprioritizeBoughtStorageKey({
        familyId: loaderData.family.id,
      }),
    [loaderData.family.id],
  );
  const [shoppingView, setShoppingView] = useState<StoreModeShoppingView>(() =>
    readStoreModeShoppingView(viewStorageKey),
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
  const { activeSections, boughtItems } = useMemo(
    (): {
      activeSections: StoreModeDisplaySection[];
      boughtItems: StoreModeDisplayItem[];
    } => partitionStoreModeSections(displaySectionGroups, deprioritizeBought),
    [deprioritizeBought, displaySectionGroups],
  );
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
  const generalFormError =
    categoryFetcherError ??
    (actionData?.formError &&
    actionData.intent !== "quick-add-family-shopping-item"
      ? actionData.formError
      : undefined);

  return (
    <main className={storeModePageClass}>
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <section className={storeModeMetaStripClass}>
          <div className="min-w-0">
            <h1 className="truncate font-semibold text-stone-950">Butikkmodus</h1>
            <p className="truncate text-xs text-stone-500">
              Samlet fra {loaderData.includedMealPlans.length}{" "}
              {loaderData.includedMealPlans.length === 1 ? "ukeplan" : "ukeplaner"}
            </p>
          </div>
          <span className="hidden text-stone-300 sm:inline" aria-hidden="true">
            ·
          </span>
          <Form className="inline-flex min-w-0 flex-col gap-1" method="post">
            <input name="intent" type="hidden" value="update-selected-store" />
            <select
              aria-busy={isSavingStore}
              aria-label="Velg butikk"
              className={storeModeMetaStoreSelectClass}
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
          <Form className="inline-flex min-w-0 flex-col gap-1" method="post">
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
            <ShoppingDateSelect
              aria-busy={isSavingShoppingDate}
              aria-label="Velg handledato"
              className={storeModeMetaDateSelectClass}
              defaultValue={activeShoppingDateValue}
              disabled={isSavingShoppingDate}
              name="activeShoppingDate"
              onChange={(event) => {
                submitSelectForm(event, activeShoppingDateValue, submit);
              }}
              selectableShoppingDates={loaderData.selectableShoppingDates}
              showEmptyOption={false}
            />
            {actionData?.intent === "update-active-shopping-date" &&
            actionData.activeShoppingDateFieldErrors?.activeShoppingDate ? (
              <p className="text-sm text-rose-600">
                {actionData.activeShoppingDateFieldErrors.activeShoppingDate}
              </p>
            ) : null}
          </Form>
          <span className="hidden text-stone-300 sm:inline" aria-hidden="true">
            ·
          </span>
          <span className={storeModeProgressPillClass}>
            <span aria-hidden="true" className={storeModeProgressDotClass} />
            {displayProgress.checkedCount}/{displayProgress.totalCount}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <Link
              className="text-stone-600 underline-offset-2 hover:text-stone-950 hover:underline"
              to={`/families/${loaderData.family.id}/meal-plans/${loaderData.mealPlan.id}/shopping`}
            >
              Handleliste
            </Link>
            <Link
              className="text-stone-600 underline-offset-2 hover:text-stone-950 hover:underline"
              to={`/families/${loaderData.family.id}/stores`}
            >
              Butikker
            </Link>
          </div>
        </section>

        {noticeContent ? (
          <section className={getStoreModeBannerClass("success")}>
            <h2 className="text-base font-semibold">{noticeContent.title}</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-900">
              {noticeContent.description}
            </p>
          </section>
        ) : null}

        {syncBannerMessage ? (
          <section
            className={getStoreModeBannerClass(
              syncBannerMessage === STORE_MODE_SYNC_PROGRESS_MESSAGE
                ? "sync"
                : "error",
            )}
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
          <section className={getStoreModeBannerClass("error")}>
            <h2 className="text-base font-semibold">
              Kunne ikke oppdatere butikkmodus
            </h2>
            <p className="mt-2 text-sm leading-6">{generalFormError}</p>
          </section>
        ) : null}

        {displaySectionGroups.length > 0 ? (
          <section className="grid gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-stone-950">
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
                  className={storeModeSectionCardClass}
                >
                  <div aria-hidden="true" className={storeModeAccentBarClass} />
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold tracking-tight text-stone-950">
                      {section.displayName}
                    </h2>
                    <span className={storeModeCountChipClass}>
                      {section.items.length} varer
                    </span>
                  </div>

                  <StoreModeItemGrid
                    categories={loaderData.categories}
                    categoryFetcherError={categoryFetcherError}
                    categoryInteractionSourceKey={categoryInteractionSourceKey}
                    isSavingCategorySourceKey={isSavingCategorySourceKey}
                    items={section.items}
                    layout={shoppingView}
                    onQuickAddFromCard={handleQuickAddFromCard}
                    onUpdateCategory={handleUpdateCategory}
                    onUpdateQuantity={handleUpdateQuantity}
                    onToggleItem={handleToggle}
                    recentlyAddedSourceKey={recentlyAddedSourceKey}
                    selectedStoreId={loaderData.selectedStore?.id}
                  />
                </article>
              ))
            ) : deprioritizeBought ? (
              <article className={`${storeModeSurfaceCardClass} p-6`}>
                <h3 className="text-base font-semibold text-stone-950">
                  Alt er krysset av
                </h3>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  Du har handlet alle varene for denne turen. Kjøpte varer
                  ligger nedenfor hvis du vil se eller endre dem.
                </p>
              </article>
            ) : null}
            {deprioritizeBought && boughtItems.length > 0 ? (
              <details className={storeModeMutedPanelClass}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="text-lg font-semibold tracking-tight text-stone-950">
                    Kjøpt
                  </span>
                  <span className={storeModeCountChipClass}>
                    {boughtItems.length} varer
                  </span>
                </summary>

                <StoreModeItemGrid
                  categories={loaderData.categories}
                  categoryFetcherError={categoryFetcherError}
                  categoryInteractionSourceKey={categoryInteractionSourceKey}
                  isSavingCategorySourceKey={isSavingCategorySourceKey}
                  items={boughtItems}
                  layout={shoppingView}
                  onQuickAddFromCard={handleQuickAddFromCard}
                  onUpdateCategory={handleUpdateCategory}
                  onUpdateQuantity={handleUpdateQuantity}
                  onToggleItem={handleToggle}
                  recentlyAddedSourceKey={recentlyAddedSourceKey}
                  selectedStoreId={loaderData.selectedStore?.id}
                />
              </details>
            ) : null}
          </section>
        ) : (
          <section className={`${storeModeSurfaceCardClass} p-6`}>
            <h2 className="text-lg font-semibold tracking-tight text-stone-950">
              Ingen varer må handles nå
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Alt er enten ferdig handlet, utenfor denne handleturen, eller
              allerede passert.
            </p>
          </section>
        )}

        <section className={`${storeModeSurfaceCardClass} p-6`}>
          <h2 className="text-lg font-semibold tracking-tight text-stone-950">
            Før handledato
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {loaderData.laterItems.length > 0 ? (
              loaderData.laterItems.map((item) => (
                <span
                  key={`later:${item.sourceKey}`}
                  className={storeModeLaterChipClass}
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
              <p className="text-sm leading-6 text-stone-600">
                Ingen varer ligger før handledato akkurat nå.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 overflow-x-clip px-4 pb-4 pt-3">
        <div className="pointer-events-auto mx-auto max-w-4xl min-w-0">
          <div className={storeModeQuickAddDockClass}>
            <ManualShoppingQuickAdd
              appearance="store-mode"
              ingredientSearchPath={ingredientSearchPath}
              onQuickAddSuccess={handleQuickAddSuccess}
              prefillRequest={quickAddPrefillRequest}
              quickAddIntent="quick-add-family-shopping-item"
              recentManualItems={recentManualItems}
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
    <main className={`${storeModePageClass} py-16`}>
      <div className={`mx-auto max-w-2xl ${storeModeSurfaceCardClass} p-8`}>
        <h1 className="text-2xl font-semibold text-stone-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">{message}</p>
        <Link
          className="mt-6 inline-flex rounded-2xl bg-stone-900 px-5 py-3 text-sm font-medium text-white"
          to="/app"
        >
          Til appen
        </Link>
      </div>
    </main>
  );
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

function StoreModeItemGrid<
  TItem extends ComponentProps<typeof StoreModeShoppingItemCard>["item"],
>({
  categories,
  categoryFetcherError,
  categoryInteractionSourceKey,
  isSavingCategorySourceKey,
  items,
  layout,
  onQuickAddFromCard,
  onUpdateCategory,
  onUpdateQuantity,
  onToggleItem,
  recentlyAddedSourceKey,
  selectedStoreId,
}: {
  categories: ComponentProps<typeof StoreModeShoppingItemCard>["categories"];
  categoryFetcherError: string | null;
  categoryInteractionSourceKey: string;
  isSavingCategorySourceKey: string | null;
  items: TItem[];
  layout: StoreModeShoppingView;
  onQuickAddFromCard: (item: { name: string; quantityLabel: string | null }) => void;
  onUpdateCategory: (request: StoreModeCategoryUpdateRequest) => void;
  onUpdateQuantity: (item: {
    expectedUpdatedAt: string;
    quantity: string;
    sourceKey: string;
  }) => void;
  onToggleItem: (item: TItem) => void;
  recentlyAddedSourceKey: string | null;
  selectedStoreId?: string;
}) {
  return (
    <div
      className={
        layout === "grid"
          ? "mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 [&>*]:min-w-0"
          : "mt-4 flex flex-col gap-2"
      }
    >
      {items.map((item) => (
        <StoreModeShoppingItemCard
          key={item.sourceKey}
          categories={categories}
          categoryError={
            categoryInteractionSourceKey === item.sourceKey
              ? categoryFetcherError
              : null
          }
          isRecentlyAdded={recentlyAddedSourceKey === item.sourceKey}
          isSavingCategory={isSavingCategorySourceKey === item.sourceKey}
          item={item}
          layout={layout}
          onQuickAddFromCard={onQuickAddFromCard}
          onUpdateCategory={onUpdateCategory}
          onUpdateQuantity={onUpdateQuantity}
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

function resolveItemMealPlanId(
  formData: FormData,
  fallbackMealPlanId: string,
) {
  const value = String(formData.get("itemMealPlanId") ?? "").trim();

  return value || fallbackMealPlanId;
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
