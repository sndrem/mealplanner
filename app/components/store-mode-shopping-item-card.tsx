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

interface StoreModeShoppingItemCardGenerated extends StoreModeShoppingItemCardBase {
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

const badgeClass =
  "rounded-full px-2 py-0.5 text-[11px] font-medium leading-4";

export function StoreModeShoppingItemCard({
  item,
  layout: _layout,
  onToggle,
  selectedStoreId,
}: StoreModeShoppingItemCardProps) {
  const quantityBadge = formatGeneratedQuantityBadge(item);
  const shouldAutoOpenDetails = shouldAutoOpenStoreModeDetails(item);

  const cardShellClass = item.checked
    ? "relative flex h-full min-h-[36px] flex-col rounded-2xl border border-red-200 bg-red-50 p-2"
    : "relative flex h-full min-h-[36px] flex-col rounded-2xl border border-slate-200 bg-slate-50 p-2";

  const toggleOverlayClass = item.checked
    ? "absolute inset-0 z-0 cursor-pointer touch-manipulation rounded-[inherit] transition hover:bg-red-100 active:bg-red-200"
    : "absolute inset-0 z-0 cursor-pointer touch-manipulation rounded-[inherit] transition hover:bg-slate-100 active:bg-slate-200";

  const nameClass = item.checked
    ? "text-sm font-semibold leading-5 text-slate-500 line-through decoration-slate-400"
    : "text-sm font-semibold leading-5 text-slate-950";

  return (
    <div className={`block h-full ${cardShellClass}`}>
      <button
        aria-label={
          item.checked
            ? `Marker ${item.name} som ikke handlet`
            : `Marker ${item.name} som handlet`
        }
        aria-pressed={item.checked}
        className={toggleOverlayClass}
        onClick={onToggle}
        type="button"
      />

      <div className="relative z-10 flex h-full min-h-[32px] flex-col pointer-events-none">
        <div className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className={nameClass}>{item.name}</span>
            {quantityBadge ? (
              <span
                className={
                  item.sourceType === "GENERATED" &&
                  !item.quantityLabel &&
                  item.occurrenceCount > 1
                    ? `${badgeClass} bg-amber-100 text-amber-800`
                    : `${badgeClass} bg-white text-slate-700 ring-1 ring-slate-200`
                }
              >
                {quantityBadge}
              </span>
            ) : null}
            {item.sourceType === "GENERATED" && item.preferredStoreConflict ? (
              <span className={`${badgeClass} bg-amber-100 text-amber-800`}>
                Ulike foretrukne butikker
              </span>
            ) : null}
            {item.preferredStore &&
            item.preferredStore.id !== selectedStoreId ? (
              <span className={`${badgeClass} bg-amber-100 text-amber-800`}>
                Foretrekker {item.preferredStore.name}
              </span>
            ) : null}
          </span>
        </div>

        <details
          className="group mt-auto flex shrink-0 flex-col-reverse items-start pointer-events-auto"
          open={shouldAutoOpenDetails}
        >
          <summary
            aria-label={`Vis informasjon om ${item.name}`}
            className="mt-1 flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 group-open:border-emerald-200 group-open:bg-emerald-50 group-open:text-emerald-700 marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500 [&::-webkit-details-marker]:hidden"
          >
            <StoreModeInfoIcon className="h-3.5 w-3.5" />
            <span className="sr-only">Vis informasjon</span>
          </summary>
          <div
            className="mb-1 w-full space-y-1 border-b border-slate-200 pb-1.5 pointer-events-auto"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <p className="text-xs leading-4 text-slate-600">
              {formatStoreModeItemSourceLine(item)}
            </p>
            {item.note ? (
              <p className="text-xs leading-4 text-slate-700">
                Notat: {item.note}
              </p>
            ) : null}
            {item.sourceType === "GENERATED" && item.postponedUntilDate ? (
              <p className="text-xs leading-4 text-amber-800">
                Utsatt til {formatDateLabel(item.postponedUntilDate)}.
              </p>
            ) : null}
          </div>
        </details>
      </div>
    </div>
  );
}

function shouldAutoOpenStoreModeDetails(item: StoreModeShoppingItemCardItem) {
  if (item.note) {
    return true;
  }

  if (item.sourceType === "GENERATED" && item.postponedUntilDate) {
    return true;
  }

  if (item.sourceType === "GENERATED" && item.preferredStoreConflict) {
    return true;
  }

  return false;
}

function formatStoreModeItemSourceLine(item: StoreModeShoppingItemCardItem) {
  if (item.sourceType === "GENERATED") {
    const recipeAttribution =
      item.occurrenceCount === 1
        ? (item.occurrences[0]?.recipeTitle ?? null)
        : formatGeneratedOccurrenceAttribution(item.occurrences);

    return item.occurrenceCount === 1
      ? `Fra ${recipeAttribution} fram til ${formatDateLabel(item.lastDate)}.`
      : `Brukt i ${recipeAttribution}.`;
  }

  return item.buyOnDate
    ? `Manuell vare planlagt for ${formatDateLabel(item.buyOnDate)}.`
    : "Manuell vare uten spesifikk handledato.";
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function StoreModeInfoIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 11v5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.75"
      />
      <circle cx="12" cy="8" fill="currentColor" r="0.9" />
    </svg>
  );
}
