import {
  formatGeneratedOccurrenceAttribution,
  formatGeneratedQuantityBadge,
} from "../lib/shopping-display";
import type { StoreModeShoppingView } from "../lib/shopping-store-mode-client";

interface StoreModeShoppingItemCardBase {
  checked: boolean;
  name: string;
  note: string | null;
  preferredStore: {
    id: string;
    name: string;
  } | null;
  quantityLabel: string | null;
  sourceKey: string;
}

interface StoreModeShoppingItemCardGenerated
  extends StoreModeShoppingItemCardBase {
  lastDate: string;
  occurrenceCount: number;
  occurrences: Array<{ date: string; recipeTitle: string }>;
  postponedUntilDate: string | null;
  preferredStoreConflict: boolean;
  sourceType: "GENERATED";
}

interface StoreModeShoppingItemCardManual extends StoreModeShoppingItemCardBase {
  buyOnDate: string | null;
  sourceType: "MANUAL";
}

export type StoreModeShoppingItemCardItem =
  | StoreModeShoppingItemCardGenerated
  | StoreModeShoppingItemCardManual;

interface StoreModeShoppingItemCardProps {
  item: StoreModeShoppingItemCardItem;
  layout: StoreModeShoppingView;
  onToggle: () => void;
  selectedStoreId: string | undefined;
}

export function StoreModeShoppingItemCard({
  item,
  layout,
  onToggle,
  selectedStoreId,
}: StoreModeShoppingItemCardProps) {
  const quantityBadge = formatGeneratedQuantityBadge(item);
  const recipeAttribution =
    item.sourceType === "GENERATED"
      ? item.occurrenceCount === 1
        ? (item.occurrences[0]?.recipeTitle ?? null)
        : formatGeneratedOccurrenceAttribution(item.occurrences)
      : null;
  const isGrid = layout === "grid";

  const checkedButtonClass = item.checked
    ? isGrid
      ? "flex h-full min-h-[44px] w-full cursor-pointer touch-manipulation flex-col gap-3 rounded-[20px] border border-emerald-200 bg-emerald-50 p-3 text-left transition hover:bg-emerald-100 active:bg-emerald-200"
      : "flex w-full cursor-pointer touch-manipulation items-start gap-4 rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 text-left transition hover:bg-emerald-100 active:bg-emerald-200"
    : isGrid
      ? "flex h-full min-h-[44px] w-full cursor-pointer touch-manipulation flex-col gap-3 rounded-[20px] border border-slate-200 bg-slate-50 p-3 text-left transition hover:bg-slate-100 active:bg-slate-200"
      : "flex w-full cursor-pointer touch-manipulation items-start gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-left transition hover:bg-slate-100 active:bg-slate-200";

  const checkIndicatorClass = item.checked
    ? isGrid
      ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-base font-semibold text-white"
      : "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-semibold text-white"
    : isGrid
      ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 bg-white text-base font-semibold text-slate-400"
      : "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 bg-white text-lg font-semibold text-slate-400";

  const details = (
    <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={
              isGrid
                ? "text-sm font-semibold text-slate-950"
                : "text-base font-semibold text-slate-950"
            }
          >
            {item.name}
          </span>
          {quantityBadge ? (
            <span
              className={
                item.sourceType === "GENERATED" &&
                !item.quantityLabel &&
                item.occurrenceCount > 1
                  ? "rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800"
                  : "rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
              }
            >
              {quantityBadge}
            </span>
          ) : null}
          {item.sourceType === "MANUAL" ? (
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
              Manuell
            </span>
          ) : null}
          {item.sourceType === "GENERATED" && item.preferredStoreConflict ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              Ulike foretrukne butikker
            </span>
          ) : null}
          {item.preferredStore && item.preferredStore.id !== selectedStoreId ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              Foretrekker {item.preferredStore.name}
            </span>
          ) : null}
        </span>

        <span
          className={
            isGrid
              ? "mt-2 block text-xs leading-5 text-slate-600"
              : "mt-2 block text-sm leading-6 text-slate-600"
          }
        >
          {item.sourceType === "GENERATED"
            ? item.occurrenceCount === 1
              ? `Fra ${recipeAttribution} fram til ${formatDateLabel(item.lastDate)}.`
              : `Brukt i ${recipeAttribution}.`
            : item.buyOnDate
              ? `Manuell vare planlagt for ${formatDateLabel(item.buyOnDate)}.`
              : "Manuell vare uten spesifikk handledato."}
        </span>

        {item.note ? (
          <span
            className={
              isGrid
                ? "mt-2 block text-xs leading-5 text-slate-700"
                : "mt-2 block text-sm leading-6 text-slate-700"
            }
          >
            Notat: {item.note}
          </span>
        ) : null}
        {item.sourceType === "GENERATED" && item.postponedUntilDate ? (
          <span
            className={
              isGrid
                ? "mt-2 block text-xs leading-5 text-amber-800"
                : "mt-2 block text-sm leading-6 text-amber-800"
            }
          >
            Utsatt til {formatDateLabel(item.postponedUntilDate)}.
          </span>
        ) : null}
    </span>
  );

  return (
    <div className="block h-full">
      <button
        aria-label={
          item.checked
            ? `Marker ${item.name} som ikke handlet`
            : `Marker ${item.name} som handlet`
        }
        aria-pressed={item.checked}
        className={checkedButtonClass}
        onClick={onToggle}
        type="button"
      >
        <span aria-hidden="true" className={checkIndicatorClass}>
          {item.checked ? "✓" : ""}
        </span>
        {details}
      </button>
    </div>
  );
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}
