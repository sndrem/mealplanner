import { Form } from "react-router";

import { formatOccurrenceSourceLine } from "../lib/shopping-display";
import type {
  GeneratedShoppingItemOverrideFieldErrors,
  GeneratedShoppingItemOverrideValues,
  ManualShoppingItemFieldErrors,
  ManualShoppingItemValues,
} from "../lib/shopping-write.server";

export const shoppingDateInputClassName =
  "mt-2 box-border w-full max-w-full min-w-0 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";

type ShoppingListItemExpandedProps = {
  actionData?: {
    generatedOverrideFieldErrors?: GeneratedShoppingItemOverrideFieldErrors;
    intent?: string;
    itemTarget?: { sourceKey: string };
    manualFieldErrors?: ManualShoppingItemFieldErrors;
  };
  categories: Array<{ displayName: string; id: string }>;
  isPendingCheckToggle: boolean;
  isPendingGeneratedExclude: boolean;
  isPendingGeneratedSave: boolean;
  isPendingManualDelete: boolean;
  isPendingManualSave: boolean;
  item: {
    buyOnDate?: string | null;
    checked: boolean;
    collaborationVersion: string;
    name: string;
    note: string | null;
    occurrences?: Array<{
      date: string;
      mealPlanEntryId: string;
      quantityLabel: string | null;
      recipeIngredientId: string;
      recipeTitle: string;
    }>;
    sourceKey: string;
    sourceType: "GENERATED" | "MANUAL";
  };
  manualValues: ManualShoppingItemValues | null;
  mealPlanEndDate: string;
  mealPlanStartDate: string;
  overrideValues: GeneratedShoppingItemOverrideValues | null;
  stores: Array<{ id: string; name: string }>;
  toggleExpectedVersion: string;
};

