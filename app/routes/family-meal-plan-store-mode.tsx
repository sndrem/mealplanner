import { ShoppingItemSource } from "@prisma/client";
import type { ChangeEvent, ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Form,
  Link,
  isRouteErrorResponse,
  useFetcher,
  useNavigation,
  useRevalidator,
  redirect,
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
  sortStoreModeItemsByName,
  type StoreModeShoppingView,
  writeStoreModeDeprioritizeBought,
  writeStoreModeShoppingView,
} from "../lib/shopping-store-mode-client";
import {
  buildOptimisticManualShoppingItem,
  dropResolvedOptimisticItemsFromSectionGroups,
  insertProjectedItemIntoSectionGroups,
  patchProjectedItemInSectionGroups,
  prependRecentManualItem,
  relocateProjectedItemInSectionGroups,
  removeProjectedItemFromSectionGroups,
} from "../lib/shopping-list-client";
import type {
  OptimisticQuickAddDraft,
  QuickAddShoppingSuccess,
} from "../lib/shopping-quick-add";
import { scrollToShoppingItem } from "../lib/shopping-quick-add-feedback.client";
import { serializeProjectedShoppingItem } from "../lib/shopping-serialize";
import { resolveStoreModeAnchorMealPlan } from "../lib/meal-plan-for-date.server";
import { listShoppingCheckHistoryForStoreMode } from "../lib/shopping-check-history.server";
import {
  getFamilyStoreModeData,
  listRecentManualShoppingItemsForFamily,
  projectCreatedFamilyShoppingItem,
  projectCreatedManualShoppingItem,
  type RecentManualShoppingItem,
} from "../lib/shopping.server";
import {
  parseManualShoppingItemValues,
  toggleShoppingItemChecked,
  updateActiveShoppingDate,
  updateGeneratedShoppingItemQuantity,
  updateManualShoppingItem,
} from "../lib/shopping-write.server";
import { listIngredientCategories } from "../lib/store.server";
import {
  parseStoreModeTripFocus,
  updateStoreModeTripFocus,
} from "../lib/store-mode-trip-focus-write.server";
import { updateSelectedStorePreference } from "../lib/store-write.server";
import {
  getStoreModeBannerClass,
  getStoreModeSyncOverlayClass,
  storeModeAccentBarClass,
  storeModeBottomChromeShellClass,
  storeModeCountChipClass,
  storeModeHandletFoldClass,
  storeModeLaterChipClass,
  storeModeMetaDateSelectClass,
  storeModeMetaStoreSelectClass,
  storeModeMetaTripFocusSelectClass,
  storeModeMetaStripClass,
  storeModeMutedPanelClass,
  storeModePageClass,
  storeModeProgressDotClass,
  storeModeProgressPillClass,
  storeModeQuickAddDockClass,
  storeModeSectionCardClass,
  storeModeSurfaceCardClass,
  storeModeSyncOverlayShellClass,
  storeModeUndoBarActionClass,
  storeModeUndoBarClass,
  storeModeUndoBarDismissClass,
} from "../lib/store-mode-theme";
import {
  STORE_MODE_SYNC_PROGRESS_MESSAGE,
  useStoreModeToggleSync,
} from "../lib/use-store-mode-toggle-sync";
import { useDebouncedRevalidate } from "../lib/use-debounced-revalidate";
import type { Route } from "./+types/family-meal-plan-store-mode";

type StoreModeNotice =
  | "active-shopping-date-updated"
  | "family-shopping-item-added"
  | "selected-store-updated"
  | "shopping-item-check-state-updated"
  | "store-mode-trip-focus-updated";

