import { ShoppingListCompleteCelebration } from "./shopping-list-complete-celebration";
import { ManualShoppingQuickAdd } from "./manual-shopping-quick-add";
import type { OptimisticQuickAddDraft, QuickAddShoppingSuccess } from "../lib/shopping-quick-add";
import {
  storeModeBottomChromeShellClass,
  storeModeQuickAddDockClass,
  storeModeUndoBarActionClass,
  storeModeUndoBarClass,
  storeModeUndoBarDismissClass,
} from "../lib/store-mode-theme";

export function StoreModeBottomChrome({
  familyId,
  isCelebrating,
  lastCheckedName,
  onDismissLastCheck,
  onQuickAddError,
  onQuickAddSubmit,
  onQuickAddSuccess,
  onUndoLastCheck,
  prefillRequest,
  showUndoBar,
}: {
  familyId: string;
  isCelebrating: boolean;
  lastCheckedName?: string;
  onDismissLastCheck: () => void;
  onQuickAddError: (sourceKey: string) => void;
  onQuickAddSubmit: (draft: OptimisticQuickAddDraft) => void;
  onQuickAddSuccess: (payload: QuickAddShoppingSuccess) => void;
  onUndoLastCheck: () => void;
  prefillRequest: {
    id: string;
    name: string;
    quantity: string | null;
  } | null;
  showUndoBar: boolean;
}) {
  return (
    <div className={storeModeBottomChromeShellClass}>
      <div className="pointer-events-auto mx-auto flex max-w-4xl min-w-0 flex-col gap-2">
        {isCelebrating ? (
          <ShoppingListCompleteCelebration variant="chrome" />
        ) : null}
        {showUndoBar ? (
          <div aria-live="polite" className={storeModeUndoBarClass} role="status">
            <p className="min-w-0 flex-1 truncate leading-5">
              Krysset av:{" "}
              <span className="font-semibold">{lastCheckedName}</span>
            </p>
            <button
              className={storeModeUndoBarActionClass}
              onClick={onUndoLastCheck}
              type="button"
            >
              Angre
            </button>
            <button
              aria-label="Lukk"
              className={storeModeUndoBarDismissClass}
              onClick={onDismissLastCheck}
              type="button"
            >
              ×
            </button>
          </div>
        ) : null}
        <div className={storeModeQuickAddDockClass}>
          <ManualShoppingQuickAdd
            appearance="store-mode"
            ingredientSearchPath={`/families/${familyId}/shopping/ingredient-search`}
            onQuickAddError={onQuickAddError}
            onQuickAddSubmit={onQuickAddSubmit}
            onQuickAddSuccess={onQuickAddSuccess}
            prefillRequest={prefillRequest}
            quickAddIntent="quick-add-family-shopping-item"
            revealOnFocus
          />
        </div>
      </div>
    </div>
  );
}
