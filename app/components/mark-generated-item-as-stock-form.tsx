import { useState } from "react";
import { Form } from "react-router";

import {
  getGeneratedStockMarkTargets,
  MARK_FAMILY_SHOPPING_ITEM_AS_STOCK_INTENT,
  MARK_GENERATED_SHOPPING_ITEM_AS_STOCK_INTENT,
  type GeneratedStockMarkTarget,
} from "../lib/shopping-stock-mark";

export function MarkGeneratedItemAsStockForm({
  displaySourceKey,
  isPending = false,
  item,
  variant,
}: {
  displaySourceKey: string;
  isPending?: boolean;
  item: {
    collaborationVersion?: string;
    groupingMembers?: Array<{
      mealPlanId: string | null;
      sourceKey: string;
    }>;
    mealPlanId?: string | null;
    name: string;
    sourceKey: string;
    sourceType?: string;
  };
  variant: "list" | "store";
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const isFamilyItem = item.sourceType === "FAMILY";
  const targets = isFamilyItem ? [] : getGeneratedStockMarkTargets(item);

  if (!isFamilyItem && targets.length === 0) {
    return null;
  }

  const buttonClassName =
    variant === "store"
      ? "inline-flex max-w-full whitespace-normal rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-left text-xs font-medium text-emerald-900 transition hover:border-emerald-400 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
      : "inline-flex w-full items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-900 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60";
  const copyClassName =
    variant === "store"
      ? "text-xs leading-4 text-store-muted"
      : "text-sm leading-6 text-muted";

  if (!isConfirming) {
    return (
      <button
        className={buttonClassName}
        onClick={() => setIsConfirming(true)}
        type="button"
      >
        Merk som basisvare
      </button>
    );
  }

  return (
    <Form className="grid min-w-0 gap-2" method="post">
      <input
        name="intent"
        type="hidden"
        value={
          isFamilyItem
            ? MARK_FAMILY_SHOPPING_ITEM_AS_STOCK_INTENT
            : MARK_GENERATED_SHOPPING_ITEM_AS_STOCK_INTENT
        }
      />
      <input name="sourceKey" type="hidden" value={displaySourceKey} />
      {isFamilyItem ? (
        <>
          <input name="familyItemId" type="hidden" value={item.sourceKey} />
          <input
            name="expectedUpdatedAt"
            type="hidden"
            value={item.collaborationVersion ?? ""}
          />
        </>
      ) : (
        targets.map((target) => (
          <StockMarkTargetFields
            key={`${target.mealPlanId}:${target.sourceKey}`}
            target={target}
          />
        ))
      )}
      <p className={copyClassName}>
        {item.name} blir en basisvare og holdes utenfor handlelisten fremover.
        Du kan fortsatt legge den til for denne uken. Fjern den fra Basisvarer
        hvis det var feil.
      </p>
      <button className={buttonClassName} disabled={isPending} type="submit">
        {isPending ? "Merker som basisvare..." : "Merk som basisvare"}
      </button>
      <button
        className={
          variant === "store"
            ? "inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium text-store-muted transition hover:text-store-ink disabled:cursor-not-allowed disabled:opacity-60"
            : "inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-medium text-muted transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
        }
        disabled={isPending}
        onClick={() => setIsConfirming(false)}
        type="button"
      >
        Avbryt
      </button>
    </Form>
  );
}

function StockMarkTargetFields({ target }: { target: GeneratedStockMarkTarget }) {
  return (
    <>
      <input name="memberMealPlanId" type="hidden" value={target.mealPlanId} />
      <input name="memberSourceKey" type="hidden" value={target.sourceKey} />
    </>
  );
}
