import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useFetcher, useNavigation, useSubmit } from "react-router";

import type { RecentManualShoppingItem } from "../lib/shopping.server";

export interface IngredientSearchResult {
  canonicalName: string;
  defaultCategoryId: string | null;
  id: string;
}

interface ManualShoppingQuickAddLoaderSlice {
  ingredientSearchResults: IngredientSearchResult[];
}

interface ManualShoppingQuickAddProps {
  ingredientSearchPath: string;
  quickAddIntent?: string;
  recentManualItems: RecentManualShoppingItem[];
}

const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_QUICK_ADD_INTENT = "quick-add-manual-shopping-item";

export function ManualShoppingQuickAdd({
  ingredientSearchPath,
  quickAddIntent = DEFAULT_QUICK_ADD_INTENT,
  recentManualItems,
}: ManualShoppingQuickAddProps) {
  const listboxId = useId();
  const navigation = useNavigation();
  const submit = useSubmit();
  const searchFetcher = useFetcher<ManualShoppingQuickAddLoaderSlice>({
    key: "manual-shopping-ingredient-search",
  });
  const [query, setQuery] = useState("");
  const [isListOpen, setIsListOpen] = useState(false);
  const [displayedResults, setDisplayedResults] = useState<IngredientSearchResult[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastRequestedQueryRef = useRef<string | null>(null);
  const searchFetcherRef = useRef(searchFetcher);
  searchFetcherRef.current = searchFetcher;
  const pendingIntent = navigation.formData?.get("intent");
  const isQuickAdding =
    navigation.state === "submitting" && pendingIntent === quickAddIntent;

  const trimmedQuery = query.trim();
  const isSearching =
    searchFetcher.state === "loading" && trimmedQuery.length >= MIN_SEARCH_LENGTH;

  function submitQuickAdd(fields: {
    ingredientId?: string;
    name?: string;
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

    submit(formData, { method: "post" });
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
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (!isQuickAdding) {
      return;
    }

    setIsListOpen(false);
    setQuery("");
    lastRequestedQueryRef.current = null;
  }, [isQuickAdding]);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <label className="block text-sm font-medium text-slate-700" htmlFor={`${listboxId}-input`}>
          Legg til vare
        </label>
        <p className="text-sm leading-6 text-slate-600">
          Søk i ingrediensregisteret, skriv et nytt navn, eller velg en nylig brukt vare.
        </p>
      </div>

      <div className="relative" ref={containerRef}>
        <div className="flex gap-2">
          <input
            aria-autocomplete="list"
            aria-controls={showDropdown ? listboxId : undefined}
            aria-expanded={showDropdown}
            className="min-w-0 flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            id={`${listboxId}-input`}
            name="quickAddQuery"
            onChange={(event) => {
              setQuery(event.target.value);
              setIsListOpen(true);
            }}
            onFocus={() => {
              setIsListOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setIsListOpen(false);
                return;
              }

              if (event.key === "Enter" && trimmedQuery && !isQuickAdding) {
                event.preventDefault();
                submitQuickAdd({ name: trimmedQuery });
              }
            }}
            placeholder="For eksempel melk"
            type="search"
            value={query}
          />
          <button
            className="inline-flex h-full shrink-0 items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={!trimmedQuery || isQuickAdding}
            onClick={() => {
              submitQuickAdd({ name: trimmedQuery });
            }}
            type="button"
          >
            {isQuickAdding ? "Legger til..." : "Legg til"}
          </button>
        </div>

        {showDropdown ? (
          <ul
            className="absolute z-10 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white py-2 shadow-lg"
            id={listboxId}
            role="listbox"
          >
            {isSearching ? (
              <li className="px-4 py-2 text-sm text-slate-500" role="presentation">
                Søker...
              </li>
            ) : null}
            {displayedResults.map((ingredient) => (
              <li key={ingredient.id} role="option">
                <button
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isQuickAdding}
                  onClick={() => {
                    submitQuickAdd({ ingredientId: ingredient.id });
                  }}
                  type="button"
                >
                  <span className="font-medium">{ingredient.canonicalName}</span>
                  <span className="text-xs text-slate-500">Fra register</span>
                </button>
              </li>
            ))}
            {showCreateOption ? (
              <li role="option">
                <button
                  className="flex w-full px-4 py-3 text-left text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isQuickAdding}
                  onClick={() => {
                    submitQuickAdd({ name: trimmedQuery });
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

      {recentManualItems.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Nylig brukt</p>
          <div className="flex flex-wrap gap-2">
            {recentManualItems.map((item) => (
              <button
                key={item.nameNormalized}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isQuickAdding}
                onClick={() => {
                  submitQuickAdd({ recentNameNormalized: item.nameNormalized });
                }}
                type="button"
              >
                {item.displayName}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
