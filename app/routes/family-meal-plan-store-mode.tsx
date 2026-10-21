import {
  redirect,
  useFetcher,
  useNavigation,
  useRevalidator,
  type MetaFunction,
} from "react-router";

import { FamilyUnexpectedError } from "../components/family-page";
import { StoreModeBottomChrome } from "../components/store-mode-bottom-chrome";
import { StoreModeDueList } from "../components/store-mode-due-list";
import { StoreModeHistory } from "../components/store-mode-history";
import { StoreModeScanBar } from "../components/store-mode-scan-bar";
import { StoreModeStatusBanners } from "../components/store-mode-status-banners";
import { StoreModeSyncOverlay } from "../components/store-mode-sync-overlay";
import { StoreModeTripPanel } from "../components/store-mode-trip-panel";
import { requireUser } from "../lib/auth.server";
import { formatDateOnly } from "../lib/meal-plan-dates";
import {
  getNextCalendarWeekBounds,
  getTodayDateOnly,
} from "../lib/meal-plan-week";
import { requireFamilyId } from "../lib/require-family-id";
import { listShoppingCheckHistoryForStoreMode } from "../lib/shopping-check-history.server";
import { serializeProjectedShoppingItem } from "../lib/shopping-serialize";
import { getFamilyStoreModeData } from "../lib/shopping.server";
import { getStoreModeTripFocusScanLabel } from "../lib/shopping-store-mode-client";
import type { StoreModeActionData } from "../lib/store-mode-action-data";
import { runStoreModeAction } from "../lib/store-mode-action.server";
import {
  getStoreModeNotice,
  readStoreModeNoticeContent,
} from "../lib/store-mode-notice";
import {
  getStoreModePageClass,
  isStoreModeRevalidatePaused,
  resolveStoreModeFormFeedback,
  resolveStoreModePendingNavigation,
  resolveStoreModeScanState,
} from "../lib/store-mode-route-state";
import { selectStoreOfferBriefing } from "../lib/store-offer-briefing";
import { listStoreOfferBriefingsForStoreMode } from "../lib/store-offer-briefing.server";
import {
  storeModePageClass,
  storeModeSurfaceCardClass,
} from "../lib/store-mode-theme";
import { listIngredientCategories } from "../lib/store.server";
import { useDebouncedRevalidate } from "../lib/use-debounced-revalidate";
import { useStoreModeDueList } from "../lib/use-store-mode-due-list";
import { useStoreModePreferences } from "../lib/use-store-mode-preferences";
import { useStoreModeShoppingView } from "../lib/use-store-mode-shopping-view";
import { useStoreModeToggleSync } from "../lib/use-store-mode-toggle-sync";
import { useStoreModeUndoCheck } from "../lib/use-store-mode-undo-check";
import { useVisibleIntervalRevalidate } from "../lib/use-visible-interval-revalidate";
import type { Route } from "./+types/family-meal-plan-store-mode";

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
  const familyId = requireFamilyId(params.familyId);
  const storeModeDataPromise = getFamilyStoreModeData({
    familyId,
    userId: user.id,
  });
  const [result, categories] = await Promise.all([
    storeModeDataPromise,
    listIngredientCategories(),
  ]);

  if (!result) {
    throw redirect(`/families/${familyId}/meal-plans`);
  }

  const [shoppingHistory, storeOfferBriefings] = await Promise.all([
    listShoppingCheckHistoryForStoreMode({
      familyId,
      mealPlanIds: result.includedMealPlans.map((plan) => plan.id),
    }),
    listStoreOfferBriefingsForStoreMode({
      familyId,
      focusedDates: result.visibleDates,
      userId: user.id,
    }),
  ]);

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
    groceryGrouping: result.groceryGrouping,
    showCategoryHeadings: result.showCategoryHeadings,
    includedMealPlans: result.includedMealPlans,
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
    shoppingHistory,
    stockIngredientsForStoreMode: result.stockIngredientsForStoreMode,
    storeOfferBriefing: selectStoreOfferBriefing({
      briefings: storeOfferBriefings,
      focusedDates: result.visibleDates,
      nextWeek: getNextCalendarWeekBounds(),
      today: getTodayDateOnly(),
    }),
    stores: result.stores,
    tripFocus: result.tripFocus,
    userRole: result.userRole,
    visibleDates: result.visibleDates,
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  return runStoreModeAction({ params, request });
}

