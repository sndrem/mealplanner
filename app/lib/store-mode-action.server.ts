import { ShoppingItemSource } from "@prisma/client";
import { redirect } from "react-router";

import {
  createQuickFamilyShoppingItem,
  parseFamilyShoppingItemValues,
  parseQuickAddFamilyShoppingItemInput,
  toggleFamilyShoppingItemChecked,
  updateFamilyShoppingItem,
  updateFamilyShoppingItemQuantity,
} from "./family-shopping-write.server";
import {
  readFamilyRouteForm,
  type FamilyRouteArgs,
} from "./family-route.server";
import { resolveStoreModeAnchorMealPlan } from "./meal-plan-for-date.server";
import { parseGeneratedStockMarkTargets } from "./shopping-stock-mark";
import { serializeProjectedShoppingItem } from "./shopping-serialize";
import {
  projectCreatedFamilyShoppingItem,
  projectCreatedManualShoppingItem,
} from "./shopping.server";
import {
  markFamilyShoppingItemAsStock,
  markGeneratedShoppingItemsAsStock,
  optInStockShoppingItems,
  parseManualShoppingItemValues,
  toggleShoppingItemChecked,
  updateGeneratedShoppingItemQuantity,
  updateManualShoppingItem,
} from "./shopping-write.server";
import {
  type StoreModeActionData,
  type StoreModeIntent,
  type StoreModeNotice,
} from "./store-mode-action-data";
import {
  parseShoppingGroceryGrouping,
  parseShowCategoryHeadings,
  updateShoppingGroceryGrouping,
  updateShowCategoryHeadings,
} from "./shopping-preference-write.server";
import {
  parseStoreModeTripFocus,
  updateStoreModeTripFocus,
} from "./store-mode-trip-focus-write.server";
import { updateSelectedStorePreference } from "./store-write.server";

interface StoreModeActionContext {
  anchorMealPlanId: string;
  familyId: string;
  formData: FormData;
  intent: StoreModeIntent;
  request: Request;
  userId: string;
}

type StoreModeActionResult = StoreModeActionData | Response;

function missingStoreModeItem(intent: StoreModeIntent): StoreModeActionData {
  return {
    formError: "Vi fant ikke handlelinjen som skulle oppdateres.",
    intent,
  };
}

function completeStoreModeItemUpdate(
  intent: StoreModeIntent,
  result: { formError?: string; status: string },
): StoreModeActionData {
  if (result.status === "NOT_FOUND") {
    throw buildMealPlanNotFoundResponse();
  }

  if (result.status === "CONFLICT") {
    return {
      formError: result.formError,
      intent,
    };
  }

  return {
    intent,
    ok: true,
  };
}

function buildMealPlanNotFoundResponse() {
  return new Response("Fant ikke ukeplanen.", {
    status: 404,
    statusText: "Not Found",
  });
}