type StoreModeIntent =
  | "quick-add-family-shopping-item"
  | "update-family-shopping-item-category"
  | "update-family-shopping-item-quantity"
  | "update-generated-shopping-item-quantity"
  | "update-manual-shopping-item-category"
  | "toggle-family-shopping-item-checked"
  | "toggle-shopping-item-checked"
  | "update-active-shopping-date"
  | "update-selected-store"
  | "update-store-mode-trip-focus";

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
  tripFocusFieldErrors?: {
    tripFocus?: string;
  };
  tripFocusValue?: string;
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

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const familyId = requireRouteParam(params.familyId, "Fant ikke familien.");
  const storeModeDataPromise = getFamilyStoreModeData({
    familyId,
    userId: user.id,
  });
  const [result, recentManualItems, categories] = await Promise.all([
    storeModeDataPromise,
    listRecentManualShoppingItemsForFamily({
      familyId,
    }),
    listIngredientCategories(),
  ]);

  if (!result) {
    throw redirect(`/families/${familyId}/meal-plans`);
  }

  const shoppingHistory = await listShoppingCheckHistoryForStoreMode({
    familyId,
    mealPlanIds: result.includedMealPlans.map((plan) => plan.id),
  });

  return {
    activeShoppingDate: formatDateOnly(result.activeShoppingDate),
    canFocusNext: result.canFocusNext,
    categories,
    dueSectionGroups: result.dueSectionGroups.map((section) => ({
      ...section,
      items: section.items.map(serializeProjectedShoppingItem),
    })),
    effectiveTripFocus: result.effectiveTripFocus,
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
    shoppingHistory,
    stores: result.stores,
    tripFocus: result.tripFocus,
    userRole: result.userRole,
    visibleDates: result.visibleDates,
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const familyId = requireRouteParam(params.familyId, "Fant ikke familien.");
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const anchorMealPlanId = await resolveStoreModeAnchorMealPlanId({
    familyId,
    formData,
  });

  if (intent === "update-active-shopping-date") {
    const activeShoppingDate = String(formData.get("activeShoppingDate") ?? "");
    const result = await updateActiveShoppingDate({
      activeShoppingDate,
      expectedMealPlanUpdatedAt: String(
        formData.get("mealPlanUpdatedAt") ?? "",
      ),
      familyId,
      mealPlanId: anchorMealPlanId,
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

    return buildFamilyStoreModeRedirect({
      familyId,
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

    return buildFamilyStoreModeRedirect({
      familyId,
      notice: "selected-store-updated",
      request,
    });
  }

  if (intent === "update-store-mode-trip-focus") {
    const tripFocus = parseStoreModeTripFocus(formData.get("tripFocus"));

    if (!tripFocus) {
      return {
        formError: "Ugyldig fokus for butikkmodus.",
        intent,
        tripFocusFieldErrors: {
          tripFocus: "Velg et gyldig fokus.",
        },
        tripFocusValue: String(formData.get("tripFocus") ?? ""),
      } satisfies StoreModeActionData;
    }

    const result = await updateStoreModeTripFocus({
      familyId,
      tripFocus,
      userId: user.id,
    });

    if (result.status === "VALIDATION_ERROR") {
      return {
        formError: result.formError,
        intent,
        tripFocusFieldErrors: {
          tripFocus: result.formError,
        },
        tripFocusValue: tripFocus,
      } satisfies StoreModeActionData;
    }

    return buildFamilyStoreModeRedirect({
      familyId,
      notice: "store-mode-trip-focus-updated",
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

  if (intent === "update-generated-shopping-item-quantity") {
    const sourceKey = String(formData.get("sourceKey") ?? "").trim();
    const quantity = String(formData.get("quantity") ?? "");

    if (!sourceKey) {
      return {
        formError: "Vi fant ikke handlelinjen som skulle oppdateres.",
        intent,
      } satisfies StoreModeActionData;
    }

    const itemMealPlanId = resolveItemMealPlanId(formData, anchorMealPlanId);
    const result = await updateGeneratedShoppingItemQuantity({
      expectedUpdatedAt: String(formData.get("expectedUpdatedAt") ?? ""),
      familyId,
      mealPlanId: itemMealPlanId,
      quantity,
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

    const itemMealPlanId = resolveItemMealPlanId(formData, anchorMealPlanId);
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

    const itemMealPlanId = resolveItemMealPlanId(formData, anchorMealPlanId);
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
  const quantityRollbackRef = useRef(loaderData.dueSectionGroups);
  const categoryRollbackRef = useRef(loaderData.dueSectionGroups);
  const isSavingStore =
    navigation.state === "submitting" &&
    pendingIntent === "update-selected-store";
  const isSavingShoppingDate =
    navigation.state === "submitting" &&
    pendingIntent === "update-active-shopping-date";
  const isSavingTripFocus =
    navigation.state === "submitting" &&
    pendingIntent === "update-store-mode-trip-focus";

  useEffect(() => {
    setDueSectionGroups(
      dropResolvedOptimisticItemsFromSectionGroups(
        loaderData.dueSectionGroups,
        loaderData.dueSectionGroups.flatMap((section) => section.items),
      ),
    );
    setRecentManualItems(loaderData.recentManualItems);
  }, [loaderData.dueSectionGroups, loaderData.recentManualItems]);

  const fallbackCategory = loaderData.categories[0] ?? {
    displayName: "Annet",
    id: "uncategorized",
  };

  const handleQuickAddSubmit = useCallback(
    (draft: OptimisticQuickAddDraft) => {
      setDueSectionGroups((currentSections) =>
        insertProjectedItemIntoSectionGroups(
          currentSections,
          buildOptimisticManualShoppingItem({
            category: {
              id: fallbackCategory.id,
              name: fallbackCategory.displayName,
            },
            name: draft.name,
            quantity: draft.quantity,
            sourceKey: draft.sourceKey,
            sourceType: "FAMILY",
          }),
        ),
      );
      setRecentlyAddedSourceKey(draft.sourceKey);
    },
    [fallbackCategory.displayName, fallbackCategory.id],
  );

  const handleQuickAddSuccess = useCallback(
    (payload: QuickAddShoppingSuccess) => {
      setDueSectionGroups((currentSections) =>
        insertProjectedItemIntoSectionGroups(
          dropResolvedOptimisticItemsFromSectionGroups(currentSections, [
            payload.item,
          ]),
          payload.item,
        ),
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

  const handleQuickAddError = useCallback((sourceKey: string) => {
    setDueSectionGroups((currentSections) =>
      removeProjectedItemFromSectionGroups(currentSections, sourceKey),
    );
  }, []);

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
      mealPlanId,
      quantity,
      sourceKey,
      sourceType,
    }: {
      expectedUpdatedAt: string;
      mealPlanId?: string | null;
      quantity: string;
      sourceKey: string;
      sourceType: "FAMILY" | "GENERATED";
    }) => {
      const formData = new FormData();
      formData.set(
        "intent",
        sourceType === "GENERATED"
          ? "update-generated-shopping-item-quantity"
          : "update-family-shopping-item-quantity",
      );
      formData.set("sourceKey", sourceKey);
      formData.set("expectedUpdatedAt", expectedUpdatedAt);
      formData.set("quantity", quantity);

      if (sourceType === "GENERATED" && mealPlanId) {
        formData.set("itemMealPlanId", mealPlanId);
      }

      const trimmedQuantity = quantity.trim() || null;
      setDueSectionGroups((currentSections) => {
        quantityRollbackRef.current = currentSections;
        return patchProjectedItemInSectionGroups(currentSections, sourceKey, {
          quantity: trimmedQuantity,
          quantityLabel: trimmedQuantity,
        });
      });
      quantityFetcher.submit(formData, { method: "post" });
    },
    [quantityFetcher],
  );

  useEffect(() => {
    if (quantityFetcher.state !== "idle") {
      return;
    }

    const data = quantityFetcher.data;

    if (
      data?.intent !== "update-family-shopping-item-quantity" &&
      data?.intent !== "update-generated-shopping-item-quantity"
    ) {
      return;
    }

    if (!data.ok) {
      setDueSectionGroups(quantityRollbackRef.current);
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

      const nextCategory = loaderData.categories.find(
        (category) => category.id === request.categoryId,
      );
      const trimmedNote = request.note.trim() || null;

      setDueSectionGroups((currentSections) => {
        categoryRollbackRef.current = currentSections;
        const currentItem = currentSections
          .flatMap((section) => section.items)
          .find((item) => item.sourceKey === request.sourceKey);

        if (!currentItem || !nextCategory) {
          return currentSections;
        }

        return relocateProjectedItemInSectionGroups(
          currentSections,
          request.sourceKey,
          {
            ...currentItem,
            category: {
              id: nextCategory.id,
              name: nextCategory.displayName,
            },
            note: trimmedNote,
            section: {
              ...currentItem.section,
              displayName: nextCategory.displayName,
            },
          },
        );
      });
      setRecentlyAddedSourceKey(request.sourceKey);
      categoryFetcher.submit(formData, { method: "post" });
    },
    [categoryFetcher, loaderData.categories],
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
      setDueSectionGroups(categoryRollbackRef.current);
      return;
    }

    const updatedItem = data.item;

    if (updatedItem) {
      setDueSectionGroups((currentSections) =>
        relocateProjectedItemInSectionGroups(
          currentSections,
          updatedItem.sourceKey,
          updatedItem,
        ),
      );
      setRecentlyAddedSourceKey(updatedItem.sourceKey);
    }

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
  const { activeSections } = useMemo(
    () => partitionStoreModeSections(displaySectionGroups, deprioritizeBought),
    [deprioritizeBought, displaySectionGroups],
  );
  const hasUncheckedDueItems = useMemo(
    () => activeSections.some((section) => section.items.length > 0),
    [activeSections],
  );
  const [lastCheckedAction, setLastCheckedAction] =
    useState<StoreModeDisplayItem | null>(null);

  const handleToggleWithUndoFeedback = useCallback(
    (item: StoreModeDisplayItem) => {
      const displayItem = displayItemsBySourceKey.get(item.sourceKey) ?? item;
      const nextChecked = !displayItem.checked;
      handleToggle(item);

      if (nextChecked) {
        setLastCheckedAction({
          ...displayItem,
          checked: true,
        });
        return;
      }

      setLastCheckedAction((current) =>
        current?.sourceKey === item.sourceKey ? null : current,
      );
    },
    [displayItemsBySourceKey, handleToggle],
  );

  const handleUndoLastCheck = useCallback(() => {
    if (!lastCheckedAction) {
      return;
    }

    handleToggle(lastCheckedAction);
    setLastCheckedAction(null);
  }, [handleToggle, lastCheckedAction]);

  const handleDismissLastCheck = useCallback(() => {
    setLastCheckedAction(null);
  }, []);
  const pageClass = lastCheckedAction
    ? storeModePageClass.replace("pb-36", "pb-52")
    : storeModePageClass;
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
  const tripFocusValue =
    actionData?.intent === "update-store-mode-trip-focus" &&
    actionData.tripFocusValue
      ? actionData.tripFocusValue
      : loaderData.effectiveTripFocus;
  const tripFocusSubtitle = getStoreModeTripFocusSubtitle({
    effectiveTripFocus: loaderData.effectiveTripFocus,
    includedMealPlans: loaderData.includedMealPlans,
    mealPlanTitle: loaderData.mealPlan.title,
  });
  const ingredientSearchPath = `/families/${loaderData.family.id}/shopping/ingredient-search`;
  const quantityFetcherError =
    quantityFetcher.data?.formError &&
    (quantityFetcher.data.intent === "update-family-shopping-item-quantity" ||
      quantityFetcher.data.intent ===
        "update-generated-shopping-item-quantity")
      ? quantityFetcher.data.formError
      : null;
  const generalFormError =
    categoryFetcherError ??
    quantityFetcherError ??
    (actionData?.formError &&
    actionData.intent !== "quick-add-family-shopping-item"
      ? actionData.formError
      : undefined);

  return (
    <main className={pageClass}>
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <section className={storeModeMetaStripClass}>
          <div className="min-w-0">
            <h1 className="truncate font-semibold text-stone-950">Butikkmodus</h1>
            <p className="truncate text-xs text-stone-500">{tripFocusSubtitle}</p>
          </div>
          <span className="hidden text-stone-300 sm:inline" aria-hidden="true">
            ·
          </span>
          <Form className="inline-flex min-w-0 flex-col gap-1" method="post">
            <input
              name="intent"
              type="hidden"
              value="update-store-mode-trip-focus"
            />
            <select
              aria-busy={isSavingTripFocus}
              aria-label="Velg handletur-fokus"
              className={storeModeMetaTripFocusSelectClass}
              defaultValue={tripFocusValue}
              disabled={isSavingTripFocus}
              key={tripFocusValue}
              name="tripFocus"
              onChange={(event) => {
                submitSelectForm(event, tripFocusValue, submit);
              }}
            >
              <option value="CURRENT">Denne uken</option>
              <option disabled={!loaderData.canFocusNext} value="NEXT">
                Neste uke
              </option>
              <option value="ALL">Alle åpne</option>
            </select>
            {actionData?.intent === "update-store-mode-trip-focus" &&
            actionData.tripFocusFieldErrors?.tripFocus ? (
              <p className="text-sm text-rose-600">
                {actionData.tripFocusFieldErrors.tripFocus}
              </p>
            ) : null}
          </Form>
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
              name="mealPlanId"
              type="hidden"
              value={loaderData.mealPlan.id}
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
                <details
                  key={`${loaderData.selectedStore?.id ?? "no-store"}:${section.category.id}`}
                  className={storeModeSectionCardClass}
                  open
                >
                  <div aria-hidden="true" className={storeModeAccentBarClass} />
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-store-accent [&::-webkit-details-marker]:hidden">
                    <span className="text-lg font-semibold tracking-tight text-stone-950">
                      {section.displayName}
                    </span>
                    <span className={storeModeCountChipClass}>
                      {section.items.length > 0
                        ? `${section.items.length} varer`
                        : `${section.boughtItems.length} handlet`}
                    </span>
                  </summary>

                  {section.items.length > 0 ? (
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
                      onToggleItem={handleToggleWithUndoFeedback}
                      recentlyAddedSourceKey={recentlyAddedSourceKey}
                      selectedStoreId={loaderData.selectedStore?.id}
                    />
                  ) : null}

                  {deprioritizeBought && section.boughtItems.length > 0 ? (
                    <details
                      className={`${storeModeHandletFoldClass}${section.items.length > 0 ? " mt-4" : " mt-3"}`}
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:content-none [&::-webkit-details-marker]:hidden">
                        <span className="text-sm font-semibold text-stone-700">
                          Handlet
                        </span>
                        <span className={storeModeCountChipClass}>
                          {section.boughtItems.length} varer
                        </span>
                      </summary>

                      <StoreModeItemGrid
                        categories={loaderData.categories}
                        categoryFetcherError={categoryFetcherError}
                        categoryInteractionSourceKey={
                          categoryInteractionSourceKey
                        }
                        isSavingCategorySourceKey={isSavingCategorySourceKey}
                        items={section.boughtItems}
                        layout={shoppingView}
                        onQuickAddFromCard={handleQuickAddFromCard}
                        onUpdateCategory={handleUpdateCategory}
                        onUpdateQuantity={handleUpdateQuantity}
                        onToggleItem={handleToggleWithUndoFeedback}
                        recentlyAddedSourceKey={recentlyAddedSourceKey}
                        selectedStoreId={loaderData.selectedStore?.id}
                      />
                    </details>
                  ) : null}
                </details>
              ))
            ) : null}
            {deprioritizeBought &&
            activeSections.length > 0 &&
            !hasUncheckedDueItems ? (
              <article className={`${storeModeSurfaceCardClass} p-6`}>
                <h3 className="text-base font-semibold text-stone-950">
                  Alt er krysset av
                </h3>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  Du har handlet alle varene for denne turen. Åpne Handlet i
                  hver seksjon hvis du vil se eller endre dem.
                </p>
              </article>
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

        <details className={storeModeMutedPanelClass}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="text-lg font-semibold tracking-tight text-stone-950">
              Handlehistorikk
            </span>
            <span className={storeModeCountChipClass}>
              {loaderData.shoppingHistory.length} hendelser
            </span>
          </summary>

          {loaderData.shoppingHistory.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {loaderData.shoppingHistory.map((event) => (
                <li
                  key={event.id}
                  className="border-t border-stone-200/80 pt-3 first:border-t-0 first:pt-0"
                >
                  <p className="text-sm leading-6 text-stone-800">
                    <span className="font-medium text-stone-950">
                      {event.actorDisplayName}
                    </span>
                    {event.checked
                      ? " krysset av "
                      : " fjernet avkryssing for "}
                    <span className="font-medium text-stone-950">
                      {event.itemName}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-stone-500">
                    {formatHistoryTimestamp(event.occurredAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm leading-6 text-stone-600">
              Ingen handlehistorikk for denne turen ennå.
            </p>
          )}
        </details>
      </div>

      {syncBannerMessage ? (
        <div
          aria-live="polite"
          className={storeModeSyncOverlayShellClass}
          role="status"
        >
          <div
            className={getStoreModeSyncOverlayClass(
              syncBannerMessage === STORE_MODE_SYNC_PROGRESS_MESSAGE
                ? "sync"
                : "error",
            )}
          >
            <p className="font-semibold">
              {syncBannerMessage === STORE_MODE_SYNC_PROGRESS_MESSAGE
                ? "Synkroniserer"
                : "Kunne ikke synkronisere"}
            </p>
            <p className="mt-0.5 leading-5">{syncBannerMessage}</p>
          </div>
        </div>
      ) : null}

      <div className={storeModeBottomChromeShellClass}>
        <div className="pointer-events-auto mx-auto flex max-w-4xl min-w-0 flex-col gap-2">
          {lastCheckedAction ? (
            <div
              aria-live="polite"
              className={storeModeUndoBarClass}
              role="status"
            >
              <p className="min-w-0 flex-1 truncate leading-5">
                Krysset av:{" "}
                <span className="font-semibold">{lastCheckedAction.name}</span>
              </p>
              <button
                className={storeModeUndoBarActionClass}
                onClick={handleUndoLastCheck}
                type="button"
              >
                Angre
              </button>
              <button
                aria-label="Lukk"
                className={storeModeUndoBarDismissClass}
                onClick={handleDismissLastCheck}
                type="button"
              >
                ×
              </button>
            </div>
          ) : null}
          <div className={storeModeQuickAddDockClass}>
            <ManualShoppingQuickAdd
              appearance="store-mode"
              ingredientSearchPath={ingredientSearchPath}
              onQuickAddError={handleQuickAddError}
              onQuickAddSubmit={handleQuickAddSubmit}
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
    notice === "shopping-item-check-state-updated" ||
    notice === "store-mode-trip-focus-updated"
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
    case "store-mode-trip-focus-updated":
      return {
        description: "Fokuset for handleturen ble oppdatert.",
        title: "Fokus lagret",
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

function getStoreModeTripFocusSubtitle({
  effectiveTripFocus,
  includedMealPlans,
  mealPlanTitle,
}: {
  effectiveTripFocus: "CURRENT" | "NEXT" | "ALL";
  includedMealPlans: Array<{ title: string }>;
  mealPlanTitle: string;
}) {
  if (effectiveTripFocus === "ALL") {
    return `Alle åpne ukeplaner (${includedMealPlans.length})`;
  }

  if (effectiveTripFocus === "NEXT") {
    return `Neste uke · ${mealPlanTitle}`;
  }

  return `Denne uken · ${mealPlanTitle}`;
}

function buildFamilyStoreModeRedirect({
  familyId,
  notice,
  request,
}: {
  familyId: string;
  notice: StoreModeNotice;
  request: Request;
}) {
  const url = new URL(`/families/${familyId}/store-mode`, request.url);
  url.searchParams.set("notice", notice);

  return Response.redirect(url, 302);
}

async function resolveStoreModeAnchorMealPlanId({
  familyId,
  formData,
}: {
  familyId: string;
  formData: FormData;
}) {
  const mealPlanIdFromForm = String(formData.get("mealPlanId") ?? "").trim();

  if (mealPlanIdFromForm) {
    return mealPlanIdFromForm;
  }

  const anchorMealPlan = await resolveStoreModeAnchorMealPlan({
    familyId,
  });

  if (!anchorMealPlan) {
    throw buildMealPlanNotFoundResponse();
  }

  return anchorMealPlan.id;
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
    mealPlanId?: string | null;
    quantity: string;
    sourceKey: string;
    sourceType: "FAMILY" | "GENERATED";
  }) => void;
  onToggleItem: (item: TItem) => void;
  recentlyAddedSourceKey: string | null;
  selectedStoreId?: string;
}) {
  const sortedItems = useMemo(
    () => sortStoreModeItemsByName(items),
    [items],
  );

  return (
    <div
      className={
        layout === "grid"
          ? "mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 [&>*]:min-w-0"
          : "mt-4 flex flex-col gap-2"
      }
    >
      {sortedItems.map((item) => (
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

function formatHistoryTimestamp(value: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}
