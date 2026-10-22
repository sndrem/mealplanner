import type { ComponentProps } from "react";

import type { StoreModeShoppingView } from "../lib/shopping-store-mode-client";
import {
  storeModeAccentBarClass,
  storeModeCelebrationHighlightClass,
  storeModeCountChipClass,
  storeModeHandletFoldClass,
  storeModeSectionCardClass,
  storeModeSurfaceCardClass,
} from "../lib/store-mode-theme";
import { StoreModeItemGrid } from "./store-mode-item-grid";
import {
  StoreModeShoppingItemCard,
  type StoreModeCategoryUpdateRequest,
} from "./store-mode-shopping-item-card";
import { StoreModeStockIngredientsReminder } from "./store-mode-stock-ingredients-reminder";

type StoreModeDueItem = ComponentProps<typeof StoreModeShoppingItemCard>["item"];

interface StoreModeDueSection<TItem> {
  boughtItems: TItem[];
  category: { id: string };
  displayName: string;
  items: TItem[];
}

interface StoreModeItemActions<TItem> {
  canMarkAsStock: boolean;
  categories: ComponentProps<typeof StoreModeShoppingItemCard>["categories"];
  categoryFetcherError: string | null;
  categoryInteractionSourceKey: string;
  isSavingCategorySourceKey: string | null;
  layout: StoreModeShoppingView;
  onQuickAddFromCard: (item: {
    name: string;
    quantityLabel: string | null;
  }) => void;
  onToggleItem: (item: TItem) => void;
  onUpdateCategory: (request: StoreModeCategoryUpdateRequest) => void;
  onUpdateQuantity: (item: {
    expectedUpdatedAt: string;
    mealPlanId?: string | null;
    quantity: string;
    sourceKey: string;
    sourceType: "FAMILY" | "GENERATED";
  }) => void;
  pendingMarkAsStockSourceKey: string;
  recentlyAddedSourceKey: string | null;
  selectedStoreId?: string;
  showRecipeUrgency: boolean;
  simpleView: boolean;
}

interface StoreModeDueListProps<TItem extends StoreModeDueItem>
  extends StoreModeItemActions<TItem> {
  activeSections: Array<StoreModeDueSection<TItem>>;
  deprioritizeBought: boolean;
  displaySectionCount: number;
  hasUncheckedDueItems: boolean;
  hasUnusedStockIngredients: boolean;
  hiddenHeadingLists: {
    boughtItems: TItem[];
    openItems: TItem[];
  } | null;
  isCelebrating: boolean;
  isOptingInAllStockItems: boolean;
  onDismissStockReminder: () => void;
  onRestoreStockReminder: () => void;
  optingInStockSourceKey: string | null;
  showCategoryHeadings: boolean;
  stockIngredients: ComponentProps<
    typeof StoreModeStockIngredientsReminder
  >["ingredients"];
  stockReminderDismissed: boolean;
}

export function StoreModeDueList<TItem extends StoreModeDueItem>({
  activeSections,
  deprioritizeBought,
  displaySectionCount,
  hasUncheckedDueItems,
  hasUnusedStockIngredients,
  hiddenHeadingLists,
  isCelebrating,
  isOptingInAllStockItems,
  onDismissStockReminder,
  onRestoreStockReminder,
  optingInStockSourceKey,
  showCategoryHeadings,
  simpleView,
  stockIngredients,
  stockReminderDismissed,
  ...itemActions
}: StoreModeDueListProps<TItem>) {
  const showStockReminder = hasUnusedStockIngredients && !simpleView;
  const itemGridActions = { ...itemActions, simpleView };
  const showShoppingSection =
    displaySectionCount > 0 ||
    (showStockReminder && !stockReminderDismissed);

  return (
    <>
      {showShoppingSection ? (
        <section className="grid gap-4">
          {showStockReminder && !stockReminderDismissed ? (
            <StoreModeStockIngredientsReminder
              ingredients={stockIngredients}
              isSubmittingAll={isOptingInAllStockItems}
              onDismiss={onDismissStockReminder}
              onRestore={onRestoreStockReminder}
              submittingSourceKey={optingInStockSourceKey}
            />
          ) : null}
          <StoreModeSectionItems
            activeSections={activeSections}
            deprioritizeBought={deprioritizeBought}
            hiddenHeadingLists={hiddenHeadingLists}
            itemActions={itemGridActions}
            showCategoryHeadings={showCategoryHeadings}
          />
          <StoreModeAllCheckedMessage
            deprioritizeBought={deprioritizeBought}
            hasActiveSections={activeSections.length > 0}
            hasUncheckedDueItems={hasUncheckedDueItems}
            isCelebrating={isCelebrating}
            showCategoryHeadings={showCategoryHeadings}
          />
          {displaySectionCount === 0 ? <StoreModeInlineEmptyState /> : null}
        </section>
      ) : (
        <StoreModePageEmptyState />
      )}
      {showStockReminder && stockReminderDismissed ? (
        <StoreModeStockIngredientsReminder
          dismissed
          ingredients={stockIngredients}
          isSubmittingAll={isOptingInAllStockItems}
          onDismiss={onDismissStockReminder}
          onRestore={onRestoreStockReminder}
          submittingSourceKey={optingInStockSourceKey}
        />
      ) : null}
    </>
  );
}