function buildFamilyStoreModeRedirect({
  familyId,
  notice,
}: {
  familyId: string;
  notice: StoreModeNotice;
  request: Request;
}) {
  const params = new URLSearchParams({ notice });

  return redirect(`/families/${familyId}/store-mode?${params}`);
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

function resolveItemMealPlanId(formData: FormData, fallbackMealPlanId: string) {
  const value = String(formData.get("itemMealPlanId") ?? "").trim();

  return value || fallbackMealPlanId;
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

function actionError(
  intent: StoreModeIntent,
  formError: string | undefined,
): StoreModeActionData {
  return {
    formError,
    intent,
  };
}

async function updateSelectedStore({
  familyId,
  formData,
  intent,
  request,
  userId,
}: StoreModeActionContext): Promise<StoreModeActionResult> {
  const selectedStoreId = String(formData.get("selectedStoreId") ?? "");
  const result = await updateSelectedStorePreference({
    familyId,
    selectedStoreId,
    userId,
  });

  if (result.status === "VALIDATION_ERROR") {
    return {
      intent,
      selectedStoreFieldErrors: result.fieldErrors,
      selectedStoreValue: result.values.selectedStoreId,
    };
  }

  return buildFamilyStoreModeRedirect({
    familyId,
    notice: "selected-store-updated",
    request,
  });
}

async function updateTripFocus({
  familyId,
  formData,
  intent,
  request,
  userId,
}: StoreModeActionContext): Promise<StoreModeActionResult> {
  const tripFocus = parseStoreModeTripFocus(formData.get("tripFocus"));

  if (!tripFocus) {
    return {
      formError: "Ugyldig fokus for butikkmodus.",
      intent,
      tripFocusFieldErrors: {
        tripFocus: "Velg et gyldig fokus.",
      },
      tripFocusValue: String(formData.get("tripFocus") ?? ""),
    };
  }

  const result = await updateStoreModeTripFocus({
    familyId,
    tripFocus,
    userId,
  });

  if (result.status === "VALIDATION_ERROR") {
    return {
      formError: result.formError,
      intent,
      tripFocusFieldErrors: {
        tripFocus: result.formError,
      },
      tripFocusValue: tripFocus,
    };
  }

  return buildFamilyStoreModeRedirect({
    familyId,
    notice: "store-mode-trip-focus-updated",
    request,
  });
}

async function updateGroceryGrouping({
  familyId,
  formData,
  intent,
  request,
  userId,
}: StoreModeActionContext): Promise<StoreModeActionResult> {
  const groceryGrouping = parseShoppingGroceryGrouping(
    formData.get("groceryGrouping"),
  );

  if (!groceryGrouping) {
    return {
      formError: "Ugyldig gruppering for handlelisten.",
      intent,
    };
  }

  const result = await updateShoppingGroceryGrouping({
    familyId,
    groceryGrouping,
    userId,
  });

  if (result.status === "VALIDATION_ERROR") {
    return actionError(intent, result.formError);
  }

  return buildFamilyStoreModeRedirect({
    familyId,
    notice: "shopping-grocery-grouping-updated",
    request,
  });
}

async function updateCategoryHeadings({
  familyId,
  formData,
  intent,
  userId,
}: StoreModeActionContext): Promise<StoreModeActionResult> {
  const showCategoryHeadings = parseShowCategoryHeadings(
    formData.get("showCategoryHeadings"),
  );

  if (showCategoryHeadings === null) {
    return {
      formError: "Ugyldig visning for kategorier.",
      intent,
    };
  }

  const result = await updateShowCategoryHeadings({
    familyId,
    showCategoryHeadings,
    userId,
  });

  if (result.status === "VALIDATION_ERROR") {
    return actionError(intent, result.formError);
  }

  return {
    intent,
    ok: true,
    showCategoryHeadings,
  };
}

async function quickAddFamilyShoppingItem({
  familyId,
  formData,
  intent,
  userId,
}: StoreModeActionContext): Promise<StoreModeActionResult> {
  const result = await createQuickFamilyShoppingItem({
    familyId,
    input: parseQuickAddFamilyShoppingItemInput(formData),
    userId,
  });

  if (result.status === "VALIDATION_ERROR") {
    return {
      formError: "formError" in result ? result.formError : undefined,
      intent,
    };
  }

  return {
    intent,
    item: serializeProjectedShoppingItem(result.item),
    ok: true,
  };
}

async function optInStockItems({
  anchorMealPlanId,
  familyId,
  formData,
  intent,
  request,
  userId,
}: StoreModeActionContext): Promise<StoreModeActionResult> {
  const sourceKeys =
    intent === "opt-in-stock-shopping-items"
      ? formData.getAll("sourceKey").map(String)
      : [String(formData.get("sourceKey") ?? "")];
  const result = await optInStockShoppingItems({
    familyId,
    mealPlanId: anchorMealPlanId,
    sourceKeys,
    userId,
  });

  if (result.status === "VALIDATION_ERROR") {
    return actionError(intent, result.formError);
  }

  if (result.status === "NOT_FOUND") {
    throw buildMealPlanNotFoundResponse();
  }

  return buildFamilyStoreModeRedirect({
    familyId,
    notice: "stock-shopping-items-opted-in",
    request,
  });
}

async function toggleFamilyItemChecked(
  context: StoreModeActionContext,
): Promise<StoreModeActionResult> {
  const familyItemId = String(context.formData.get("sourceKey") ?? "").trim();
  const checked = String(context.formData.get("checked") ?? "") === "true";

  if (!familyItemId) {
    return missingStoreModeItem(context.intent);
  }

  const result = await toggleFamilyShoppingItemChecked({
    checked,
    expectedUpdatedAt: String(context.formData.get("expectedUpdatedAt") ?? ""),
    familyId: context.familyId,
    familyItemId,
    userId: context.userId,
  });

  return completeStoreModeItemUpdate(context.intent, result);
}

async function updateFamilyItemQuantity(
  context: StoreModeActionContext,
): Promise<StoreModeActionResult> {
  const familyItemId = String(context.formData.get("sourceKey") ?? "").trim();
  const quantity = String(context.formData.get("quantity") ?? "");

  if (!familyItemId) {
    return missingStoreModeItem(context.intent);
  }

  const result = await updateFamilyShoppingItemQuantity({
    expectedUpdatedAt: String(context.formData.get("expectedUpdatedAt") ?? ""),
    familyId: context.familyId,
    familyItemId,
    quantity,
    userId: context.userId,
  });

  return completeStoreModeItemUpdate(context.intent, result);
}

async function updateGeneratedItemQuantity(
  context: StoreModeActionContext,
): Promise<StoreModeActionResult> {
  const sourceKey = String(context.formData.get("sourceKey") ?? "").trim();
  const quantity = String(context.formData.get("quantity") ?? "");

  if (!sourceKey) {
    return missingStoreModeItem(context.intent);
  }

  const itemMealPlanId = resolveItemMealPlanId(
    context.formData,
    context.anchorMealPlanId,
  );
  const result = await updateGeneratedShoppingItemQuantity({
    expectedUpdatedAt: String(context.formData.get("expectedUpdatedAt") ?? ""),
    familyId: context.familyId,
    mealPlanId: itemMealPlanId,
    quantity,
    sourceKey,
    userId: context.userId,
  });

  return completeStoreModeItemUpdate(context.intent, result);
}

async function updateFamilyItemCategory(
  context: StoreModeActionContext,
): Promise<StoreModeActionResult> {
  const familyItemId = String(context.formData.get("sourceKey") ?? "").trim();

  if (!familyItemId) {
    return missingStoreModeItem(context.intent);
  }

  const result = await updateFamilyShoppingItem({
    expectedUpdatedAt: String(context.formData.get("expectedUpdatedAt") ?? ""),
    familyId: context.familyId,
    familyItemId,
    userId: context.userId,
    values: parseFamilyShoppingItemValues(context.formData),
  });

  if (result.status === "NOT_FOUND") {
    return {
      formError: "Fant ikke varelinjen som skulle oppdateres.",
      intent: context.intent,
    };
  }

  if (result.status === "CONFLICT") {
    return actionError(context.intent, result.formError);
  }

  if (result.status === "VALIDATION_ERROR") {
    return {
      categoryFieldErrors: result.fieldErrors,
      formError: result.fieldErrors.categoryId,
      intent: context.intent,
    };
  }

  const item = await projectCreatedFamilyShoppingItem({
    familyId: context.familyId,
    familyItemId,
  });

  if (!item) {
    return {
      formError: "Fant ikke varelinjen etter oppdatering.",
      intent: context.intent,
    };
  }

  return {
    intent: context.intent,
    item: serializeProjectedShoppingItem(item),
    ok: true,
  };
}

async function updateManualItemCategory(
  context: StoreModeActionContext,
): Promise<StoreModeActionResult> {
  const manualItemId = String(context.formData.get("sourceKey") ?? "").trim();

  if (!manualItemId) {
    return missingStoreModeItem(context.intent);
  }

  const itemMealPlanId = resolveItemMealPlanId(
    context.formData,
    context.anchorMealPlanId,
  );
  const result = await updateManualShoppingItem({
    expectedUpdatedAt: String(context.formData.get("expectedUpdatedAt") ?? ""),
    familyId: context.familyId,
    manualItemId,
    mealPlanId: itemMealPlanId,
    userId: context.userId,
    values: parseManualShoppingItemValues(context.formData),
  });

  if (result.status === "NOT_FOUND") {
    throw buildMealPlanNotFoundResponse();
  }

  if (result.status === "CONFLICT") {
    return actionError(context.intent, result.formError);
  }

  if (result.status === "VALIDATION_ERROR") {
    return {
      categoryFieldErrors: result.fieldErrors,
      formError: result.fieldErrors.categoryId,
      intent: context.intent,
    };
  }

  const item = await projectCreatedManualShoppingItem({
    familyId: context.familyId,
    manualItemId,
    mealPlanId: itemMealPlanId,
  });

  if (!item) {
    return {
      formError: "Fant ikke varelinjen etter oppdatering.",
      intent: context.intent,
    };
  }

  return {
    intent: context.intent,
    item: serializeProjectedShoppingItem(item),
    ok: true,
  };
}

async function toggleShoppingItem(
  context: StoreModeActionContext,
): Promise<StoreModeActionResult> {
  const sourceKey = String(context.formData.get("sourceKey") ?? "").trim();
  const sourceType = parseShoppingItemSource(context.formData.get("sourceType"));
  const checked = String(context.formData.get("checked") ?? "") === "true";

  if (!sourceKey || !sourceType) {
    return missingStoreModeItem(context.intent);
  }

  const itemMealPlanId = resolveItemMealPlanId(
    context.formData,
    context.anchorMealPlanId,
  );
  const result = await toggleShoppingItemChecked({
    checked,
    expectedUpdatedAt: String(context.formData.get("expectedUpdatedAt") ?? ""),
    familyId: context.familyId,
    mealPlanId: itemMealPlanId,
    sourceKey,
    sourceType,
    userId: context.userId,
  });

  return completeStoreModeItemUpdate(context.intent, result);
}

async function markGeneratedItemAsStock({
  familyId,
  formData,
  intent,
  request,
  userId,
}: StoreModeActionContext): Promise<StoreModeActionResult> {
  const targets = parseGeneratedStockMarkTargets(formData);

  if (targets.length === 0) {
    return {
      formError: "Vi fant ikke varelinjen som skulle merkes som basisvare.",
      intent,
    };
  }

  const result = await markGeneratedShoppingItemsAsStock({
    familyId,
    targets,
    userId,
  });

  if (result.status === "NOT_FOUND") {
    throw buildMealPlanNotFoundResponse();
  }

  if (result.status === "VALIDATION_ERROR") {
    return actionError(intent, result.formError);
  }

  return buildFamilyStoreModeRedirect({
    familyId,
    notice: "generated-shopping-item-marked-as-stock",
    request,
  });
}

async function markFamilyItemAsStock({
  familyId,
  formData,
  intent,
  request,
  userId,
}: StoreModeActionContext): Promise<StoreModeActionResult> {
  const result = await markFamilyShoppingItemAsStock({
    expectedUpdatedAt: String(formData.get("expectedUpdatedAt") ?? ""),
    familyId,
    familyItemId: String(formData.get("familyItemId") ?? "").trim(),
    userId,
  });

  if (result.status === "NOT_FOUND") {
    return {
      formError: "Vi fant ikke varelinjen som skulle merkes som basisvare.",
      intent,
    };
  }

  if (result.status === "VALIDATION_ERROR" || result.status === "CONFLICT") {
    return actionError(intent, result.formError);
  }

  return buildFamilyStoreModeRedirect({
    familyId,
    notice: "generated-shopping-item-marked-as-stock",
    request,
  });
}

const storeModeActionHandlers: Record<
  StoreModeIntent,
  (context: StoreModeActionContext) => Promise<StoreModeActionResult>
> = {
  "mark-family-shopping-item-as-stock": markFamilyItemAsStock,
  "mark-generated-shopping-item-as-stock": markGeneratedItemAsStock,
  "opt-in-stock-shopping-item": optInStockItems,
  "opt-in-stock-shopping-items": optInStockItems,
  "quick-add-family-shopping-item": quickAddFamilyShoppingItem,
  "toggle-family-shopping-item-checked": toggleFamilyItemChecked,
  "toggle-shopping-item-checked": toggleShoppingItem,
  "update-family-shopping-item-category": updateFamilyItemCategory,
  "update-family-shopping-item-quantity": updateFamilyItemQuantity,
  "update-generated-shopping-item-quantity": updateGeneratedItemQuantity,
  "update-manual-shopping-item-category": updateManualItemCategory,
  "update-selected-store": updateSelectedStore,
  "update-shopping-grocery-grouping": updateGroceryGrouping,
  "update-show-category-headings": updateCategoryHeadings,
  "update-store-mode-trip-focus": updateTripFocus,
};

function isStoreModeIntent(value: string): value is StoreModeIntent {
  return Object.hasOwn(storeModeActionHandlers, value);
}

export async function runStoreModeAction({ params, request }: FamilyRouteArgs) {
  const route = await readFamilyRouteForm({ params, request });
  const anchorMealPlanId = await resolveStoreModeAnchorMealPlanId({
    familyId: route.familyId,
    formData: route.formData,
  });

  if (!isStoreModeIntent(route.intent)) {
    return {
      formError: "Ukjent handling.",
    } satisfies StoreModeActionData;
  }

  return storeModeActionHandlers[route.intent]({
    anchorMealPlanId,
    familyId: route.familyId,
    formData: route.formData,
    intent: route.intent,
    request,
    userId: route.user.id,
  });
}
