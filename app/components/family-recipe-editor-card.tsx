import { useEffect, useMemo, useState } from "react";
import { Form, useNavigation } from "react-router";

import type {
  FamilyRecipeFieldErrors,
  FamilyRecipeIngredientValues,
  FamilyRecipeValues,
} from "../lib/recipe-write.server";

interface RecipeCategory {
  displayName: string;
  id: string;
}

interface RecipeStore {
  id: string;
  name: string;
}

interface DraftIngredientRow extends FamilyRecipeIngredientValues {
  key: string;
}

interface FamilyRecipeEditorCardProps {
  canManageRecipes: boolean;
  categories: RecipeCategory[];
  familyStores: RecipeStore[];
  mealPlanEntryCount: number;
  recipe: {
    defaultServings: number | null;
    description: string | null;
    id: string;
    ingredients: Array<{
      amount: string | null;
      categoryId: string;
      displayName: string;
      preferredStoreId: string | null;
      unit: string | null;
    }>;
    prepMinutes: number | null;
    tags: string[];
    title: string;
  };
  updateFieldErrors?: FamilyRecipeFieldErrors;
  updateValues?: FamilyRecipeValues;
}

export function FamilyRecipeEditorCard({
  canManageRecipes,
  categories,
  familyStores,
  mealPlanEntryCount,
  recipe,
  updateFieldErrors,
  updateValues,
}: FamilyRecipeEditorCardProps) {
  const navigation = useNavigation();
  const pendingIntent = navigation.formData?.get("intent");
  const pendingRecipeId = String(navigation.formData?.get("recipeId") ?? "");
  const isUpdatingRecipe =
    navigation.state === "submitting" &&
    pendingIntent === "update-recipe" &&
    pendingRecipeId === recipe.id;
  const isDeletingRecipe =
    navigation.state === "submitting" &&
    pendingIntent === "delete-recipe" &&
    pendingRecipeId === recipe.id;
  const persistedValues = useMemo<FamilyRecipeValues>(
    () => toRecipeValues(recipe),
    [recipe],
  );
  const [ignoreSubmittedValues, setIgnoreSubmittedValues] = useState(false);
  const sourceValues =
    updateValues && !ignoreSubmittedValues ? updateValues : persistedValues;
  const [isEditing, setIsEditing] = useState(Boolean(updateValues));
  const [draftValues, setDraftValues] = useState(sourceValues);

  useEffect(() => {
    if (updateValues) {
      setIgnoreSubmittedValues(false);
    }
  }, [updateValues]);

  useEffect(() => {
    setDraftValues(sourceValues);
  }, [sourceValues]);

  const draftIngredients = useMemo(
    () => toDraftIngredients(draftValues.ingredients),
    [draftValues.ingredients],
  );

  function handleCancelEditing() {
    setIgnoreSubmittedValues(true);
    setDraftValues(persistedValues);
    setIsEditing(false);
  }

  function updateIngredient(
    key: string,
    patch: Partial<FamilyRecipeIngredientValues>,
  ) {
    const index = draftIngredients.findIndex((row) => row.key === key);

    if (index === -1) {
      return;
    }

    setDraftValues((current) => {
      const nextIngredients = [...current.ingredients];
      nextIngredients[index] = {
        ...nextIngredients[index],
        ...patch,
      };

      return {
        ...current,
        ingredients: nextIngredients,
      };
    });
  }

  function addIngredient() {
    const defaultCategoryId = categories[0]?.id ?? "";

    setDraftValues((current) => ({
      ...current,
      ingredients: [
        ...current.ingredients,
        {
          amount: "",
          categoryId: defaultCategoryId,
          displayName: "",
          preferredStoreId: "",
          unit: "",
        },
      ],
    }));
  }

  function removeIngredient(key: string) {
    const index = draftIngredients.findIndex((row) => row.key === key);

    if (index === -1) {
      return;
    }

    setDraftValues((current) => ({
      ...current,
      ingredients: current.ingredients.filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  function moveIngredient(key: string, direction: "up" | "down") {
    const index = draftIngredients.findIndex((row) => row.key === key);

    if (index === -1) {
      return;
    }

    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= draftIngredients.length) {
      return;
    }

    setDraftValues((current) => {
      const nextIngredients = [...current.ingredients];
      const [moved] = nextIngredients.splice(index, 1);
      nextIngredients.splice(targetIndex, 0, moved);

      return {
        ...current,
        ingredients: nextIngredients,
      };
    });
  }

  return (
    <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
            Familieoppskrift
          </span>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950">{recipe.title}</h2>
          {mealPlanEntryCount > 0 ? (
            <p className="mt-2 text-sm text-slate-600">
              Brukt i {mealPlanEntryCount}{" "}
              {mealPlanEntryCount === 1 ? "ukeplan" : "ukeplaner"}
            </p>
          ) : null}
        </div>
        {canManageRecipes && !isEditing ? (
          <button
            className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            onClick={() => setIsEditing(true)}
            type="button"
          >
            Rediger oppskrift
          </button>
        ) : null}
      </div>

      {canManageRecipes && isEditing ? (
        <Form className="mt-6 space-y-6" method="post">
          <input name="intent" type="hidden" value="update-recipe" />
          <input name="recipeId" type="hidden" value={recipe.id} />
          <RecipeFields
            categories={categories}
            draftIngredients={draftIngredients}
            draftValues={draftValues}
            familyStores={familyStores}
            fieldErrors={updateFieldErrors}
            onAddIngredient={addIngredient}
            onMoveIngredient={moveIngredient}
            onRemoveIngredient={removeIngredient}
            onUpdateIngredient={updateIngredient}
            setDraftValues={setDraftValues}
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="inline-flex flex-1 items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={isUpdatingRecipe}
              type="submit"
            >
              {isUpdatingRecipe ? "Lagrer..." : "Lagre oppskrift"}
            </button>
            <button
              className="inline-flex flex-1 items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-medium text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-50"
              onClick={handleCancelEditing}
              type="button"
            >
              Avbryt
            </button>
          </div>
        </Form>
      ) : (
        <RecipeReadOnlySummary
          categories={categories}
          draftIngredients={draftIngredients}
          draftValues={draftValues}
          familyStores={familyStores}
        />
      )}

      {canManageRecipes && !isEditing ? (
        <div className="mt-4 space-y-3">
          {mealPlanEntryCount > 0 ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              Oppskriften brukes i {mealPlanEntryCount}{" "}
              {mealPlanEntryCount === 1 ? "ukeplan" : "ukeplaner"} og kan ikke
              slettes for du fjerner den fra planene.
            </p>
          ) : null}
          <Form method="post">
            <input name="intent" type="hidden" value="delete-recipe" />
            <input name="recipeId" type="hidden" value={recipe.id} />
            <button
              className="inline-flex w-full items-center justify-center rounded-2xl bg-rose-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
              disabled={isDeletingRecipe || mealPlanEntryCount > 0}
              type="submit"
            >
              {isDeletingRecipe ? "Sletter..." : "Slett oppskrift"}
            </button>
          </Form>
        </div>
      ) : null}
    </article>
  );
}

function RecipeFields({
  categories,
  draftIngredients,
  draftValues,
  familyStores,
  fieldErrors,
  onAddIngredient,
  onMoveIngredient,
  onRemoveIngredient,
  onUpdateIngredient,
  setDraftValues,
}: {
  categories: RecipeCategory[];
  draftIngredients: DraftIngredientRow[];
  draftValues: FamilyRecipeValues;
  familyStores: RecipeStore[];
  fieldErrors?: FamilyRecipeFieldErrors;
  onAddIngredient: () => void;
  onMoveIngredient: (key: string, direction: "up" | "down") => void;
  onRemoveIngredient: (key: string) => void;
  onUpdateIngredient: (
    key: string,
    patch: Partial<FamilyRecipeIngredientValues>,
  ) => void;
  setDraftValues: React.Dispatch<React.SetStateAction<FamilyRecipeValues>>;
}) {
  return (
    <>
      <label className="block text-sm font-medium text-slate-700">
        Tittel
        <input
          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          name="title"
          onChange={(event) =>
            setDraftValues((current) => ({
              ...current,
              title: event.target.value,
            }))
          }
          type="text"
          value={draftValues.title}
        />
      </label>
      {fieldErrors?.title ? (
        <p className="text-sm text-rose-600">{fieldErrors.title}</p>
      ) : null}

      <label className="block text-sm font-medium text-slate-700">
        Beskrivelse
        <textarea
          className="mt-2 min-h-24 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          name="description"
          onChange={(event) =>
            setDraftValues((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          value={draftValues.description}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Porsjoner
          <input
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            inputMode="numeric"
            name="defaultServings"
            onChange={(event) =>
              setDraftValues((current) => ({
                ...current,
                defaultServings: event.target.value,
              }))
            }
            placeholder="4"
            type="text"
            value={draftValues.defaultServings}
          />
          {fieldErrors?.defaultServings ? (
            <p className="mt-2 text-sm text-rose-600">
              {fieldErrors.defaultServings}
            </p>
          ) : null}
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Tilberedning (min)
          <input
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            inputMode="numeric"
            name="prepMinutes"
            onChange={(event) =>
              setDraftValues((current) => ({
                ...current,
                prepMinutes: event.target.value,
              }))
            }
            placeholder="30"
            type="text"
            value={draftValues.prepMinutes}
          />
          {fieldErrors?.prepMinutes ? (
            <p className="mt-2 text-sm text-rose-600">{fieldErrors.prepMinutes}</p>
          ) : null}
        </label>
      </div>

      <label className="block text-sm font-medium text-slate-700">
        Stikkord (kommaseparert)
        <input
          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          name="tags"
          onChange={(event) =>
            setDraftValues((current) => ({
              ...current,
              tags: event.target.value,
            }))
          }
          placeholder="middag, rask"
          type="text"
          value={draftValues.tags}
        />
      </label>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-950">Ingredienser</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Hver rad er én ingrediens med egen handlekategori (brukes i
              handlelisten, ikke som oppskriftstype).
            </p>
          </div>
          <button
            className="shrink-0 rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
            onClick={onAddIngredient}
            type="button"
          >
            Legg til rad
          </button>
        </div>
        {fieldErrors?.ingredients ? (
          <p className="text-sm text-rose-600">{fieldErrors.ingredients}</p>
        ) : null}

        {draftIngredients.map((row, index) => (
          <IngredientRowEditor
            categories={categories}
            familyStores={familyStores}
            index={index}
            key={row.key}
            onMove={onMoveIngredient}
            onRemove={onRemoveIngredient}
            onUpdate={onUpdateIngredient}
            row={row}
            validationError={
              fieldErrors?.ingredientDisplayNames?.[index] ??
              fieldErrors?.ingredientCategories?.[index]
            }
          />
        ))}
      </div>
    </>
  );
}

function IngredientRowEditor({
  categories,
  familyStores,
  index,
  onMove,
  onRemove,
  onUpdate,
  row,
  validationError,
}: {
  categories: RecipeCategory[];
  familyStores: RecipeStore[];
  index: number;
  onMove: (key: string, direction: "up" | "down") => void;
  onRemove: (key: string) => void;
  onUpdate: (key: string, patch: Partial<FamilyRecipeIngredientValues>) => void;
  row: DraftIngredientRow;
  validationError?: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
      <input name="ingredientIndex" type="hidden" value={String(index)} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
          Ingrediens {index + 1}
        </span>
        <button
          className="rounded-xl bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
          onClick={() => onMove(row.key, "up")}
          type="button"
        >
          Opp
        </button>
        <button
          className="rounded-xl bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
          onClick={() => onMove(row.key, "down")}
          type="button"
        >
          Ned
        </button>
        <button
          className="rounded-xl bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-200"
          onClick={() => onRemove(row.key)}
          type="button"
        >
          Fjern
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
          Navn
          <input
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
            name={`ingredientDisplayName:${index}`}
            onChange={(event) =>
              onUpdate(row.key, { displayName: event.target.value })
            }
            type="text"
            value={row.displayName}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Mengde
          <input
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
            name={`ingredientAmount:${index}`}
            onChange={(event) => onUpdate(row.key, { amount: event.target.value })}
            type="text"
            value={row.amount}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Enhet
          <input
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
            name={`ingredientUnit:${index}`}
            onChange={(event) => onUpdate(row.key, { unit: event.target.value })}
            type="text"
            value={row.unit}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Handlekategori
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Hvor varen havner i handlelisten
          </span>
          <select
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
            name={`ingredientCategoryId:${index}`}
            onChange={(event) =>
              onUpdate(row.key, { categoryId: event.target.value })
            }
            value={row.categoryId}
          >
            <option value="">Velg handlekategori</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Foretrukket butikk
          <select
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
            name={`ingredientPreferredStoreId:${index}`}
            onChange={(event) =>
              onUpdate(row.key, { preferredStoreId: event.target.value })
            }
            value={row.preferredStoreId}
          >
            <option value="">Ingen</option>
            {familyStores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {validationError ? (
        <p className="mt-2 text-sm text-rose-600">{validationError}</p>
      ) : null}
    </div>
  );
}

function RecipeReadOnlySummary({
  categories,
  draftIngredients,
  draftValues,
  familyStores,
}: {
  categories: RecipeCategory[];
  draftIngredients: DraftIngredientRow[];
  draftValues: FamilyRecipeValues;
  familyStores: RecipeStore[];
}) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const storeById = new Map(familyStores.map((store) => [store.id, store]));

  return (
    <div className="mt-6 space-y-6">
      {draftValues.description ? (
        <p className="text-sm leading-7 text-slate-600">{draftValues.description}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {draftValues.defaultServings ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {draftValues.defaultServings} porsjoner
          </span>
        ) : null}
        {draftValues.prepMinutes ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {draftValues.prepMinutes} min
          </span>
        ) : null}
        {draftValues.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
            >
              {tag}
            </span>
          ))}
      </div>
      <ol className="space-y-3">
        {draftIngredients.map((row, index) => (
          <li
            className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3"
            key={row.key}
          >
            <p className="font-medium text-slate-950">
              {index + 1}. {row.displayName}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {[row.amount, row.unit].filter(Boolean).join(" ") || "Uten mengde"}
              {" · Handlekategori: "}
              {categoryById.get(row.categoryId)?.displayName ??
                "Ukjent handlekategori"}
              {row.preferredStoreId
                ? ` · ${storeById.get(row.preferredStoreId)?.name ?? "Butikk"}`
                : ""}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function toRecipeValues(recipe: FamilyRecipeEditorCardProps["recipe"]): FamilyRecipeValues {
  return {
    defaultServings: recipe.defaultServings?.toString() ?? "",
    description: recipe.description ?? "",
    ingredients:
      recipe.ingredients.length > 0
        ? recipe.ingredients.map((ingredient) => ({
            amount: ingredient.amount ?? "",
            categoryId: ingredient.categoryId,
            displayName: ingredient.displayName,
            preferredStoreId: ingredient.preferredStoreId ?? "",
            unit: ingredient.unit ?? "",
          }))
        : [
            {
              amount: "",
              categoryId: "",
              displayName: "",
              preferredStoreId: "",
              unit: "",
            },
          ],
    prepMinutes: recipe.prepMinutes?.toString() ?? "",
    tags: recipe.tags.join(", "),
    title: recipe.title,
  };
}

function toDraftIngredients(
  ingredients: FamilyRecipeIngredientValues[],
): DraftIngredientRow[] {
  return ingredients.map((ingredient, index) => ({
    ...ingredient,
    key: `row-${index}`,
  }));
}