export default function FamilyMealPlanStoreModeRoute({
  actionData,
  loaderData,
}: FamilyMealPlanStoreModeRouteProps) {
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const scheduleRevalidate = useDebouncedRevalidate(revalidator.revalidate);
  const toggleFetcher = useFetcher<StoreModeActionData>();
  const quantityFetcher = useFetcher<StoreModeActionData>();
  const categoryFetcher = useFetcher<StoreModeActionData>();
  const categoryHeadingsFetcher = useFetcher<StoreModeActionData>();
  const pending = resolveStoreModePendingNavigation(navigation);
  const dueList = useStoreModeDueList({
    categories: loaderData.categories,
    categoryFetcher,
    initialSections: loaderData.dueSectionGroups,
    quantityFetcher,
    scheduleRevalidate,
  });
  const preferences = useStoreModePreferences({
    familyId: loaderData.family.id,
    mealPlanId: loaderData.mealPlan.id,
  });
  const { displayItemsBySourceKey, handleToggle, syncBannerMessage } =
    useStoreModeToggleSync({
      activeShoppingDate: loaderData.activeShoppingDate,
      familyId: loaderData.family.id,
      loaderItems: dueList.loaderDueItems,
      revalidate: revalidator.revalidate,
      toggleFetcher,
    });
  const shoppingView = useStoreModeShoppingView({
    categoryHeadingsFetcher,
    deprioritizeBought: preferences.deprioritizeBought,
    displayItemsBySourceKey,
    dueSectionGroups: dueList.dueSectionGroups,
    loaderDueItems: dueList.loaderDueItems,
    pendingMarkAsStockSourceKey: pending.pendingMarkAsStockSourceKey,
    showCategoryHeadings: loaderData.showCategoryHeadings,
  });
  const undo = useStoreModeUndoCheck({
    displayItemsBySourceKey,
    handleToggle,
  });

  useVisibleIntervalRevalidate({
    paused: isStoreModeRevalidatePaused({
      categoryFetcher,
      categoryHeadingsFetcher,
      navigation,
      quantityFetcher,
      revalidator,
      toggleFetcher,
    }),
    revalidate: revalidator.revalidate,
  });

  const scan = resolveStoreModeScanState({
    actionData,
    effectiveTripFocus: loaderData.effectiveTripFocus,
    navigation,
    selectedStore: loaderData.selectedStore,
    stores: loaderData.stores,
  });
  const formFeedback = resolveStoreModeFormFeedback({
    actionData,
    categoryFetcher,
    categoryHeadingsFetcher,
    quantityFetcher,
  });

  return (
    <main
      className={getStoreModePageClass({
        isCelebrating: shoppingView.isCelebrating,
        showUndoBar: undo.lastCheckedAction !== null,
      })}
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <StoreModeScanBar
          checkedCount={shoppingView.displayProgress.checkedCount}
          focusLabel={getStoreModeTripFocusScanLabel(scan.scanTripFocus)}
          isCelebrating={shoppingView.isCelebrating}
          storeName={scan.scanStoreName}
          totalCount={shoppingView.displayProgress.totalCount}
        >
          <StoreModeTripPanel
            canFocusNext={loaderData.canFocusNext}
            deprioritizeBought={preferences.deprioritizeBought}
            familyId={loaderData.family.id}
            groceryGrouping={loaderData.groceryGrouping}
            includedMealPlans={loaderData.includedMealPlans}
            isSavingStore={pending.isSavingStore}
            isSavingTripFocus={pending.isSavingTripFocus}
            mealPlanTitle={loaderData.mealPlan.title}
            onDeprioritizeBoughtChange={preferences.handleDeprioritizeBoughtChange}
            onRecipeUrgencyChange={preferences.handleRecipeUrgencyChange}
            onShoppingViewChange={preferences.handleShoppingViewChange}
            onShowCategoryHeadingsChange={
              shoppingView.handleShowCategoryHeadingsChange
            }
            scanTripFocus={scan.scanTripFocus}
            selectedStoreFieldError={scan.selectedStoreFieldError}
            selectedStoreValue={scan.selectedStoreValue}
            shoppingView={preferences.shoppingView}
            showCategoryHeadings={shoppingView.showCategoryHeadings}
            showRecipeUrgency={preferences.showRecipeUrgency}
            showViewControls={shoppingView.displaySectionGroups.length > 0}
            stores={loaderData.stores}
            tripFocusFieldError={scan.tripFocusFieldError}
            tripFocusValue={scan.tripFocusValue}
          />
        </StoreModeScanBar>
        <StoreModeStatusBanners
          familyId={loaderData.family.id}
          formError={formFeedback.generalFormError}
          notice={readStoreModeNoticeContent(loaderData.notice)}
          storeOfferBriefing={loaderData.storeOfferBriefing}
        />
        <StoreModeDueList
          activeSections={shoppingView.activeSections}
          canMarkAsStock={loaderData.userRole === "ADMIN"}
          categories={loaderData.categories}
          categoryFetcherError={formFeedback.categoryFetcherError}
          categoryInteractionSourceKey={formFeedback.categoryInteractionSourceKey}
          deprioritizeBought={preferences.deprioritizeBought}
          displaySectionCount={shoppingView.displaySectionGroups.length}
          hasUncheckedDueItems={shoppingView.hasUncheckedDueItems}
          hasUnusedStockIngredients={
            loaderData.stockIngredientsForStoreMode.length > 0
          }
          hiddenHeadingLists={shoppingView.hiddenHeadingLists}
          isCelebrating={shoppingView.isCelebrating}
          isOptingInAllStockItems={pending.isOptingInAllStockItems}
          isSavingCategorySourceKey={formFeedback.isSavingCategorySourceKey}
          layout={preferences.shoppingView}
          onDismissStockReminder={preferences.handleDismissStockReminder}
          onQuickAddFromCard={dueList.handleQuickAddFromCard}
          onRestoreStockReminder={preferences.handleRestoreStockReminder}
          onToggleItem={undo.handleToggleWithUndoFeedback}
          onUpdateCategory={dueList.handleUpdateCategory}
          onUpdateQuantity={dueList.handleUpdateQuantity}
          optingInStockSourceKey={pending.optingInStockSourceKey}
          pendingMarkAsStockSourceKey={pending.pendingMarkAsStockSourceKey}
          recentlyAddedSourceKey={dueList.recentlyAddedSourceKey}
          selectedStoreId={loaderData.selectedStore?.id}
          showCategoryHeadings={shoppingView.showCategoryHeadings}
          showRecipeUrgency={preferences.showRecipeUrgency}
          stockIngredients={loaderData.stockIngredientsForStoreMode}
          stockReminderDismissed={preferences.stockReminderDismissed}
        />
        <StoreModeHistory events={loaderData.shoppingHistory} />
      </div>
      <StoreModeSyncOverlay message={syncBannerMessage} />
      <StoreModeBottomChrome
        familyId={loaderData.family.id}
        isCelebrating={shoppingView.isCelebrating}
        lastCheckedName={undo.lastCheckedAction?.name}
        onDismissLastCheck={undo.handleDismissLastCheck}
        onQuickAddError={dueList.handleQuickAddError}
        onQuickAddSubmit={dueList.handleQuickAddSubmit}
        onQuickAddSuccess={dueList.handleQuickAddSuccess}
        onUndoLastCheck={undo.handleUndoLastCheck}
        prefillRequest={dueList.quickAddPrefillRequest}
        showUndoBar={undo.lastCheckedAction !== null}
      />
    </main>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  return (
    <FamilyUnexpectedError
      cardClassName={`mx-auto max-w-2xl ${storeModeSurfaceCardClass} p-8`}
      error={error}
      fallbackMessage="Vi klarte ikke å laste butikkmodus akkurat nå."
      messageClassName="mt-3 text-sm leading-6 text-store-muted"
      notFoundTitle="Fant ikke ukeplanen"
      pageClassName={`${storeModePageClass} py-16`}
      titleClassName="text-2xl font-semibold text-store-ink"
    />
  );
}
