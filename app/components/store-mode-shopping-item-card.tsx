import { useCallback, useEffect, useRef, useState } from "react";

import {
  formatGeneratedOccurrenceAttribution,
  formatGeneratedQuantityBadge,
} from "../lib/shopping-display";
import type { StoreModeShoppingView } from "../lib/shopping-store-mode-client";
import type { StoreCategory } from "../lib/store.server";
import { ShoppingQuantityEditModal } from "./shopping-quantity-edit-modal";

interface StoreModeShoppingItemCardBase {
  category: {
    id: string;
    name: string;
  };
  checked: boolean;
  collaborationVersion: string;
  mealPlanId?: string | null;
  mealPlanTitle?: string | null;
  name: string;
  note: string | null;
  preferredStore: {
    id: string;
    name: string;
  } | null;
  quantity?: string | null;
  quantityLabel: string | null;
  sourceKey: string;
}

interface StoreModeShoppingItemCardGenerated extends StoreModeShoppingItemCardBase {
  lastDate: string;
  occurrenceCount: number;
  occurrences: Array<{ date: string; recipeTitle: string }>;
  recipeCount: number;
  postponedUntilDate: string | null;
  preferredStoreConflict: boolean;
  sourceType: "GENERATED";
}

interface StoreModeShoppingItemCardManual extends StoreModeShoppingItemCardBase {
  buyOnDate: string | null;
  sourceType: "MANUAL";
}

interface StoreModeShoppingItemCardFamily extends StoreModeShoppingItemCardBase {
  sourceType: "FAMILY";
}

export type StoreModeShoppingItemCardItem =
  | StoreModeShoppingItemCardGenerated
  | StoreModeShoppingItemCardManual
  | StoreModeShoppingItemCardFamily;

export type StoreModeCategoryUpdateRequest =
  | {
      buyOnDate: string;
      categoryId: string;
      expectedUpdatedAt: string;
      mealPlanId: string;
      name: string;
      note: string;
      preferredStoreId: string;
      quantity: string;
      sourceKey: string;
      sourceType: "MANUAL";
    }
  | {
      categoryId: string;
      expectedUpdatedAt: string;
      name: string;
      note: string;
      preferredStoreId: string;
      quantity: string;
      sourceKey: string;
      sourceType: "FAMILY";
    };

interface StoreModeShoppingItemCardProps {
  categories: StoreCategory[];
  categoryError?: string | null;
  isRecentlyAdded?: boolean;
  isSavingCategory?: boolean;
  item: StoreModeShoppingItemCardItem;
  layout: StoreModeShoppingView;
  onQuickAddFromCard?: (item: {
    name: string;
    quantityLabel: string | null;
  }) => void;
  onUpdateCategory?: (request: StoreModeCategoryUpdateRequest) => void;
  onUpdateQuantity?: (item: {
    expectedUpdatedAt: string;
    mealPlanId?: string | null;
    quantity: string;
    sourceKey: string;
    sourceType: "FAMILY" | "GENERATED";
  }) => void;
  onToggle: () => void;
  selectedStoreId: string | undefined;
}

const badgeClass = "rounded-full px-2 py-0.5 text-[11px] font-medium leading-4";
const NOTE_SAVE_DEBOUNCE_MS = 450;

