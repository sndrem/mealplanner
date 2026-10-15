import { useMemo } from "react";
import { useFetcher } from "react-router";

import { MealPlanRecipePicker } from "./meal-plan-recipe-picker";
import type { RecipePickerCardRecipe } from "./recipe-picker-card";
import { parseMealSelection } from "../lib/meal-plan-display";

export interface MealPlanExtraMealView {
  id: string;
  note: string;
  recipeId: string;
  recipeTitle: string;
  sortOrder: number;
}

interface ExtraMealActionData {
  extraFormError?: string;
  intent?: string;
  ok?: boolean;
}

export function MealPlanExtraMeals({
  entriesByDate,
  extraMeals,
  recentlyUsedRecipeIds,
  recipes,
}: {
  entriesByDate: Record<string, { recipeId: string }>;
  extraMeals: MealPlanExtraMealView[];
  recentlyUsedRecipeIds: string[];
  recipes: RecipePickerCardRecipe[];
}) {
  const addFetcher = useFetcher<ExtraMealActionData>();
  const noteFetcher = useFetcher<ExtraMealActionData>();
  const removeFetcher = useFetcher<ExtraMealActionData>();
  const recentlyUsedRecipeIdSet = useMemo(
    () => new Set(recentlyUsedRecipeIds),
    [recentlyUsedRecipeIds],
  );
  const inPlanRecipeIds = useMemo(() => {
    const ids = new Set<string>();

    for (const entry of Object.values(entriesByDate)) {
      if (entry.recipeId) {
        ids.add(entry.recipeId);
      }
    }

    for (const extraMeal of extraMeals) {
      ids.add(extraMeal.recipeId);
    }

    return ids;
  }, [entriesByDate, extraMeals]);
  const pendingRemoveId = removeFetcher.formData
    ? String(removeFetcher.formData.get("extraMealId") ?? "")
    : "";
  const pendingNoteId = noteFetcher.formData
    ? String(noteFetcher.formData.get("extraMealId") ?? "")
    : "";
  const pendingNote = noteFetcher.formData
    ? String(noteFetcher.formData.get("note") ?? "")
    : null;
  const visibleMeals = extraMeals
    .filter((extraMeal) => extraMeal.id !== pendingRemoveId)
    .map((extraMeal) =>
      extraMeal.id === pendingNoteId
        ? { ...extraMeal, note: pendingNote ?? extraMeal.note }
        : extraMeal,
    );
  const pendingRecipeId = addFetcher.formData
    ? String(addFetcher.formData.get("recipeId") ?? "")
    : "";
  const pendingRecipe = pendingRecipeId
    ? recipes.find((recipe) => recipe.id === pendingRecipeId)
    : undefined;

  if (pendingRecipe) {
    visibleMeals.push({
      id: "pending-add",
      note: "",
      recipeId: pendingRecipe.id,
      recipeTitle: pendingRecipe.title,
      sortOrder: visibleMeals.length,
    });
  }

  const formError =
    addFetcher.data?.extraFormError ||
    noteFetcher.data?.extraFormError ||
    removeFetcher.data?.extraFormError;
  const isAdding = addFetcher.state !== "idle";

  return (
    <section className="mt-6 rounded-[28px] border border-line bg-surface px-5 py-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">Ekstra denne uken</h2>
      <p className="mt-1 text-sm leading-6 text-muted">
        Måltider uten fast dag. Ingrediensene kommer med på handlelisten.
      </p>

      {formError ? (
        <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {formError}
        </p>
      ) : null}

      {visibleMeals.length > 0 ? (
        <ul className="mt-4 grid gap-3">
          {visibleMeals.map((extraMeal) => (
            <li
              key={extraMeal.id}
              className="rounded-2xl bg-page px-4 py-3 ring-1 ring-line"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 wrap-break-word font-medium text-ink">
                  {extraMeal.recipeTitle}
                </p>
                {extraMeal.id === "pending-add" ? null : (
                  <button
                    className="shrink-0 rounded-2xl px-3 py-2 text-sm font-medium text-muted ring-1 ring-line transition hover:bg-surface"
                    onClick={() => {
                      removeFetcher.submit(
                        {
                          extraMealId: extraMeal.id,
                          intent: "remove-extra-meal",
                        },
                        { method: "post" },
                      );
                    }}
                    type="button"
                  >
                    Fjern
                  </button>
                )}
              </div>
              {extraMeal.id === "pending-add" ? null : (
                <label className="mt-3 block text-sm font-medium text-muted">
                  Notat
                  <input
                    className="mt-1.5 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
                    defaultValue={extraMeal.note}
                    key={`${extraMeal.id}:${extraMeal.note}`}
                    onBlur={(event) => {
                      if (event.target.value === extraMeal.note) {
                        return;
                      }

                      noteFetcher.submit(
                        {
                          extraMealId: extraMeal.id,
                          intent: "update-extra-meal-note",
                          note: event.target.value,
                        },
                        { method: "post" },
                      );
                    }}
                    placeholder="For eksempel lunsj"
                    type="text"
                  />
                </label>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <MealPlanRecipePicker
        allowClear={false}
        freezerItems={[]}
        inPlanRecipeIds={inPlanRecipeIds}
        name="extraMealRecipeId"
        onChange={(value) => {
          if (isAdding) {
            return;
          }

          const recipeId = parseMealSelection(value).recipeId;

          if (!recipeId) {
            return;
          }

          addFetcher.submit(
            {
              intent: "add-extra-meal",
              recipeId,
            },
            { method: "post" },
          );
        }}
        recentlyUsedRecipeIds={recentlyUsedRecipeIdSet}
        recipes={recipes}
        triggerLabel="Legg til oppskrift"
        value=""
      />
    </section>
  );
}