function StoreModeSectionItems<TItem extends StoreModeDueItem>({
  activeSections,
  deprioritizeBought,
  hiddenHeadingLists,
  itemActions,
  showCategoryHeadings,
}: {
  activeSections: Array<StoreModeDueSection<TItem>>;
  deprioritizeBought: boolean;
  hiddenHeadingLists: StoreModeDueListProps<TItem>["hiddenHeadingLists"];
  itemActions: StoreModeItemActions<TItem>;
  showCategoryHeadings: boolean;
}) {
  if (activeSections.length === 0) {
    return null;
  }

  if (showCategoryHeadings) {
    return (
      <>
        {activeSections.map((section) => (
          <StoreModeCategorySection
            deprioritizeBought={deprioritizeBought}
            itemActions={itemActions}
            key={`${itemActions.selectedStoreId ?? "no-store"}:${section.category.id}`}
            section={section}
          />
        ))}
      </>
    );
  }

  if (!hiddenHeadingLists) {
    return null;
  }

  return (
    <StoreModeFlatSections
      deprioritizeBought={deprioritizeBought}
      itemActions={itemActions}
      lists={hiddenHeadingLists}
    />
  );
}

function StoreModeCategorySection<TItem extends StoreModeDueItem>({
  deprioritizeBought,
  itemActions,
  section,
}: {
  deprioritizeBought: boolean;
  itemActions: StoreModeItemActions<TItem>;
  section: StoreModeDueSection<TItem>;
}) {
  const boughtFoldClass = itemActions.simpleView
    ? storeModeHandletFoldClass
    : section.items.length > 0
      ? `${storeModeHandletFoldClass} mt-4`
      : `${storeModeHandletFoldClass} mt-3`;

  if (itemActions.simpleView) {
    return (
      <section className="grid gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-store-ink">
            {section.displayName}
          </h2>
          <span aria-hidden="true" className="h-px min-w-4 flex-1 bg-store-line" />
        </div>
        {section.items.length > 0 ? (
          <StoreModeItemGrid items={section.items} {...itemActions} />
        ) : null}
        {deprioritizeBought && section.boughtItems.length > 0 ? (
          <details className={boughtFoldClass}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="text-sm font-semibold text-store-muted">Handlet</span>
              <span className={storeModeCountChipClass}>
                {section.boughtItems.length} varer
              </span>
            </summary>
            <StoreModeItemGrid items={section.boughtItems} {...itemActions} />
          </details>
        ) : null}
      </section>
    );
  }

  return (
    <details className={storeModeSectionCardClass} open>
      <div aria-hidden="true" className={storeModeAccentBarClass} />
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-store-accent [&::-webkit-details-marker]:hidden">
        <span className="text-lg font-semibold tracking-tight text-store-ink">
          {section.displayName}
        </span>
        <span className={storeModeCountChipClass}>
          {section.items.length > 0
            ? `${section.items.length} varer`
            : `${section.boughtItems.length} handlet`}
        </span>
      </summary>
      {section.items.length > 0 ? (
        <StoreModeItemGrid items={section.items} {...itemActions} />
      ) : null}
      {deprioritizeBought && section.boughtItems.length > 0 ? (
        <details className={boughtFoldClass}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="text-sm font-semibold text-store-muted">Handlet</span>
            <span className={storeModeCountChipClass}>
              {section.boughtItems.length} varer
            </span>
          </summary>
          <StoreModeItemGrid items={section.boughtItems} {...itemActions} />
        </details>
      ) : null}
    </details>
  );
}

