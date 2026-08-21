import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";

import { RecipePickerMedia } from "./recipe-picker-card";
import { compressRecipeCoverImage } from "../lib/recipe-cover-image";
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
  initialEditing?: boolean;
  mealPlanEntryCount: number;
  recipe: {
    defaultServings: number | null;
    description: string | null;
    id: string;
    imageUrl?: string | null;
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
  r2Configured?: boolean;
  updateFieldErrors?: FamilyRecipeFieldErrors;
  updateValues?: FamilyRecipeValues;
}

export function FamilyRecipeEditorCard({
  canManageRecipes,
  categories,
  familyStores,
  initialEditing = false,
  mealPlanEntryCount,
  recipe,
  r2Configured = false,
  updateFieldErrors,
  updateValues,
}: FamilyRecipeEditorCardProps) {
  const navigation = useNavigation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [removeCoverImage, setRemoveCoverImage] = useState(false);
  const [isCompressingCover, setIsCompressingCover] = useState(false);
  const coverObjectUrlRef = useRef<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const pendingIntent = navigation.formData?.get("intent");
  const pendingRecipeId = String(navigation.formData?.get("recipeId") ?? "");
  const isUpdatingRecipe =
    navigation.state !== "idle" &&
    pendingIntent === "update-recipe" &&
    pendingRecipeId === recipe.id;
  const isDeletingRecipe =
    navigation.state !== "idle" &&
    pendingIntent === "delete-recipe" &&
    pendingRecipeId === recipe.id;
  const persistedValues = useMemo<FamilyRecipeValues>(
    () => toRecipeValues(recipe),
    [recipe],
  );
  const [ignoreSubmittedValues, setIgnoreSubmittedValues] = useState(false);
  const sourceValues =
    updateValues && !ignoreSubmittedValues ? updateValues : persistedValues;
  const [isEditing, setIsEditing] = useState(
    Boolean(updateValues) || initialEditing,
  );
  const [draftValues, setDraftValues] = useState(sourceValues);
  const [focusIngredientIndex, setFocusIngredientIndex] = useState<
    number | null
  >(null);
  const clearIngredientDisplayNameFocus = useCallback(() => {
    setFocusIngredientIndex(null);
  }, []);
  const displayedCoverUrl = removeCoverImage
    ? null
    : (coverPreviewUrl ?? recipe.imageUrl ?? null);

  useEffect(() => {
    if (updateValues) {
      setIgnoreSubmittedValues(false);
    }
  }, [updateValues]);

  useEffect(() => {
    setDraftValues(sourceValues);
  }, [sourceValues]);

  useEffect(() => {
    return () => {
      if (coverObjectUrlRef.current) {
        URL.revokeObjectURL(coverObjectUrlRef.current);
      }
    };
  }, []);

  const draftIngredients = useMemo(
    () => toDraftIngredients(draftValues.ingredients),
    [draftValues.ingredients],
  );

  function handleCancelEditing() {
    setIgnoreSubmittedValues(true);
    setDraftValues(persistedValues);
    setIsEditing(false);
    setRemoveCoverImage(false);
    if (coverObjectUrlRef.current) {
      URL.revokeObjectURL(coverObjectUrlRef.current);
      coverObjectUrlRef.current = null;
    }
    setCoverPreviewUrl(null);
  }

  async function handleCoverFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const selected = event.target.files?.[0];
    if (!selected) {
      return;
    }

    setIsCompressingCover(true);
    setRemoveCoverImage(false);

    try {
      const compressed = await compressRecipeCoverImage(selected);
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(compressed);
      event.target.files = dataTransfer.files;

      if (coverObjectUrlRef.current) {
        URL.revokeObjectURL(coverObjectUrlRef.current);
      }
      const objectUrl = URL.createObjectURL(compressed);
      coverObjectUrlRef.current = objectUrl;
      setCoverPreviewUrl(objectUrl);
    } finally {
      setIsCompressingCover(false);
    }
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
    const newIngredientIndex = draftValues.ingredients.length;

    setFocusIngredientIndex(newIngredientIndex);
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
      ingredients: current.ingredients.filter(
        (_, rowIndex) => rowIndex !== index,
      ),
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
      {isDeletingRecipe ? (
        <p className="text-sm font-medium text-rose-700">
          Sletter oppskrift...
        </p>
      ) : null}
      <div
        className={`flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${isDeletingRecipe ? "mt-3 opacity-60" : ""}`}
      >
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <RecipePickerMedia
            imageUrl={displayedCoverUrl}
            size="md"
            title={isUpdatingRecipe ? draftValues.title : recipe.title}
          />
          <div className="min-w-0">
            <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
              Familieoppskrift
            </span>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">
              {isUpdatingRecipe ? draftValues.title : recipe.title}
            </h2>
            {mealPlanEntryCount > 0 ? (
              <p className="mt-2 text-sm text-slate-600">
                Brukt i {mealPlanEntryCount}{" "}
                {mealPlanEntryCount === 1 ? "ukeplan" : "ukeplaner"}
              </p>
            ) : null}
          </div>
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
        <Form
          className="mt-6 space-y-6"
          encType="multipart/form-data"
          method="post"
        >
          <input name="intent" type="hidden" value="update-recipe" />
          <input name="recipeId" type="hidden" value={recipe.id} />
          {removeCoverImage ? (
            <input name="removeCoverImage" type="hidden" value="1" />
          ) : null}
          <RecipeCoverField
            coverError={updateFieldErrors?.coverImage}
            coverInputRef={coverInputRef}
            disabled={!r2Configured || isCompressingCover}
            hasExistingImage={Boolean(recipe.imageUrl) && !removeCoverImage}
            isCompressing={isCompressingCover}
            onFileChange={handleCoverFileChange}
            onRemove={() => {
              setRemoveCoverImage(true);
              if (coverInputRef.current) {
                coverInputRef.current.value = "";
              }
              if (coverObjectUrlRef.current) {
                URL.revokeObjectURL(coverObjectUrlRef.current);
                coverObjectUrlRef.current = null;
              }
              setCoverPreviewUrl(null);
            }}
            previewUrl={displayedCoverUrl}
            r2Configured={r2Configured}
            title={draftValues.title}
          />
          <RecipeFields
            categories={categories}
            draftIngredients={draftIngredients}
            draftValues={draftValues}
            familyStores={familyStores}
            fieldErrors={updateFieldErrors}
            focusIngredientIndex={focusIngredientIndex}
            generateError={generateError}
            isGenerating={isGenerating}
            onAddIngredient={addIngredient}
            onIngredientDisplayNameFocused={clearIngredientDisplayNameFocus}
            onMoveIngredient={moveIngredient}
            onRemoveIngredient={removeIngredient}
            onUpdateIngredient={updateIngredient}
            setDraftValues={setDraftValues}
            setGenerateError={setGenerateError}
            setIsGenerating={setIsGenerating}
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="inline-flex flex-1 items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={isUpdatingRecipe || isCompressingCover}
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
              slettes før du fjerner den fra planene.
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

function RecipeCoverField({
  coverError,
  coverInputRef,
  disabled,
  hasExistingImage,
  isCompressing,
  onFileChange,
  onRemove,
  previewUrl,
  r2Configured,
  title,
}: {
  coverError?: string;
  coverInputRef: React.RefObject<HTMLInputElement | null>;
  disabled: boolean;
  hasExistingImage: boolean;
  isCompressing: boolean;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  previewUrl: string | null;
  r2Configured: boolean;
  title: string;
}) {
  return (
    <fieldset className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-950">
        Coverbilde
      </legend>
      <div className="flex items-start gap-4">
        <RecipePickerMedia imageUrl={previewUrl} title={title || "Oppskrift"} />
        <div className="min-w-0 flex-1 space-y-3">
          {!r2Configured ? (
            <p className="text-sm leading-6 text-amber-800">
              Bildeopplasting er ikke konfigurert (Cloudflare R2). Du kan
              fortsatt lagre oppskriften uten bilde.
            </p>
          ) : (
            <p className="text-sm leading-6 text-slate-600">
              JPEG, PNG eller WebP. Bildet komprimeres automatisk før opplasting
              (maks 2 MB).
            </p>
          )}
          <label className="block text-sm font-medium text-slate-700">
            Velg bilde
            <input
              accept="image/jpeg,image/png,image/webp"
              className="mt-2 block w-full text-base text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
              disabled={disabled}
              name="coverImage"
              onChange={onFileChange}
              ref={coverInputRef}
              type="file"
            />
          </label>
          {isCompressing ? (
            <p className="text-sm text-slate-500">Komprimerer bilde...</p>
          ) : null}
          {hasExistingImage || previewUrl ? (
            <button
              className="text-sm font-medium text-rose-700 transition hover:text-rose-800"
              disabled={disabled}
              onClick={onRemove}
              type="button"
            >
              Fjern coverbilde
            </button>
          ) : null}
          {coverError ? (
            <p className="text-sm text-rose-600">{coverError}</p>
          ) : null}
        </div>
      </div>
    </fieldset>
  );
}

function RecipeFields({
  categories,
  draftIngredients,
  draftValues,
  familyStores,
  fieldErrors,
  focusIngredientIndex,
  generateError,
  isGenerating,
  onAddIngredient,
  onIngredientDisplayNameFocused,
  onMoveIngredient,
  onRemoveIngredient,
  onUpdateIngredient,
  setDraftValues,
  setGenerateError,
  setIsGenerating,
}: {
  categories: RecipeCategory[];
  draftIngredients: DraftIngredientRow[];
  draftValues: FamilyRecipeValues;
  familyStores: RecipeStore[];
  fieldErrors?: FamilyRecipeFieldErrors;
  focusIngredientIndex: number | null;
  generateError: string | null;
  isGenerating: boolean;
  onAddIngredient: () => void;
  onIngredientDisplayNameFocused: () => void;
  onMoveIngredient: (key: string, direction: "up" | "down") => void;
  onRemoveIngredient: (key: string) => void;
  onUpdateIngredient: (
    key: string,
    patch: Partial<FamilyRecipeIngredientValues>,
  ) => void;
  setDraftValues: React.Dispatch<React.SetStateAction<FamilyRecipeValues>>;
  setGenerateError: React.Dispatch<React.SetStateAction<string | null>>;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
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
      <button
        className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
        disabled={isGenerating || !draftValues.title}
        onClick={async () => {
          setIsGenerating(true);
          setGenerateError(null);
          try {
            const res = await fetch("/api/generate-recipe-description", {
              body: JSON.stringify({
                ingredients: draftValues.ingredients.map((i) => ({
                  amount: i.amount,
                  displayName: i.displayName,
                  unit: i.unit,
                })),
                title: draftValues.title,
              }),
              headers: { "Content-Type": "application/json" },
              method: "POST",
            });
            const json = await res.json();
            if (json.error) {
              setGenerateError(json.error);
            } else {
              setDraftValues((current) => ({
                ...current,
                description: json.description,
              }));
            }
          } catch {
            setGenerateError("Kunne ikke koble til serveren.");
          } finally {
            setIsGenerating(false);
          }
        }}
        type="button"
      >
        {isGenerating ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Genererer...
          </>
        ) : (
          "Generer beskrivelse med AI"
        )}
      </button>
      {generateError ? (
        <p className="text-sm text-rose-600">{generateError}</p>
      ) : null}

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
            placeholder="2"
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
            placeholder="45"
            type="text"
            value={draftValues.prepMinutes}
          />
          {fieldErrors?.prepMinutes ? (
            <p className="mt-2 text-sm text-rose-600">
              {fieldErrors.prepMinutes}
            </p>
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
        <div>
          <h3 className="text-base font-semibold text-slate-950">
            Ingredienser
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Hver rad er én ingrediens med egen handlekategori (brukes i
            handlelisten, ikke som oppskriftstype).
          </p>
        </div>
        {fieldErrors?.ingredients ? (
          <p className="text-sm text-rose-600">{fieldErrors.ingredients}</p>
        ) : null}

        {draftIngredients.map((row, index) => (
          <IngredientRowEditor
            categories={categories}
            familyStores={familyStores}
            focusDisplayName={focusIngredientIndex === index}
            index={index}
            key={row.key}
            onDisplayNameFocused={onIngredientDisplayNameFocused}
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

        <button
          className="w-full rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200 transition hover:bg-emerald-100 sm:w-auto"
          onClick={onAddIngredient}
          type="button"
        >
          Legg til rad
        </button>
      </div>
    </>
  );
}

function IngredientRowEditor({
  categories,
  familyStores,
  focusDisplayName,
  index,
  onDisplayNameFocused,
  onMove,
  onRemove,
  onUpdate,
  row,
  validationError,
}: {
  categories: RecipeCategory[];
  familyStores: RecipeStore[];
  focusDisplayName: boolean;
  index: number;
  onDisplayNameFocused: () => void;
  onMove: (key: string, direction: "up" | "down") => void;
  onRemove: (key: string) => void;
  onUpdate: (key: string, patch: Partial<FamilyRecipeIngredientValues>) => void;
  row: DraftIngredientRow;
  validationError?: string;
}) {
  const displayNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focusDisplayName) {
      return;
    }

    displayNameInputRef.current?.focus();
    onDisplayNameFocused();
  }, [focusDisplayName, onDisplayNameFocused]);

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
            ref={displayNameInputRef}
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
            onChange={(event) =>
              onUpdate(row.key, { amount: event.target.value })
            }
            type="text"
            value={row.amount}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Enhet
          <input
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
            name={`ingredientUnit:${index}`}
            onChange={(event) =>
              onUpdate(row.key, { unit: event.target.value })
            }
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
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const storeById = new Map(familyStores.map((store) => [store.id, store]));

  return (
    <div className="mt-6 space-y-6">
      {draftValues.description ? (
        <p className="text-sm leading-7 text-slate-600 whitespace-break-spaces">
          {draftValues.description}
        </p>
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
              {[row.amount, row.unit].filter(Boolean).join(" ") ||
                "Uten mengde"}
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

function toRecipeValues(
  recipe: FamilyRecipeEditorCardProps["recipe"],
): FamilyRecipeValues {
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
