import {
  isStoreModeTripFocusScanValue,
  type StoreModeTripFocusScanValue,
} from "./shopping-store-mode-client";
import type { StoreModeActionData } from "./store-mode-action-data";
import { storeModePageClass } from "./store-mode-theme";

interface NavigationSnapshot {
  formData?: FormData | null;
  state: string;
}

interface FetcherSnapshot {
  data?: StoreModeActionData;
  formData?: FormData | null;
  state: string;
}

export function isStoreModeRevalidatePaused({
  categoryFetcher,
  categoryHeadingsFetcher,
  navigation,
  quantityFetcher,
  revalidator,
  revisionFetcher,
  toggleFetcher,
}: {
  categoryFetcher: { state: string };
  categoryHeadingsFetcher: { state: string };
  navigation: { state: string };
  quantityFetcher: { state: string };
  revalidator: { state: string };
  revisionFetcher: { state: string };
  toggleFetcher: { state: string };
}) {
  return (
    navigation.state !== "idle" ||
    revalidator.state !== "idle" ||
    toggleFetcher.state !== "idle" ||
    quantityFetcher.state !== "idle" ||
    categoryFetcher.state !== "idle" ||
    categoryHeadingsFetcher.state !== "idle" ||
    revisionFetcher.state !== "idle"
  );
}

export function resolveStoreModePendingNavigation(
  navigation: NavigationSnapshot,
) {
  const pendingIntent = navigation.formData?.get("intent");
  const isActive = navigation.state !== "idle";
  const isMarkAsStock =
    pendingIntent === "mark-generated-shopping-item-as-stock" ||
    pendingIntent === "mark-family-shopping-item-as-stock";

  return {
    isOptingInAllStockItems:
      isActive && pendingIntent === "opt-in-stock-shopping-items",
    isSavingStore:
      navigation.state === "submitting" &&
      pendingIntent === "update-selected-store",
    isSavingTripFocus:
      navigation.state === "submitting" &&
      pendingIntent === "update-store-mode-trip-focus",
    optingInStockSourceKey:
      isActive && pendingIntent === "opt-in-stock-shopping-item"
        ? String(navigation.formData?.get("sourceKey") ?? "")
        : null,
    pendingMarkAsStockSourceKey:
      isActive && isMarkAsStock
        ? String(navigation.formData?.get("sourceKey") ?? "")
        : "",
  };
}

export function resolveStoreModeScanState({
  actionData,
  effectiveTripFocus,
  navigation,
  selectedStore,
  stores,
}: {
  actionData?: StoreModeActionData;
  effectiveTripFocus: StoreModeTripFocusScanValue;
  navigation: NavigationSnapshot;
  selectedStore: { id: string; name: string } | null;
  stores: Array<{ id: string; name: string }>;
}) {
  const pendingIntent = navigation.formData?.get("intent");
  const isActive = navigation.state !== "idle";
  const selectedStoreValue = resolveSelectedStoreValue(
    actionData,
    selectedStore,
  );
  const tripFocusValue = resolveTripFocusValue(actionData, effectiveTripFocus);
  const scanTripFocus = resolveScanTripFocus({
    effectiveTripFocus,
    isActive,
    pendingIntent,
    pendingTripFocusValue: navigation.formData?.get("tripFocus"),
    tripFocusValue,
  });
  const scanStoreName = resolveScanStoreName({
    isActive,
    pendingIntent,
    selectedStore,
    selectedStoreId: navigation.formData?.get("selectedStoreId"),
    selectedStoreValue,
    stores,
  });

  return {
    scanStoreName,
    scanTripFocus,
    selectedStoreFieldError:
      actionData?.intent === "update-selected-store"
        ? actionData.selectedStoreFieldErrors?.selectedStoreId
        : undefined,
    selectedStoreValue,
    tripFocusFieldError:
      actionData?.intent === "update-store-mode-trip-focus"
        ? actionData.tripFocusFieldErrors?.tripFocus
        : undefined,
    tripFocusValue,
  };
}

function resolveSelectedStoreValue(
  actionData: StoreModeActionData | undefined,
  selectedStore: { id: string } | null,
) {
  if (
    actionData?.intent === "update-selected-store" &&
    actionData.selectedStoreValue !== undefined
  ) {
    return actionData.selectedStoreValue;
  }

  return selectedStore?.id ?? "";
}

function resolveTripFocusValue(
  actionData: StoreModeActionData | undefined,
  effectiveTripFocus: StoreModeTripFocusScanValue,
) {
  if (
    actionData?.intent === "update-store-mode-trip-focus" &&
    actionData.tripFocusValue
  ) {
    return actionData.tripFocusValue;
  }

  return effectiveTripFocus;
}

