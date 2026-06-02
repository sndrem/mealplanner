import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";

import type { QuickAddShoppingActionData, QuickAddShoppingSuccess } from "../lib/shopping-quick-add";
import { isQuickAddShoppingSuccess } from "../lib/shopping-quick-add";
import type { RecentManualShoppingItem } from "../lib/shopping.server";

export interface IngredientSearchResult {
  canonicalName: string;
  defaultCategoryId: string | null;
  id: string;
}

interface ManualShoppingQuickAddLoaderSlice {
  ingredientSearchResults: IngredientSearchResult[];
}

type ManualShoppingQuickAddAppearance = "default" | "store-mode";

interface ManualShoppingQuickAddProps {
  appearance?: ManualShoppingQuickAddAppearance;
  autoFocus?: boolean;
  ingredientSearchPath: string;
  onQuickAddSuccess?: (payload: QuickAddShoppingSuccess) => void;
  quickAddIntent?: string;
  recentManualItems: RecentManualShoppingItem[];
  /**
   * Compact docked layout: hides label/description and recently used items
   * until the input is focused, then slides them up above the input.
   * Search dropdown also opens upward. Intended for fixed bottom bars where
   * the thumb-reachable input should stay small until the user engages.
   */
  revealOnFocus?: boolean;
  searchFetcherKey?: string;
  prefillRequest?: {
    id: string;
    name: string;
    quantity?: string | null;
  } | null;
}

const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_QUICK_ADD_INTENT = "quick-add-manual-shopping-item";
const DEFAULT_SEARCH_FETCHER_KEY = "manual-shopping-ingredient-search";
const DEFAULT_QUICK_ADD_FETCHER_KEY = "manual-shopping-quick-add";

const quickAddStyles = {
  default: {
    createOption:
      "flex w-full px-4 py-3 text-left text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60",
    description: "text-sm leading-6 text-slate-600",
    dropdown:
      "absolute z-10 max-h-64 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white py-2 shadow-lg",
    dropdownUp:
      "absolute bottom-full z-10 mb-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white py-2 shadow-lg",
    error: "text-sm text-rose-600",
    input:
      "min-w-0 w-0 flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100",
    label: "block text-sm font-medium text-slate-700",
    option:
      "flex w-full items-center justify-between px-4 py-3 text-left text-sm text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60",
    optionMeta: "text-xs text-slate-500",
    recentButton:
      "rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60",
    recentLabel: "text-sm font-medium text-slate-700",
    searchPending: "px-4 py-2 text-sm text-slate-500",
    submit:
      "inline-flex h-full shrink-0 items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400",
    quantityInput:
      "w-24 shrink-0 rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100",
  },
  "store-mode": {
    createOption:
      "flex w-full px-4 py-3 text-left text-sm font-medium text-store-accent-text transition hover:bg-store-accent-light disabled:cursor-not-allowed disabled:opacity-60",
    description: "text-sm leading-6 text-stone-600",
    dropdown:
      "absolute z-10 max-h-64 w-full overflow-y-auto rounded-2xl border border-stone-200 bg-white py-2 shadow-lg",
    dropdownUp:
      "absolute bottom-full z-10 mb-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-stone-200 bg-white py-2 shadow-lg",
    error: "text-sm text-rose-600",
    input:
      "min-w-0 w-0 flex-1 rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-base text-stone-900 outline-none transition focus:border-store-accent focus:ring-4 focus:ring-store-accent-light/60",
    label: "block text-sm font-medium text-stone-700",
    option:
      "flex w-full items-center justify-between px-4 py-3 text-left text-sm text-stone-900 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60",
    optionMeta: "text-xs text-stone-500",
    recentButton:
      "rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium text-stone-800 transition hover:border-store-accent hover:bg-white disabled:cursor-not-allowed disabled:opacity-60",
    recentLabel: "text-sm font-medium text-stone-700",
    searchPending: "px-4 py-2 text-sm text-stone-500",
    submit:
      "inline-flex h-full shrink-0 items-center justify-center rounded-2xl bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400",
    quantityInput:
      "w-24 shrink-0 rounded-2xl border border-stone-300 bg-stone-50 px-3 py-3 text-sm text-stone-900 outline-none transition focus:border-store-accent focus:ring-4 focus:ring-store-accent-light/60",
  },
} as const satisfies Record<
  ManualShoppingQuickAddAppearance,
  Record<string, string>
>;