export function StoreModeShoppingItemCard({
  categories,
  categoryError = null,
  isRecentlyAdded = false,
  isSavingCategory = false,
  item,
  layout: _layout,
  onQuickAddFromCard,
  onUpdateCategory,
  onUpdateQuantity,
  onToggle,
  selectedStoreId,
}: StoreModeShoppingItemCardProps) {
  const quantityBadge = formatGeneratedQuantityBadge(item);
  const shouldAutoOpenDetails = shouldAutoOpenStoreModeDetails(item);
  const [isDetailsOpen, setIsDetailsOpen] = useState(shouldAutoOpenDetails);
  const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false);
  const [quantityDraft, setQuantityDraft] = useState(item.quantityLabel ?? "");
  const [categoryDraft, setCategoryDraft] = useState(item.category.id);
  const [noteDraft, setNoteDraft] = useState(item.note ?? "");
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const showCategoryEdit =
    item.sourceType === "FAMILY" || item.sourceType === "MANUAL";
  const savedNote = item.note ?? "";
  const hasNote = Boolean(noteDraft.trim());
  const isNoteDirty = noteDraft.trim() !== savedNote.trim();

  useEffect(() => {
    setCategoryDraft(item.category.id);
  }, [item.category.id]);

  useEffect(() => {
    setNoteDraft(item.note ?? "");
    setCategoryDraft(item.category.id);
    // Only reset drafts when the card switches to a different item.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- item.note/category sync is handled elsewhere so typing is not clobbered mid-save
  }, [item.sourceKey]);

  useEffect(() => {
    const saved = item.note ?? "";
    setNoteDraft((current) =>
      current.trim() === saved.trim() ? saved : current,
    );
  }, [item.note]);

  useEffect(() => {
    if (shouldAutoOpenDetails) {
      setIsDetailsOpen(true);
    }
  }, [shouldAutoOpenDetails]);

  useEffect(() => {
    if (categoryError) {
      setCategoryDraft(item.category.id);
      setNoteDraft(item.note ?? "");
    }
  }, [categoryError, item.category.id, item.note]);

  const submitItemFields = useCallback(
    (next: { categoryId: string; note: string }) => {
      if (isSavingCategory) {
        return;
      }

      if (item.sourceType === "FAMILY") {
        onUpdateCategory?.({
          categoryId: next.categoryId,
          expectedUpdatedAt: item.collaborationVersion,
          name: item.name,
          note: next.note,
          preferredStoreId: item.preferredStore?.id ?? "",
          quantity: item.quantity?.trim() || item.quantityLabel || "",
          sourceKey: item.sourceKey,
          sourceType: "FAMILY",
        });
        return;
      }

      if (item.sourceType === "MANUAL") {
        if (!item.mealPlanId) {
          return;
        }

        onUpdateCategory?.({
          buyOnDate: item.buyOnDate ?? "",
          categoryId: next.categoryId,
          expectedUpdatedAt: item.collaborationVersion,
          mealPlanId: item.mealPlanId,
          name: item.name,
          note: next.note,
          preferredStoreId: item.preferredStore?.id ?? "",
          quantity: item.quantity?.trim() || item.quantityLabel || "",
          sourceKey: item.sourceKey,
          sourceType: "MANUAL",
        });
      }
    },
    [isSavingCategory, item, onUpdateCategory],
  );

  const handleCategoryChange = useCallback(
    (nextCategoryId: string) => {
      if (nextCategoryId === item.category.id || isSavingCategory) {
        return;
      }

      setCategoryDraft(nextCategoryId);
      submitItemFields({
        categoryId: nextCategoryId,
        note: noteDraft,
      });
    },
    [isSavingCategory, item.category.id, noteDraft, submitItemFields],
  );

  useEffect(() => {
    if (!showCategoryEdit || !isNoteDirty || isSavingCategory) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      submitItemFields({
        categoryId: categoryDraft,
        note: noteDraft,
      });
    }, NOTE_SAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    categoryDraft,
    isNoteDirty,
    isSavingCategory,
    noteDraft,
    showCategoryEdit,
    submitItemFields,
  ]);

  const cardStateClass = isRecentlyAdded
    ? "border-emerald-300 bg-emerald-100"
    : item.checked
      ? "border-red-200 bg-red-50"
      : "border-stone-200 bg-stone-50";
  const cardShellClass = `relative flex h-full min-h-[44px] flex-col rounded-2xl border p-2.5 transition-colors duration-250 ${cardStateClass}`;

  const toggleOverlayClass = item.checked
    ? "absolute inset-0 z-0 cursor-pointer touch-manipulation rounded-[inherit] transition hover:bg-red-100 active:bg-red-200"
    : "absolute inset-0 z-0 cursor-pointer touch-manipulation rounded-[inherit] transition hover:bg-stone-100 active:bg-stone-200";

  const nameClass = item.checked
    ? "text-sm font-semibold leading-5 text-stone-500 line-through decoration-stone-400"
    : "text-sm font-semibold leading-5 text-stone-950";
  const showQuantityEdit =
    item.sourceType === "FAMILY" || item.sourceType === "GENERATED";

  useEffect(() => {
    if (!isQuantityModalOpen) {
      return;
    }

    quantityInputRef.current?.focus();
    quantityInputRef.current?.select();
  }, [isQuantityModalOpen]);

  return (
    <div
      className={`scroll-mb-44 block h-full min-w-0 ${cardShellClass}`}
      data-shopping-source-key={item.sourceKey}
    >
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

      <div className="relative z-10 flex h-full min-h-[36px] min-w-0 flex-col pointer-events-none">
        <div className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="min-w-0">
              <span className={nameClass}>{item.name}</span>
              {item.sourceType !== "FAMILY" && item.mealPlanTitle ? (
                <span className="mt-0.5 block text-xs font-normal text-stone-500">
                  {item.mealPlanTitle}
                </span>
              ) : null}
            </span>
            {showQuantityEdit ? (
              <button
                className={`${badgeClass} pointer-events-auto bg-store-accent-light text-store-accent-text ring-1 ring-store-accent/40 transition hover:bg-store-accent-light/80`}
                onClick={() => {
                  setQuantityDraft(
                    item.quantity ?? item.quantityLabel ?? "",
                  );
                  setIsQuantityModalOpen(true);
                }}
                type="button"
              >
                <span className="inline-flex items-center gap-1">
                  {quantityBadge ?? "Sett mengde"}
                  <EditPencilIcon className="h-3 w-3 opacity-80" />
                </span>
              </button>
            ) : quantityBadge ? (
              <span className={`${badgeClass} bg-white text-stone-700 ring-1 ring-stone-200`}>
                {quantityBadge}
              </span>
            ) : null}
            {item.sourceType === "GENERATED" && item.recipeCount > 1 ? (
              <span className={`${badgeClass} bg-emerald-100 text-emerald-800`}>
                {item.recipeCount} oppskrifter
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
            {hasNote ? (
              <button
                aria-expanded={isDetailsOpen}
                aria-label={
                  isDetailsOpen
                    ? `Skjul notat for ${item.name}`
                    : `Vis notat for ${item.name}`
                }
                className={`${badgeClass} pointer-events-auto inline-flex items-center gap-1 bg-sky-100 text-sky-900 ring-1 ring-sky-200 transition hover:bg-sky-200/80`}
                onClick={(event) => {
                  event.stopPropagation();
                  setIsDetailsOpen((open) => !open);
                }}
                type="button"
              >
                <StoreModeNoteIcon className="h-3 w-3" />
                Notat
              </button>
            ) : null}
          </span>
        </div>

        <details
          className="group mt-auto flex w-7 min-w-7 flex-col-reverse items-stretch self-start pointer-events-auto open:w-1/2 open:min-w-[50%] open:max-w-full"
          onToggle={(event) => {
            setIsDetailsOpen(event.currentTarget.open);
          }}
          open={isDetailsOpen}
        >
          <summary
            aria-label={`Vis informasjon om ${item.name}`}
            className="mt-1 flex h-7 w-7 shrink-0 cursor-pointer list-none items-center justify-center self-start rounded-full border border-stone-200 bg-white text-stone-600 transition hover:bg-stone-100 hover:text-stone-950 group-open:border-store-accent group-open:bg-store-accent-light group-open:text-store-accent-text marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-store-accent [&::-webkit-details-marker]:hidden"
          >
            <StoreModeInfoIcon className="h-3.5 w-3.5" />
            <span className="sr-only">Vis informasjon</span>
          </summary>
          <div
            className="mb-1 w-full min-w-0 space-y-1.5 border-b border-stone-200 pb-1.5 pointer-events-auto"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <p className="break-words text-xs leading-4 text-stone-600">
              {formatStoreModeItemSourceLine(item)}
            </p>
            {!showCategoryEdit && item.note ? (
              <p className="break-words text-xs leading-4 text-stone-700">
                Notat: {item.note}
              </p>
            ) : null}
            {showCategoryEdit ? (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-stone-700">
                  Endre seksjon
                  <select
                    aria-busy={isSavingCategory}
                    className="mt-1 box-border w-full max-w-full min-w-0 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-store-accent focus:ring-4 focus:ring-store-accent-light/60 disabled:cursor-wait disabled:opacity-70"
                    disabled={isSavingCategory}
                    onChange={(event) =>
                      handleCategoryChange(event.currentTarget.value)
                    }
                    value={categoryDraft}
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-stone-700">
                  Notat
                  <input
                    aria-busy={isSavingCategory}
                    className="mt-1 box-border w-full max-w-full min-w-0 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-store-accent focus:ring-4 focus:ring-store-accent-light/60"
                    onChange={(event) => setNoteDraft(event.currentTarget.value)}
                    placeholder="F.eks. Tine lettmelk"
                    type="text"
                    value={noteDraft}
                  />
                </label>
                {categoryError ? (
                  <p className="text-xs text-rose-600">{categoryError}</p>
                ) : null}
                {isSavingCategory ? (
                  <p className="text-xs text-stone-500">Lagrer...</p>
                ) : null}
              </div>
            ) : null}
            <button
              className="inline-flex w-fit rounded-full border border-store-accent/40 bg-store-accent-light px-2.5 py-1 text-xs font-medium text-store-accent-text transition hover:border-store-accent hover:bg-store-accent-light/80"
              onClick={() =>
                onQuickAddFromCard?.({
                  name: item.name,
                  quantityLabel: item.quantityLabel,
                })
              }
              type="button"
            >
              Hurtiglegg til
            </button>
            {item.sourceType === "GENERATED" && item.postponedUntilDate ? (
              <p className="break-words text-xs leading-4 text-amber-800">
                Utsatt til {formatDateLabel(item.postponedUntilDate)}.
              </p>
            ) : null}
          </div>
        </details>
      </div>

      {isQuantityModalOpen &&
      (item.sourceType === "FAMILY" || item.sourceType === "GENERATED") ? (
        <ShoppingQuantityEditModal
          canReset={Boolean((item.quantity ?? item.quantityLabel)?.trim())}
          name={item.name}
          onCancel={() => setIsQuantityModalOpen(false)}
          onReset={() => {
            onUpdateQuantity?.({
              expectedUpdatedAt: item.collaborationVersion,
              mealPlanId: item.mealPlanId,
              quantity: "",
              sourceKey: item.sourceKey,
              sourceType: item.sourceType,
            });
            setIsQuantityModalOpen(false);
          }}
          onSave={() => {
            onUpdateQuantity?.({
              expectedUpdatedAt: item.collaborationVersion,
              mealPlanId: item.mealPlanId,
              quantity: quantityDraft,
              sourceKey: item.sourceKey,
              sourceType: item.sourceType,
            });
            setIsQuantityModalOpen(false);
          }}
          quantity={quantityDraft}
          quantityInputRef={quantityInputRef}
          setQuantity={setQuantityDraft}
        />
      ) : null}
    </div>
  );
}

function shouldAutoOpenStoreModeDetails(item: StoreModeShoppingItemCardItem) {
  if (item.sourceType === "GENERATED" && item.postponedUntilDate) {
    return true;
  }

  if (item.sourceType === "GENERATED" && item.preferredStoreConflict) {
    return true;
  }

  return false;
}

function StoreModeNoteIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7 4h7l3 3v13H7V4Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
      <path
        d="M14 4v3h3"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
      <path
        d="M9 12h6M9 16h4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

function formatStoreModeItemSourceLine(item: StoreModeShoppingItemCardItem) {
  if (item.sourceType === "FAMILY") {
    return "Følger familien på tvers av ukeplaner.";
  }

  const mealPlanAttribution = item.mealPlanTitle
    ? `Ukeplan: ${item.mealPlanTitle}. `
    : "";

  if (item.sourceType === "GENERATED") {
    const recipeAttribution =
      item.occurrenceCount === 1
        ? (item.occurrences[0]?.recipeTitle ?? null)
        : formatGeneratedOccurrenceAttribution(item.occurrences);

    return item.occurrenceCount === 1
      ? `${mealPlanAttribution}Fra ${recipeAttribution} fram til ${formatDateLabel(item.lastDate)}.`
      : `${mealPlanAttribution}Brukt i ${recipeAttribution}.`;
  }

  return item.buyOnDate
    ? `${mealPlanAttribution}Manuell vare planlagt for ${formatDateLabel(item.buyOnDate)}.`
    : `${mealPlanAttribution}Manuell vare uten spesifikk handledato.`;
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

function EditPencilIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 20h4l10-10-4-4L4 16v4Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
      <path
        d="m12 6 4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}