export function ShoppingListItemExpanded({
  actionData,
  categories,
  isPendingCheckToggle,
  isPendingGeneratedExclude,
  isPendingGeneratedSave,
  isPendingManualDelete,
  isPendingManualSave,
  item,
  manualValues,
  mealPlanEndDate,
  mealPlanStartDate,
  overrideValues,
  stores,
  toggleExpectedVersion,
}: ShoppingListItemExpandedProps) {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="min-w-0 rounded-[20px] bg-white p-4 ring-1 ring-slate-200">
        {item.sourceType === "GENERATED" ? (
          <>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
              Kilder
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {(item.occurrences ?? []).map((occurrence) => (
                <li
                  key={`${occurrence.mealPlanEntryId}:${occurrence.recipeIngredientId}`}
                >
                  {formatOccurrenceSourceLine(occurrence)}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
              Manuell rad
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              Denne varelinjen kommer ikke fra en oppskrift og kan redigeres
              eller slettes direkte her.
            </p>
          </>
        )}
      </div>

      <div className="grid min-w-0 gap-3">
        <Form method="post">
          <input
            name="intent"
            type="hidden"
            value="toggle-shopping-item-checked"
          />
          <input name="sourceKey" type="hidden" value={item.sourceKey} />
          <input name="sourceType" type="hidden" value={item.sourceType} />
          <input
            name="checked"
            type="hidden"
            value={item.checked ? "false" : "true"}
          />
          <input
            name="expectedUpdatedAt"
            type="hidden"
            value={toggleExpectedVersion}
          />
          <button
            className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={isPendingCheckToggle}
            type="submit"
          >
            {isPendingCheckToggle
              ? item.checked
                ? "Oppdaterer..."
                : "Krysser av..."
              : item.checked
                ? "Fjern avkryssing"
                : "Marker som kjøpt"}
          </button>
        </Form>

        {item.sourceType === "GENERATED" && overrideValues ? (
          <Form className="grid min-w-0 gap-3" method="post">
            <input
              name="intent"
              type="hidden"
              value="update-generated-shopping-item"
            />
            <input name="sourceKey" type="hidden" value={item.sourceKey} />
            <input
              name="expectedUpdatedAt"
              type="hidden"
              value={item.collaborationVersion}
            />

            <label className="block min-w-0 text-sm font-medium text-slate-700">
              Foretrukket butikk
              <select
                className="mt-2 box-border w-full max-w-full min-w-0 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                defaultValue={overrideValues.preferredStoreId}
                name="preferredStoreId"
              >
                <option value="">Ingen valgt butikk</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block min-w-0 text-sm font-medium text-slate-700">
              Utsatt til
              <input
                className={shoppingDateInputClassName}
                defaultValue={overrideValues.postponedUntilDate}
                max={mealPlanEndDate}
                min={mealPlanStartDate}
                name="postponedUntilDate"
                type="date"
              />
            </label>

            <label className="block min-w-0 text-sm font-medium text-slate-700">
              Notat
              <textarea
                className="mt-2 box-border min-h-24 w-full max-w-full min-w-0 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                defaultValue={overrideValues.note}
                name="note"
              />
            </label>

            {actionData?.intent === "update-generated-shopping-item" &&
            actionData.itemTarget?.sourceKey === item.sourceKey &&
            actionData.generatedOverrideFieldErrors?.preferredStoreId ? (
              <p className="text-sm text-rose-600">
                {actionData.generatedOverrideFieldErrors.preferredStoreId}
              </p>
            ) : null}
            {actionData?.intent === "update-generated-shopping-item" &&
            actionData.itemTarget?.sourceKey === item.sourceKey &&
            actionData.generatedOverrideFieldErrors?.postponedUntilDate ? (
              <p className="text-sm text-rose-600">
                {actionData.generatedOverrideFieldErrors.postponedUntilDate}
              </p>
            ) : null}

            <button
              className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              disabled={isPendingGeneratedSave || isPendingGeneratedExclude}
              type="submit"
            >
              {isPendingGeneratedSave
                ? "Lagrer tilpasninger..."
                : "Lagre tilpasninger"}
            </button>
          </Form>
        ) : null}

        {item.sourceType === "GENERATED" ? (
          <Form method="post">
            <input
              name="intent"
              type="hidden"
              value="exclude-generated-shopping-item"
            />
            <input name="sourceKey" type="hidden" value={item.sourceKey} />
            <input
              name="expectedUpdatedAt"
              type="hidden"
              value={item.collaborationVersion}
            />
            <button
              className="inline-flex w-full items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:bg-rose-100 disabled:text-rose-400"
              disabled={isPendingGeneratedExclude || isPendingGeneratedSave}
              type="submit"
            >
              {isPendingGeneratedExclude
                ? "Fjerner varelinje..."
                : "Fjern fra handlelisten"}
            </button>
          </Form>
        ) : null}

        {item.sourceType === "MANUAL" && manualValues ? (
          <>
            <Form className="grid min-w-0 gap-3" method="post">
              <input
                name="intent"
                type="hidden"
                value="update-manual-shopping-item"
              />
              <input name="manualItemId" type="hidden" value={item.sourceKey} />
              <input
                name="expectedUpdatedAt"
                type="hidden"
                value={item.collaborationVersion}
              />

              <label className="block min-w-0 text-sm font-medium text-slate-700">
                Varenavn
                <input
                  className="mt-2 box-border w-full max-w-full min-w-0 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  defaultValue={manualValues.name}
                  name="name"
                  type="text"
                />
              </label>

              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <label className="block min-w-0 text-sm font-medium text-slate-700">
                  Mengde
                  <input
                    className="mt-2 box-border w-full max-w-full min-w-0 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    defaultValue={manualValues.quantity}
                    name="quantity"
                    type="text"
                  />
                </label>

                <label className="block min-w-0 text-sm font-medium text-slate-700">
                  Handledato
                  <input
                    className={shoppingDateInputClassName}
                    defaultValue={manualValues.buyOnDate}
                    max={mealPlanEndDate}
                    min={mealPlanStartDate}
                    name="buyOnDate"
                    type="date"
                  />
                </label>
              </div>

              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <label className="block min-w-0 text-sm font-medium text-slate-700">
                  Kategori
                  <select
                    className="mt-2 box-border w-full max-w-full min-w-0 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    defaultValue={manualValues.categoryId}
                    name="categoryId"
                  >
                    <option value="">Velg kategori</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.displayName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block min-w-0 text-sm font-medium text-slate-700">
                  Foretrukket butikk
                  <select
                    className="mt-2 box-border w-full max-w-full min-w-0 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    defaultValue={manualValues.preferredStoreId}
                    name="preferredStoreId"
                  >
                    <option value="">Ingen valgt butikk</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block min-w-0 text-sm font-medium text-slate-700">
                Notat
                <textarea
                  className="mt-2 box-border min-h-24 w-full max-w-full min-w-0 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  defaultValue={manualValues.note}
                  name="note"
                />
              </label>

              {actionData?.intent === "update-manual-shopping-item" &&
              actionData.itemTarget?.sourceKey === item.sourceKey &&
              actionData.manualFieldErrors?.name ? (
                <p className="text-sm text-rose-600">
                  {actionData.manualFieldErrors.name}
                </p>
              ) : null}
              {actionData?.intent === "update-manual-shopping-item" &&
              actionData.itemTarget?.sourceKey === item.sourceKey &&
              actionData.manualFieldErrors?.categoryId ? (
                <p className="text-sm text-rose-600">
                  {actionData.manualFieldErrors.categoryId}
                </p>
              ) : null}
              {actionData?.intent === "update-manual-shopping-item" &&
              actionData.itemTarget?.sourceKey === item.sourceKey &&
              actionData.manualFieldErrors?.preferredStoreId ? (
                <p className="text-sm text-rose-600">
                  {actionData.manualFieldErrors.preferredStoreId}
                </p>
              ) : null}
              {actionData?.intent === "update-manual-shopping-item" &&
              actionData.itemTarget?.sourceKey === item.sourceKey &&
              actionData.manualFieldErrors?.buyOnDate ? (
                <p className="text-sm text-rose-600">
                  {actionData.manualFieldErrors.buyOnDate}
                </p>
              ) : null}

              <button
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                disabled={isPendingManualSave}
                type="submit"
              >
                {isPendingManualSave
                  ? "Lagrer varelinje..."
                  : "Lagre varelinje"}
              </button>
            </Form>

            <Form method="post">
              <input
                name="intent"
                type="hidden"
                value="delete-manual-shopping-item"
              />
              <input name="manualItemId" type="hidden" value={item.sourceKey} />
              <input
                name="expectedUpdatedAt"
                type="hidden"
                value={item.collaborationVersion}
              />
              <button
                className="inline-flex w-full items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:bg-rose-100 disabled:text-rose-400"
                disabled={isPendingManualDelete}
                type="submit"
              >
                {isPendingManualDelete
                  ? "Sletter varelinje..."
                  : "Slett varelinje"}
              </button>
            </Form>
          </>
        ) : null}
      </div>
    </div>
  );
}