function resolveScanTripFocus({
  effectiveTripFocus,
  isActive,
  pendingIntent,
  pendingTripFocusValue,
  tripFocusValue,
}: {
  effectiveTripFocus: StoreModeTripFocusScanValue;
  isActive: boolean;
  pendingIntent: FormDataEntryValue | null | undefined;
  pendingTripFocusValue: FormDataEntryValue | null | undefined;
  tripFocusValue: string;
}) {
  if (
    isActive &&
    pendingIntent === "update-store-mode-trip-focus" &&
    isStoreModeTripFocusScanValue(pendingTripFocusValue)
  ) {
    return pendingTripFocusValue;
  }

  if (isStoreModeTripFocusScanValue(tripFocusValue)) {
    return tripFocusValue;
  }

  return effectiveTripFocus;
}

function resolveScanStoreName({
  isActive,
  pendingIntent,
  selectedStore,
  selectedStoreId,
  selectedStoreValue,
  stores,
}: {
  isActive: boolean;
  pendingIntent: FormDataEntryValue | null | undefined;
  selectedStore: { id: string; name: string } | null;
  selectedStoreId: FormDataEntryValue | null | undefined;
  selectedStoreValue: string;
  stores: Array<{ id: string; name: string }>;
}) {
  const scanStoreId =
    isActive && pendingIntent === "update-selected-store"
      ? String(selectedStoreId ?? "")
      : selectedStoreValue;
  const matchingScanStore = stores.find((store) => store.id === scanStoreId);

  if (matchingScanStore) {
    return matchingScanStore.name;
  }

  if (selectedStore?.id === scanStoreId) {
    return selectedStore.name;
  }

  return "Ingen butikk";
}

export function resolveShowCategoryHeadings({
  categoryHeadingsFetcher,
  showCategoryHeadings,
}: {
  categoryHeadingsFetcher: FetcherSnapshot;
  showCategoryHeadings: boolean;
}) {
  const pendingCategoryHeadings = categoryHeadingsFetcher.formData;

  if (
    categoryHeadingsFetcher.state !== "idle" &&
    pendingCategoryHeadings?.get("intent") === "update-show-category-headings"
  ) {
    return pendingCategoryHeadings.get("showCategoryHeadings") !== "false";
  }

  const savedCategoryHeadings = categoryHeadingsFetcher.data;
  if (
    savedCategoryHeadings?.ok &&
    savedCategoryHeadings.intent === "update-show-category-headings" &&
    typeof savedCategoryHeadings.showCategoryHeadings === "boolean"
  ) {
    return savedCategoryHeadings.showCategoryHeadings;
  }

  return showCategoryHeadings;
}

export function resolveStoreModeFormFeedback({
  actionData,
  categoryFetcher,
  categoryHeadingsFetcher,
  quantityFetcher,
}: {
  actionData?: StoreModeActionData;
  categoryFetcher: FetcherSnapshot;
  categoryHeadingsFetcher: FetcherSnapshot;
  quantityFetcher: FetcherSnapshot;
}) {
  const categoryInteractionSourceKey = categoryFetcher.formData
    ? String(categoryFetcher.formData.get("sourceKey") ?? "")
    : "";
  const categoryFetcherError =
    categoryFetcher.data?.formError &&
    (categoryFetcher.data.intent === "update-family-shopping-item-category" ||
      categoryFetcher.data.intent === "update-manual-shopping-item-category")
      ? categoryFetcher.data.formError
      : null;
  const quantityFetcherError =
    quantityFetcher.data?.formError &&
    (quantityFetcher.data.intent === "update-family-shopping-item-quantity" ||
      quantityFetcher.data.intent === "update-generated-shopping-item-quantity")
      ? quantityFetcher.data.formError
      : null;
  const categoryHeadingsError =
    categoryHeadingsFetcher.data?.intent === "update-show-category-headings"
      ? categoryHeadingsFetcher.data.formError
      : undefined;

  return {
    categoryFetcherError,
    categoryInteractionSourceKey,
    generalFormError:
      categoryFetcherError ??
      quantityFetcherError ??
      categoryHeadingsError ??
      (actionData?.formError &&
      actionData.intent !== "quick-add-family-shopping-item"
        ? actionData.formError
        : undefined),
    isSavingCategorySourceKey:
      categoryFetcher.state !== "idle" ? categoryInteractionSourceKey : null,
  };
}

export function getStoreModePageClass({
  isCelebrating,
  showUndoBar,
}: {
  isCelebrating: boolean;
  showUndoBar: boolean;
}) {
  if (showUndoBar && isCelebrating) {
    return storeModePageClass.replace("pb-36", "pb-64");
  }

  if (showUndoBar || isCelebrating) {
    return storeModePageClass.replace("pb-36", "pb-52");
  }

  return storeModePageClass;
}

export function getStoreModeTripFocusSubtitle({
  effectiveTripFocus,
  includedMealPlans,
  mealPlanTitle,
}: {
  effectiveTripFocus: StoreModeTripFocusScanValue;
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
