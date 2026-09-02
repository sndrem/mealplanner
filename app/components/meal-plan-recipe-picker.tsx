import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import {
  deriveRecipeTagOptions,
  filterRecipePickerList,
  groupRecipePickerResults,
  hasActiveRecipeSearch,
} from "../lib/recipe-list-search";
import { getMealSelectionTriggerLabel, parseMealSelection } from "../lib/meal-plan-display";
import {
  RecipePickerCard,
  type RecipePickerCardFreezerItem,
  type RecipePickerCardRecipe,
} from "./recipe-picker-card";

export function MealPlanRecipePicker({
  freezerItems,
  inPlanRecipeIds,
  name,
  onChange,
  recentlyUsedRecipeIds,
  recipes,
  selectedLabel,
  triggerLabel,
  value,
}: {
  freezerItems: RecipePickerCardFreezerItem[];
  inPlanRecipeIds: ReadonlySet<string>;
  name: string;
  onChange: (value: string) => void;
  recentlyUsedRecipeIds: ReadonlySet<string>;
  recipes: RecipePickerCardRecipe[];
  selectedLabel?: string;
  triggerLabel: string;
  value: string;
}) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const parsedSelection = parseMealSelection(value);
  const buttonLabel = getMealSelectionTriggerLabel({
    emptyLabel: triggerLabel,
    fallbackLabel: selectedLabel,
    freezerItems,
    recipes,
    value,
  });
  const tagOptions = useMemo(() => deriveRecipeTagOptions(recipes), [recipes]);
  const filteredRecipes = useMemo(
    () =>
      filterRecipePickerList(recipes, {
        query: searchQuery,
        selectedTags,
      }),
    [recipes, searchQuery, selectedTags],
  );
  const groupedRecipes = useMemo(
    () =>
      groupRecipePickerResults(filteredRecipes, {
        currentRecipeId: parsedSelection.recipeId || undefined,
        inPlanRecipeIds,
        recentlyUsedRecipeIds,
      }),
    [
      filteredRecipes,
      inPlanRecipeIds,
      parsedSelection.recipeId,
      recentlyUsedRecipeIds,
    ],
  );

  const searchableFreezerItems = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();

    if (!needle) {
      return freezerItems;
    }

    return freezerItems.filter((item) => {
      const haystacks = [item.label, item.note ?? ""];

      return haystacks.some((value) => value.toLowerCase().includes(needle));
    });
  }, [freezerItems, searchQuery]);

  const hasActiveFilters =
    hasActiveRecipeSearch(searchQuery) || selectedTags.length > 0;
  const hasAnyResults =
    searchableFreezerItems.length > 0 ||
    groupedRecipes.inPlan.length > 0 ||
    groupedRecipes.recentlyUsed.length > 0 ||
    groupedRecipes.other.length > 0;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (!containerRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    searchInputRef.current?.focus();
  }, [isOpen]);

  const selectValue = (nextValue: string) => {
    onChange(nextValue);
    setIsOpen(false);
    setSearchQuery("");
    setSelectedTags([]);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((value) => value !== tag)
        : [...current, tag],
    );
  };

  return (
    <div className="relative min-w-0" ref={containerRef}>
      <input name={name} type="hidden" value={value} />
      <button
        aria-controls={isOpen ? listboxId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="mt-2 flex w-full max-w-full items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left text-sm text-slate-900 outline-none transition hover:bg-slate-50 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span className="min-w-0 truncate font-medium">{buttonLabel}</span>
        <span className="shrink-0 text-xs text-slate-400">
          {isOpen ? "Lukk" : "Velg"}
        </span>
      </button>

      {isOpen ? (
        <div
          className="mt-2 min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
          id={listboxId}
          role="listbox"
        >
          <label className="block text-xs font-medium text-slate-600">
            Søk
            <input
              autoComplete="off"
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="For eksempel tomatsuppe"
              ref={searchInputRef}
              type="search"
              value={searchQuery}
            />
          </label>

          {tagOptions.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-slate-600">Filtrer på tag</p>
              <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1">
                {tagOptions.map(({ count, tag }) => {
                  const isSelected = selectedTags.includes(tag);

                  return (
                    <button
                      key={tag}
                      className={
                        isSelected
                          ? "shrink-0 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white"
                          : "shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                      }
                      onClick={() => toggleTag(tag)}
                      type="button"
                    >
                      {tag} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {hasActiveFilters ? (
            <button
              className="mt-2 text-xs font-medium text-slate-600 underline-offset-2 hover:underline"
              onClick={() => {
                setSearchQuery("");
                setSelectedTags([]);
              }}
              type="button"
            >
              Nullstill filtre
            </button>
          ) : null}

          <div className="mt-3 max-h-72 space-y-3 overflow-y-auto overscroll-y-contain">
            <button
              className={
                value === ""
                  ? "w-full rounded-2xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-left text-sm font-medium text-emerald-900"
                  : "w-full rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-600 transition hover:bg-white"
              }
              onClick={() => selectValue("")}
              type="button"
            >
              Ingen middag valgt
            </button>

            {searchableFreezerItems.length > 0 ? (
              <PickerSection title="Fryser">
                {searchableFreezerItems.map((item) => (
                  <RecipePickerCard
                    key={item.id}
                    freezerItem={item}
                    onSelect={() => selectValue(`freezer:${item.id}`)}
                    selected={parsedSelection.freezerItemId === item.id}
                  />
                ))}
              </PickerSection>
            ) : null}

            {groupedRecipes.inPlan.length > 0 ? (
              <PickerSection title="I denne planen">
                {groupedRecipes.inPlan.map((recipe) => (
                  <RecipePickerCard
                    key={recipe.id}
                    onSelect={() => selectValue(`recipe:${recipe.id}`)}
                    recipe={recipe}
                    selected={parsedSelection.recipeId === recipe.id}
                  />
                ))}
              </PickerSection>
            ) : null}

            {groupedRecipes.recentlyUsed.length > 0 ? (
              <PickerSection title="Nylig brukt">
                {groupedRecipes.recentlyUsed.map((recipe) => (
                  <RecipePickerCard
                    key={recipe.id}
                    onSelect={() => selectValue(`recipe:${recipe.id}`)}
                    recipe={recipe}
                    selected={parsedSelection.recipeId === recipe.id}
                  />
                ))}
              </PickerSection>
            ) : null}

            {groupedRecipes.other.length > 0 ? (
              <PickerSection title="Alle oppskrifter">
                {groupedRecipes.other.map((recipe) => (
                  <RecipePickerCard
                    key={recipe.id}
                    onSelect={() => selectValue(`recipe:${recipe.id}`)}
                    recipe={recipe}
                    selected={parsedSelection.recipeId === recipe.id}
                  />
                ))}
              </PickerSection>
            ) : null}

            {!hasAnyResults ? (
              <p className="rounded-2xl bg-slate-50 px-3 py-4 text-sm text-slate-600">
                Ingen oppskrifter matcher søket.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PickerSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
