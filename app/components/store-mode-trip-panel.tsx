import type { ChangeEvent } from "react";
import { Form, Link, useSubmit } from "react-router";

import type { ShoppingGroceryGroupingValue } from "../lib/shopping-grocery-grouping";
import type { StoreModeShoppingView } from "../lib/shopping-store-mode-client";
import { getStoreModeTripFocusSubtitle } from "../lib/store-mode-route-state";
import type { StoreModeTripFocusScanValue } from "../lib/shopping-store-mode-client";
import { storeModeScanPanelClass, storeModeSelectClass } from "../lib/store-mode-theme";
import { HideCategoryHeadingsToggle } from "./hide-category-headings-toggle";
import { ShoppingGroceryGroupingToggle } from "./shopping-grocery-grouping-toggle";
import { StoreModeDeprioritizeBoughtToggle } from "./store-mode-deprioritize-bought-toggle";
import { StoreModeRecipeUrgencyToggle } from "./store-mode-recipe-urgency-toggle";
import { StoreModeShoppingViewToggle } from "./store-mode-shopping-view-toggle";
import { StoreModeSimpleViewToggle } from "./store-mode-simple-view-toggle";
import { StoreModeSinkFinishedSectionsToggle } from "./store-mode-sink-finished-sections-toggle";

interface StoreModeTripPanelProps {
  canFocusNext: boolean;
  deprioritizeBought: boolean;
  familyId: string;
  groceryGrouping: ShoppingGroceryGroupingValue;
  includedMealPlans: Array<{ title: string }>;
  isSavingStore: boolean;
  isSavingTripFocus: boolean;
  mealPlanTitle: string;
  onDeprioritizeBoughtChange: (enabled: boolean) => void;
  onRecipeUrgencyChange: (enabled: boolean) => void;
  onSinkFinishedSectionsChange: (enabled: boolean) => void;
  onShoppingViewChange: (view: StoreModeShoppingView) => void;
  onShowCategoryHeadingsChange: (showCategoryHeadings: boolean) => void;
  onSimpleViewChange: (enabled: boolean) => void;
  scanTripFocus: StoreModeTripFocusScanValue;
  selectedStoreFieldError?: string;
  selectedStoreValue: string;
  shoppingView: StoreModeShoppingView;
  showCategoryHeadings: boolean;
  simpleView: boolean;
  showRecipeUrgency: boolean;
  showViewControls: boolean;
  sinkFinishedSections: boolean;
  stores: Array<{ id: string; name: string }>;
  tripFocusFieldError?: string;
  tripFocusValue: string;
}

export function StoreModeTripPanel({
  canFocusNext,
  deprioritizeBought,
  familyId,
  groceryGrouping,
  includedMealPlans,
  isSavingStore,
  isSavingTripFocus,
  mealPlanTitle,
  onDeprioritizeBoughtChange,
  onRecipeUrgencyChange,
  onSinkFinishedSectionsChange,
  onShoppingViewChange,
  onShowCategoryHeadingsChange,
  onSimpleViewChange,
  scanTripFocus,
  selectedStoreFieldError,
  selectedStoreValue,
  shoppingView,
  showCategoryHeadings,
  simpleView,
  showRecipeUrgency,
  showViewControls,
  sinkFinishedSections,
  stores,
  tripFocusFieldError,
  tripFocusValue,
}: StoreModeTripPanelProps) {
  const submit = useSubmit();
  const tripFocusSubtitle = getStoreModeTripFocusSubtitle({
    effectiveTripFocus: scanTripFocus,
    includedMealPlans,
    mealPlanTitle,
  });

  return (
    <div className={`${storeModeScanPanelClass} grid gap-6`}>
      <div className="grid gap-3">
        <div>
          <h2 className="text-base font-semibold text-store-ink">Handletur</h2>
          <p className="mt-1 text-xs text-store-muted">{tripFocusSubtitle}</p>
        </div>
        <Form className="grid gap-1" method="post">
          <span className="text-xs font-semibold text-store-muted">Fokus</span>
          <input name="intent" type="hidden" value="update-store-mode-trip-focus" />
          <select
            aria-busy={isSavingTripFocus}
            aria-label="Velg handletur-fokus"
            className={storeModeSelectClass}
            defaultValue={tripFocusValue}
            disabled={isSavingTripFocus}
            key={tripFocusValue}
            name="tripFocus"
            onChange={(event) => {
              submitSelectForm(event, tripFocusValue, submit);
            }}
          >
            <option value="CURRENT">Denne uken</option>
            <option disabled={!canFocusNext} value="NEXT">
              Neste uke
            </option>
            <option value="ALL">Alle åpne</option>
          </select>
          {tripFocusFieldError ? (
            <p className="text-sm text-rose-600">{tripFocusFieldError}</p>
          ) : null}
        </Form>
        <Form className="grid gap-1" method="post">
          <span className="text-xs font-semibold text-store-muted">Butikk</span>
          <input name="intent" type="hidden" value="update-selected-store" />
          <select
            aria-busy={isSavingStore}
            aria-label="Velg butikk"
            className={storeModeSelectClass}
            defaultValue={selectedStoreValue}
            disabled={isSavingStore}
            name="selectedStoreId"
            onChange={(event) => {
              submitSelectForm(event, selectedStoreValue, submit);
            }}
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
          {selectedStoreFieldError ? (
            <p className="text-sm text-rose-600">{selectedStoreFieldError}</p>
          ) : null}
        </Form>
        <div className="flex gap-4">
          <Link
            className="text-sm text-store-muted underline-offset-2 hover:text-store-ink hover:underline"
            to={`/families/${familyId}/store-mode/share`}
          >
            Del liste
          </Link>
          <Link
            className="text-sm text-store-muted underline-offset-2 hover:text-store-ink hover:underline"
            to={`/families/${familyId}/stores`}
          >
            Butikker
          </Link>
        </div>
      </div>
      {showViewControls || simpleView ? (
        <div className="grid gap-3">
          <h2 className="text-base font-semibold text-store-ink">Visning</h2>
          <div className="flex flex-wrap items-center gap-2">
            {showViewControls ? (
              <>
                <ShoppingGroceryGroupingToggle grouping={groceryGrouping} />
                <HideCategoryHeadingsToggle
                  hidden={!showCategoryHeadings}
                  onChange={onShowCategoryHeadingsChange}
                />
                <StoreModeDeprioritizeBoughtToggle
                  enabled={deprioritizeBought}
                  onChange={onDeprioritizeBoughtChange}
                />
                <StoreModeSinkFinishedSectionsToggle
                  enabled={sinkFinishedSections}
                  onChange={onSinkFinishedSectionsChange}
                />
                <StoreModeRecipeUrgencyToggle
                  enabled={showRecipeUrgency}
                  onChange={onRecipeUrgencyChange}
                />
                <StoreModeShoppingViewToggle
                  onChange={onShoppingViewChange}
                  view={shoppingView}
                />
              </>
            ) : null}
            <StoreModeSimpleViewToggle
              enabled={simpleView}
              onChange={onSimpleViewChange}
            />
          </div>
        </div>
      ) : null}
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
