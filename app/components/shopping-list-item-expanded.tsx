import { Form } from "react-router";
import type { ChangeEventHandler } from "react";

import { formatOccurrenceSourceLine } from "../lib/shopping-display";
import type {
  FamilyShoppingItemFieldErrors,
  FamilyShoppingItemValues,
} from "../lib/family-shopping-write.server";
import type {
  GeneratedShoppingItemOverrideFieldErrors,
  GeneratedShoppingItemOverrideValues,
  ManualShoppingItemFieldErrors,
  ManualShoppingItemValues,
} from "../lib/shopping-write.server";

export const shoppingDateInputClassName =
  "mt-2 box-border w-full max-w-full min-w-0 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";

function buildShoppingDateSelectOptions(
  selectableShoppingDates: string[],
  selectedDate: string,
) {
  const dates = new Set(selectableShoppingDates);

  if (selectedDate) {
    dates.add(selectedDate);
  }

  return [...dates].sort();
}

function formatShoppingDateOptionLabel(value: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function ShoppingDateSelect({
  "aria-busy": ariaBusy,
  "aria-label": ariaLabel,
  className = shoppingDateInputClassName,
  defaultValue,
  disabled = false,
  emptyOptionLabel = "Ingen dato valgt",
  name,
  onChange,
  selectableShoppingDates,
  showEmptyOption = true,
}: {
  "aria-busy"?: boolean;
  "aria-label"?: string;
  className?: string;
  defaultValue: string;
  disabled?: boolean;
  emptyOptionLabel?: string;
  name: string;
  onChange?: ChangeEventHandler<HTMLSelectElement>;
  selectableShoppingDates: string[];
  showEmptyOption?: boolean;
}) {
  const options = buildShoppingDateSelectOptions(
    selectableShoppingDates,
    defaultValue,
  );

  return (
    <select
      aria-busy={ariaBusy}
      aria-label={ariaLabel}
      className={className}
      defaultValue={defaultValue}
      disabled={disabled}
      name={name}
      onChange={onChange}
    >
      {showEmptyOption ? <option value="">{emptyOptionLabel}</option> : null}
      {options.map((date) => (
        <option key={date} value={date}>
          {formatShoppingDateOptionLabel(date)}
        </option>
      ))}
    </select>
  );
}

type ShoppingListItemExpandedProps = {
  actionData?: {
    generatedOverrideFieldErrors?: GeneratedShoppingItemOverrideFieldErrors;
    intent?: string;
    itemTarget?: { sourceKey: string };
    familyFieldErrors?: FamilyShoppingItemFieldErrors;
    manualFieldErrors?: ManualShoppingItemFieldErrors;
  };
  categories: Array<{ displayName: string; id: string }>;
  familyValues?: FamilyShoppingItemValues | null;
  displayChecked?: boolean;
  isPendingCheckToggle: boolean;
  isPendingFamilyDelete?: boolean;
  isPendingFamilySave?: boolean;
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
    sourceType: "FAMILY" | "GENERATED" | "MANUAL";
  };
  manualValues: ManualShoppingItemValues | null;
  overrideValues: GeneratedShoppingItemOverrideValues | null;
  selectableShoppingDates?: string[];
  stores: Array<{ id: string; name: string }>;
  toggleExpectedVersion: string;
};

export function ShoppingListItemExpanded({
  actionData,
  categories,
  displayChecked,
  isPendingCheckToggle,
  isPendingGeneratedExclude,
  isPendingGeneratedSave,
  familyValues = null,
  isPendingFamilyDelete = false,
  isPendingFamilySave = false,
  isPendingManualDelete,
  isPendingManualSave,
  item,
  manualValues,
  overrideValues,
  selectableShoppingDates = [],
  stores,
  toggleExpectedVersion,
}: ShoppingListItemExpandedProps) {
  const checked = displayChecked ?? item.checked;
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
        ) : item.sourceType === "FAMILY" ? (
          <>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
              Alltid på listen
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              Denne varen følger familien på tvers av ukeplaner og kan redigeres
              eller slettes her.
            </p>
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
            value={
              item.sourceType === "FAMILY"
                ? "toggle-family-shopping-item-checked"
                : "toggle-shopping-item-checked"
            }
          />
          <input name="sourceKey" type="hidden" value={item.sourceKey} />
          {item.sourceType !== "FAMILY" ? (
            <input name="sourceType" type="hidden" value={item.sourceType} />
          ) : null}
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
              ? checked
                ? "Krysser av..."
                : "Oppdaterer..."
              : checked
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
              Mengde
              <input
                className="mt-2 box-border w-full max-w-full min-w-0 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                defaultValue={overrideValues.quantity}
                name="quantity"
                placeholder="F.eks. 4 flasker"
                type="text"
              />
            </label>
            <p className="text-xs leading-5 text-slate-500">
              La feltet stå tomt for å bruke mengden fra oppskriftene.
            </p>

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
              <ShoppingDateSelect
                defaultValue={overrideValues.postponedUntilDate}
                name="postponedUntilDate"
                selectableShoppingDates={selectableShoppingDates}
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
                  <ShoppingDateSelect
                    defaultValue={manualValues.buyOnDate}
                    emptyOptionLabel="Ingen handledato"
                    name="buyOnDate"
                    selectableShoppingDates={selectableShoppingDates}
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

        {item.sourceType === "FAMILY" && familyValues ? (
          <>
            <Form className="grid min-w-0 gap-3" method="post">
              <input
                name="intent"
                type="hidden"
                value="update-family-shopping-item"
              />
              <input name="familyItemId" type="hidden" value={item.sourceKey} />
              <input
                name="expectedUpdatedAt"
                type="hidden"
                value={item.collaborationVersion}
              />

              <label className="block min-w-0 text-sm font-medium text-slate-700">
                Varenavn
                <input
                  className="mt-2 box-border w-full max-w-full min-w-0 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  defaultValue={familyValues.name}
                  name="name"
                  type="text"
                />
              </label>

              <label className="block min-w-0 text-sm font-medium text-slate-700">
                Mengde
                <input
                  className="mt-2 box-border w-full max-w-full min-w-0 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  defaultValue={familyValues.quantity}
                  name="quantity"
                  type="text"
                />
              </label>

              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <label className="block min-w-0 text-sm font-medium text-slate-700">
                  Kategori
                  <select
                    className="mt-2 box-border w-full max-w-full min-w-0 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    defaultValue={familyValues.categoryId}
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
                    defaultValue={familyValues.preferredStoreId}
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
                  defaultValue={familyValues.note}
                  name="note"
                />
              </label>

              {actionData?.intent === "update-family-shopping-item" &&
              actionData.itemTarget?.sourceKey === item.sourceKey &&
              actionData.familyFieldErrors?.name ? (
                <p className="text-sm text-rose-600">
                  {actionData.familyFieldErrors.name}
                </p>
              ) : null}

              <button
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                disabled={isPendingFamilySave}
                type="submit"
              >
                {isPendingFamilySave
                  ? "Lagrer varelinje..."
                  : "Lagre varelinje"}
              </button>
            </Form>

            <Form method="post">
              <input
                name="intent"
                type="hidden"
                value="delete-family-shopping-item"
              />
              <input name="familyItemId" type="hidden" value={item.sourceKey} />
              <input
                name="expectedUpdatedAt"
                type="hidden"
                value={item.collaborationVersion}
              />
              <button
                className="inline-flex w-full items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:bg-rose-100 disabled:text-rose-400"
                disabled={isPendingFamilyDelete}
                type="submit"
              >
                {isPendingFamilyDelete
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