export function ManualShoppingQuickAdd({
  appearance = "default",
  autoFocus = false,
  ingredientSearchPath,
  onQuickAddSuccess,
  quickAddIntent = DEFAULT_QUICK_ADD_INTENT,
  recentManualItems,
  revealOnFocus = false,
  searchFetcherKey = DEFAULT_SEARCH_FETCHER_KEY,
  prefillRequest = null,
}: ManualShoppingQuickAddProps) {
  const styles = quickAddStyles[appearance];
  const listboxId = useId();
  const quickAddFetcher = useFetcher<QuickAddShoppingActionData>({
    key: DEFAULT_QUICK_ADD_FETCHER_KEY,
  });
  const searchFetcher = useFetcher<ManualShoppingQuickAddLoaderSlice>({
    key: searchFetcherKey,
  });
  const [query, setQuery] = useState("");
  const [quantity, setQuantity] = useState("");
  const [isListOpen, setIsListOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [displayedResults, setDisplayedResults] = useState<IngredientSearchResult[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastRequestedQueryRef = useRef<string | null>(null);
  const lastHandledQuickAddDataRef = useRef<QuickAddShoppingActionData | null>(null);
  const searchFetcherRef = useRef(searchFetcher);
  searchFetcherRef.current = searchFetcher;
  const onQuickAddSuccessRef = useRef(onQuickAddSuccess);
  onQuickAddSuccessRef.current = onQuickAddSuccess;
  const isQuickAdding = quickAddFetcher.state !== "idle";
  const trimmedQuery = query.trim();
  const quickAddActionData =
    quickAddFetcher.data?.intent === quickAddIntent ? quickAddFetcher.data : undefined;
  const quickAddFormError =
    quickAddActionData && !isQuickAddShoppingSuccess(quickAddActionData)
      ? quickAddActionData.formError
      : undefined;
  const quickAddNameError =
    quickAddActionData && !isQuickAddShoppingSuccess(quickAddActionData)
      ? quickAddActionData.manualFieldErrors?.name ??
        quickAddActionData.familyFieldErrors?.name
      : undefined;

  function submitQuickAdd(fields: {
    ingredientId?: string;
    name?: string;
    quantity?: string;
    recentNameNormalized?: string;
  }) {
    const formData = new FormData();
    formData.set("intent", quickAddIntent);

    if (fields.ingredientId) {
      formData.set("ingredientId", fields.ingredientId);
    }

    if (fields.name) {
      formData.set("name", fields.name);
    }

    if (fields.recentNameNormalized) {
      formData.set("recentNameNormalized", fields.recentNameNormalized);
    }

    if (typeof fields.quantity === "string") {
      formData.set("quantity", fields.quantity);
    }

    quickAddFetcher.submit(formData, { method: "post" });
  }

  useEffect(() => {
    if (searchFetcher.data?.ingredientSearchResults) {
      setDisplayedResults(searchFetcher.data.ingredientSearchResults);
    }
  }, [searchFetcher.data]);

  useEffect(() => {
    if (trimmedQuery.length < MIN_SEARCH_LENGTH) {
      lastRequestedQueryRef.current = null;
      setDisplayedResults([]);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (lastRequestedQueryRef.current === trimmedQuery) {
        return;
      }

      lastRequestedQueryRef.current = trimmedQuery;
      const params = new URLSearchParams({ q: trimmedQuery });
      searchFetcherRef.current.load(`${ingredientSearchPath}?${params.toString()}`);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [ingredientSearchPath, trimmedQuery]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsListOpen(false);
        setIsInputFocused(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (
      !isQuickAddShoppingSuccess(quickAddFetcher.data) ||
      quickAddFetcher.data === lastHandledQuickAddDataRef.current
    ) {
      return;
    }

    lastHandledQuickAddDataRef.current = quickAddFetcher.data;
    setIsListOpen(false);
    setIsInputFocused(false);
    setQuery("");
    setQuantity("");
    lastRequestedQueryRef.current = null;
    onQuickAddSuccessRef.current?.(quickAddFetcher.data);
  }, [quickAddFetcher.data]);

  useEffect(() => {
    if (!autoFocus) {
      return;
    }

    inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  useEffect(() => {
    if (!prefillRequest) {
      return;
    }

    setQuery(prefillRequest.name);
    setQuantity(prefillRequest.quantity?.trim() ?? "");
    setIsListOpen(false);
    setIsInputFocused(true);
    inputRef.current?.focus({ preventScroll: true });
  }, [prefillRequest]);

  const isSearching =
    searchFetcher.state === "loading" && trimmedQuery.length >= MIN_SEARCH_LENGTH;

  const hasExactMatch = useMemo(
    () =>
      displayedResults.some(
        (ingredient) =>
          ingredient.canonicalName.trim().toLowerCase() === trimmedQuery.toLowerCase(),
      ),
    [displayedResults, trimmedQuery],
  );
  const showDropdown = isListOpen && trimmedQuery.length >= MIN_SEARCH_LENGTH;
  const showCreateOption = trimmedQuery.length > 0 && !hasExactMatch && !isSearching;
  const isExpanded =
    !revealOnFocus || isInputFocused || trimmedQuery.length > 0;
  const recentsBlock =
    recentManualItems.length > 0 ? (
      <div className="space-y-2">
        <p className={styles.recentLabel}>Nylig brukt</p>
        <div className="flex flex-wrap gap-2">
          {recentManualItems.map((item) => (
            <button
              key={item.nameNormalized}
              className={styles.recentButton}
              disabled={isQuickAdding}
              onClick={() => {
                submitQuickAdd({
                  quantity,
                  recentNameNormalized: item.nameNormalized,
                });
              }}
              type="button"
            >
              {item.displayName}
            </button>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-3 overflow-x-clip" ref={containerRef}>
      <label
        className={revealOnFocus ? "sr-only" : styles.label}
        htmlFor={`${listboxId}-input`}
      >
        Legg til vare
      </label>
      {!revealOnFocus ? (
        <p className={styles.description}>
          Søk i ingrediensregisteret, skriv et nytt navn, eller velg en nylig brukt vare.
        </p>
      ) : null}

      {quickAddFormError ? <p className={styles.error}>{quickAddFormError}</p> : null}
      {quickAddNameError ? <p className={styles.error}>{quickAddNameError}</p> : null}

      {revealOnFocus && recentsBlock ? (
        <div
          aria-hidden={!isExpanded}
          className={`grid min-w-0 max-w-full transition-[grid-template-rows,opacity,transform] duration-200 ease-out ${
            isExpanded
              ? "translate-y-0 grid-rows-[1fr] opacity-100"
              : "pointer-events-none -translate-y-1 grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="min-w-0 overflow-hidden">{recentsBlock}</div>
        </div>
      ) : null}

      <div className="relative min-w-0 max-w-full">
        <div className="flex min-w-0 max-w-full gap-2">
          <input
            aria-autocomplete="list"
            aria-controls={showDropdown ? listboxId : undefined}
            aria-expanded={showDropdown}
            autoFocus={autoFocus}
            className={styles.input}
            id={`${listboxId}-input`}
            name="quickAddQuery"
            ref={inputRef}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsListOpen(true);
            }}
            onFocus={() => {
              setIsListOpen(true);
              setIsInputFocused(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setIsListOpen(false);
                return;
              }

              if (event.key === "Enter" && trimmedQuery && !isQuickAdding) {
                event.preventDefault();
                submitQuickAdd({ name: trimmedQuery, quantity });
              }
            }}
            placeholder="For eksempel melk"
            type="search"
            value={query}
          />
          <label className="sr-only" htmlFor={`${listboxId}-quantity`}>
            Mengde
          </label>
          <input
            className={styles.quantityInput}
            id={`${listboxId}-quantity`}
            inputMode="text"
            onChange={(event) => {
              setQuantity(event.target.value);
            }}
            onFocus={() => {
              setIsInputFocused(true);
            }}
            placeholder="Mengde"
            type="text"
            value={quantity}
          />
          <button
            className={styles.submit}
            disabled={!trimmedQuery || isQuickAdding}
            onClick={() => {
              submitQuickAdd({ name: trimmedQuery, quantity });
            }}
            type="button"
          >
            {isQuickAdding ? "Legger til..." : "Legg til"}
          </button>
        </div>

        {showDropdown ? (
          <ul
            className={revealOnFocus ? styles.dropdownUp : styles.dropdown}
            id={listboxId}
            role="listbox"
          >
            {isSearching ? (
              <li className={styles.searchPending} role="presentation">
                Søker...
              </li>
            ) : null}
            {displayedResults.map((ingredient) => (
              <li key={ingredient.id} role="option">
                <button
                  className={styles.option}
                  disabled={isQuickAdding}
                  onClick={() => {
                    submitQuickAdd({
                      ingredientId: ingredient.id,
                      quantity,
                    });
                  }}
                  type="button"
                >
                  <span className="font-medium">{ingredient.canonicalName}</span>
                  <span className={styles.optionMeta}>Fra register</span>
                </button>
              </li>
            ))}
            {showCreateOption ? (
              <li role="option">
                <button
                  className={styles.createOption}
                  disabled={isQuickAdding}
                  onClick={() => {
                    submitQuickAdd({ name: trimmedQuery, quantity });
                  }}
                  type="button"
                >
                  Legg til «{trimmedQuery}»
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      {!revealOnFocus && recentsBlock ? recentsBlock : null}
    </div>
  );
}
