import { Form } from "react-router";
import type { ChangeEventHandler } from "react";

import type {
  FamilyShoppingItemFieldErrors,
  FamilyShoppingItemValues,
} from "../lib/family-shopping-write.server";

export const shoppingDateInputClassName =
  "mt-2 box-border w-full max-w-full min-w-0 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft";

const familyFieldClassName =
  "mt-2 box-border w-full max-w-full min-w-0 rounded-2xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft";

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
    intent?: string;
    itemTarget?: { sourceKey: string };
    familyFieldErrors?: FamilyShoppingItemFieldErrors;
  };
  categories: Array<{ displayName: string; id: string }>;
  familyValues?: FamilyShoppingItemValues | null;
  displayChecked?: boolean;
  isPendingCheckToggle: boolean;
  isPendingFamilyDelete?: boolean;
  isPendingFamilySave?: boolean;
  item: {
    checked: boolean;
    collaborationVersion: string;
    name: string;
    note: string | null;
    groupingMembers?: Array<{
      checked: boolean;
      collaborationVersion: string;
      mealPlanId: string | null;
      quantity: string | null;
      quantityLabel: string | null;
      sourceKey: string;
    }>;
    sourceKey: string;
    sourceType: "FAMILY" | "GENERATED" | "MANUAL";
  };
  stores: Array<{ id: string; name: string }>;
  toggleExpectedVersion: string;
};

export function ShoppingListItemExpanded({
  actionData,
  categories,
  displayChecked,
  isPendingCheckToggle,
  familyValues = null,
  isPendingFamilyDelete = false,
  isPendingFamilySave = false,
  item,
  stores,
  toggleExpectedVersion,
}: ShoppingListItemExpandedProps) {
  const checked = displayChecked ?? item.checked;
  const groupingMembers =
    item.groupingMembers && item.groupingMembers.length > 1
      ? item.groupingMembers
      : null;
  const checkTargets = groupingMembers ?? [
    {
      collaborationVersion: toggleExpectedVersion,
      sourceKey: item.sourceKey,
    },
  ];

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="min-w-0 rounded-[20px] bg-surface p-4 ring-1 ring-line">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Alltid på listen
        </p>
        <p className="mt-3 text-sm leading-6 text-muted">
          Denne varen følger familien på tvers av ukeplaner og kan redigeres
          eller slettes her.
        </p>
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
          {checkTargets.map((target) => (
            <input
              key={target.sourceKey}
              name="sourceKey"
              type="hidden"
              value={target.sourceKey}
            />
          ))}
          {groupingMembers
            ? groupingMembers.map((member) => (
                <input
                  key={`${member.sourceKey}-version`}
                  name="memberExpectedUpdatedAt"
                  type="hidden"
                  value={member.collaborationVersion}
                />
              ))
            : null}
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
            className="inline-flex w-full items-center justify-center rounded-2xl bg-accent px-5 py-3 text-sm font-medium text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
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

              <label className="block min-w-0 text-sm font-medium text-muted">
                Varenavn
                <input
                  className={familyFieldClassName}
                  defaultValue={familyValues.name}
                  name="name"
                  type="text"
                />
              </label>

              <label className="block min-w-0 text-sm font-medium text-muted">
                Mengde
                <input
                  className={familyFieldClassName}
                  defaultValue={familyValues.quantity}
                  name="quantity"
                  type="text"
                />
              </label>

              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <label className="block min-w-0 text-sm font-medium text-muted">
                  Kategori
                  <select
                    className={familyFieldClassName}
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

                <label className="block min-w-0 text-sm font-medium text-muted">
                  Foretrukket butikk
                  <select
                    className={familyFieldClassName}
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

              <label className="block min-w-0 text-sm font-medium text-muted">
                Notat
                <textarea
                  className={`min-h-24 ${familyFieldClassName}`}
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
                className="inline-flex w-full items-center justify-center rounded-2xl border border-line bg-surface px-5 py-3 text-sm font-medium text-ink transition hover:bg-page disabled:cursor-not-allowed disabled:bg-page disabled:text-muted"
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
