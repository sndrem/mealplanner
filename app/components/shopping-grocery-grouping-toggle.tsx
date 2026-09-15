import { Form } from "react-router";

import type { ShoppingGroceryGroupingValue } from "../lib/shopping-grocery-grouping";

interface ShoppingGroceryGroupingToggleProps {
  grouping: ShoppingGroceryGroupingValue;
  variant?: "hero" | "store";
}

export function ShoppingGroceryGroupingToggle({
  grouping,
  variant = "store",
}: ShoppingGroceryGroupingToggleProps) {
  if (variant === "hero") {
    return (
      <div
        aria-label="Gruppering av like varer"
        className="flex flex-wrap gap-3"
        role="radiogroup"
      >
        <GroupingFormButton
          checked={grouping === "GROUPED"}
          className={
            grouping === "GROUPED"
              ? "rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-medium text-white"
              : "rounded-2xl bg-white/10 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/15"
          }
          grouping="GROUPED"
          label="Samme vare"
        />
        <GroupingFormButton
          checked={grouping === "SPLIT"}
          className={
            grouping === "SPLIT"
              ? "rounded-2xl bg-white px-5 py-3 text-sm font-medium text-slate-950"
              : "rounded-2xl bg-white/10 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/15"
          }
          grouping="SPLIT"
          label="Hver mengde"
        />
      </div>
    );
  }

  return (
    <div
      aria-label="Gruppering av like varer"
      className="inline-flex rounded-2xl bg-store-bg p-1 ring-1 ring-store-line"
      role="radiogroup"
    >
      <GroupingFormButton
        checked={grouping === "GROUPED"}
        className={
          grouping === "GROUPED"
            ? "rounded-xl bg-store-surface px-4 py-2.5 text-sm font-medium text-store-ink shadow-sm ring-1 ring-store-line"
            : "rounded-xl px-4 py-2.5 text-sm font-medium text-store-muted transition hover:text-store-ink"
        }
        grouping="GROUPED"
        label="Samme vare"
      />
      <GroupingFormButton
        checked={grouping === "SPLIT"}
        className={
          grouping === "SPLIT"
            ? "rounded-xl bg-store-surface px-4 py-2.5 text-sm font-medium text-store-ink shadow-sm ring-1 ring-store-line"
            : "rounded-xl px-4 py-2.5 text-sm font-medium text-store-muted transition hover:text-store-ink"
        }
        grouping="SPLIT"
        label="Hver mengde"
      />
    </div>
  );
}

function GroupingFormButton({
  checked,
  className,
  grouping,
  label,
}: {
  checked: boolean;
  className: string;
  grouping: ShoppingGroceryGroupingValue;
  label: string;
}) {
  return (
    <Form method="post">
      <input name="intent" type="hidden" value="update-shopping-grocery-grouping" />
      <input name="groceryGrouping" type="hidden" value={grouping} />
      <button
        aria-checked={checked}
        className={className}
        role="radio"
        type="submit"
      >
        {label}
      </button>
    </Form>
  );
}