function StoreModeFlatSections<TItem extends StoreModeDueItem>({
  deprioritizeBought,
  itemActions,
  lists,
}: {
  deprioritizeBought: boolean;
  itemActions: StoreModeItemActions<TItem>;
  lists: {
    boughtItems: TItem[];
    openItems: TItem[];
  };
}) {
  return (
    <>
      {lists.openItems.length > 0 ? (
        <StoreModeItemGrid items={lists.openItems} preserveOrder {...itemActions} />
      ) : null}
      {lists.boughtItems.length > 0 ? (
        <StoreModeBoughtFold
          deprioritizeBought={deprioritizeBought}
          itemActions={itemActions}
          items={lists.boughtItems}
        />
      ) : null}
    </>
  );
}

function StoreModeBoughtFold<TItem extends StoreModeDueItem>({
  deprioritizeBought,
  itemActions,
  items,
}: {
  deprioritizeBought: boolean;
  itemActions: StoreModeItemActions<TItem>;
  items: TItem[];
}) {
  if (!deprioritizeBought) {
    return <StoreModeItemGrid items={items} preserveOrder {...itemActions} />;
  }

  return (
    <details className={`${storeModeHandletFoldClass} mt-4`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-semibold text-store-muted">Handlet</span>
        <span className={storeModeCountChipClass}>{items.length} varer</span>
      </summary>
      <StoreModeItemGrid items={items} preserveOrder {...itemActions} />
    </details>
  );
}

function StoreModeAllCheckedMessage({
  deprioritizeBought,
  hasActiveSections,
  hasUncheckedDueItems,
  isCelebrating,
  showCategoryHeadings,
}: {
  deprioritizeBought: boolean;
  hasActiveSections: boolean;
  hasUncheckedDueItems: boolean;
  isCelebrating: boolean;
  showCategoryHeadings: boolean;
}) {
  if (!deprioritizeBought || !hasActiveSections || hasUncheckedDueItems) {
    return null;
  }

  const cardClass = isCelebrating
    ? `${storeModeSurfaceCardClass} p-6 ${storeModeCelebrationHighlightClass}`
    : `${storeModeSurfaceCardClass} p-6`;

  return (
    <article className={cardClass}>
      <h3 className="text-base font-semibold text-store-ink">Alt er krysset av</h3>
      <p className="mt-3 text-sm leading-6 text-store-muted">
        {showCategoryHeadings
          ? "Du har handlet alle varene for denne turen. Åpne Handlet i hver seksjon hvis du vil se eller endre dem."
          : "Du har handlet alle varene for denne turen. Åpne Handlet hvis du vil se eller endre dem."}
      </p>
    </article>
  );
}

function StoreModeInlineEmptyState() {
  return (
    <article className={`${storeModeSurfaceCardClass} p-6`}>
      <h3 className="text-base font-semibold text-store-ink">
        Ingen varer må handles nå
      </h3>
      <p className="mt-3 text-sm leading-6 text-store-muted">
        Alt er enten ferdig handlet, utenfor uken du handler for, eller allerede
        passert.
      </p>
    </article>
  );
}

function StoreModePageEmptyState() {
  return (
    <section className={`${storeModeSurfaceCardClass} p-6`}>
      <h2 className="text-lg font-semibold tracking-tight text-store-ink">
        Ingen varer må handles nå
      </h2>
      <p className="mt-3 text-sm leading-6 text-store-muted">
        Alt er enten ferdig handlet, utenfor uken du handler for, eller allerede
        passert.
      </p>
    </section>
  );
}
