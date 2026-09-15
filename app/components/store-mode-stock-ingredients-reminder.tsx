import type { MouseEvent } from "react";
import { Form } from "react-router";

import { formatDateOnly } from "../lib/meal-plan-dates";
import {
  storeModeStockReminderChipClass,
  storeModeStockReminderClass,
} from "../lib/store-mode-theme";

export interface StoreModeStockIngredientReminderItem {
  name: string;
  occurrenceCount: number;
  occurrences: Array<{
    date: Date | string;
    mealPlanEntryId: string;
    quantityLabel: string | null;
    recipeIngredientId: string;
    recipeTitle: string;
  }>;
  quantityLabel: string | null;
  sourceKey: string;
}

interface StoreModeStockIngredientsReminderProps {
  dismissed?: boolean;
  ingredients: StoreModeStockIngredientReminderItem[];
  isSubmittingAll?: boolean;
  onDismiss: () => void;
  onRestore: () => void;
  submittingSourceKey?: string | null;
}

export function StoreModeStockIngredientsReminder({
  dismissed = false,
  ingredients,
  isSubmittingAll = false,
  onDismiss,
  onRestore,
  submittingSourceKey = null,
}: StoreModeStockIngredientsReminderProps) {
  const handleDismiss = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onDismiss();
  };

  if (dismissed) {
    return (
      <button
        className={`${storeModeStockReminderClass} flex w-full items-center gap-3 text-left transition hover:brightness-110`}
        onClick={onRestore}
        type="button"
      >
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-notice-warning-ink">
          Vis basisvarer
        </span>
        <span className={storeModeStockReminderChipClass}>
          {ingredients.length} varer
        </span>
      </button>
    );
  }

  return (
    <details className={storeModeStockReminderClass}>
      <summary className="flex cursor-pointer list-none items-center gap-3 marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-store-accent [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-notice-warning-ink">
          Basisvarer
        </span>
        <span className={storeModeStockReminderChipClass}>
          {ingredients.length} varer
        </span>
        <button
          className="shrink-0 rounded-lg px-2 py-1 text-sm text-notice-warning-muted transition hover:bg-notice-warning-line/20 hover:text-notice-warning-ink"
          onClick={handleDismiss}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          type="button"
        >
          Skjul
        </button>
      </summary>

      <div className="mt-3 space-y-3 border-t border-notice-warning-line/60 pt-3">
        <p className="text-sm leading-6 text-notice-warning-muted">
          Disse varene er vanligvis på lager og vises ikke i handlelisten med
          mindre du legger dem til for denne turen.
        </p>
        <Form className="flex flex-wrap gap-3" method="post">
          <input
            name="intent"
            type="hidden"
            value="opt-in-stock-shopping-items"
          />
          {ingredients.map((ingredient) => (
            <input
              key={ingredient.sourceKey}
              name="sourceKey"
              type="hidden"
              value={ingredient.sourceKey}
            />
          ))}
          <button
            className="rounded-2xl bg-stone-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmittingAll}
            type="submit"
          >
            Legg til alle i handlelisten
          </button>
        </Form>
        <ul className="grid gap-3">
          {ingredients.map((ingredient) => (
            <li
              key={ingredient.sourceKey}
              className="rounded-2xl border border-notice-warning-line bg-store-surface px-4 py-3"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-store-ink">
                    {ingredient.name}
                    {ingredient.quantityLabel
                      ? ` · ${ingredient.quantityLabel}`
                      : ""}
                  </p>
                  {ingredient.occurrenceCount > 1 ? (
                    <ul className="mt-1 space-y-1 text-xs leading-5 text-store-muted">
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
                    <p className="mt-1 text-xs leading-5 text-store-muted">
                      {`Brukt i ${ingredient.occurrences[0]?.recipeTitle ?? "oppskrift"}`}
                      {ingredient.occurrences[0]?.date
                        ? ` · ${formatStockOccurrenceDate(ingredient.occurrences[0].date)}`
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
                    className="rounded-xl bg-stone-950 px-4 py-2 text-xs font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={submittingSourceKey === ingredient.sourceKey}
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
  );
}

function formatStockOccurrenceDate(date: Date | string) {
  const dateOnly =
    typeof date === "string"
      ? date.slice(0, 10)
      : formatDateOnly(date);

  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${dateOnly}T00:00:00.000Z`));
}
