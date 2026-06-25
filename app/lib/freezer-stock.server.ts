export function computeFreezerStockDelta({
  nextEntries,
  previousEntries,
}: {
  nextEntries: Map<string, string | null>;
  previousEntries: Map<string, string | null>;
}) {
  const deltaByItemId = new Map<string, number>();

  const allDates = new Set([
    ...previousEntries.keys(),
    ...nextEntries.keys(),
  ]);

  for (const date of allDates) {
    const previousItemId = previousEntries.get(date) ?? null;
    const nextItemId = nextEntries.get(date) ?? null;

    if (previousItemId === nextItemId) {
      continue;
    }

    if (previousItemId) {
      deltaByItemId.set(
        previousItemId,
        (deltaByItemId.get(previousItemId) ?? 0) + 1,
      );
    }

    if (nextItemId) {
      deltaByItemId.set(nextItemId, (deltaByItemId.get(nextItemId) ?? 0) - 1);
    }
  }

  return deltaByItemId;
}

export function validateFreezerStockDelta({
  currentQuantities,
  deltaByItemId,
}: {
  currentQuantities: Map<string, number>;
  deltaByItemId: Map<string, number>;
}) {
  for (const [freezerItemId, delta] of deltaByItemId) {
    const currentQuantity = currentQuantities.get(freezerItemId) ?? 0;
    const nextQuantity = currentQuantity + delta;

    if (nextQuantity < 0) {
      return {
        formError: "Det er ikke nok porsjoner i fryseren for valgte middager.",
        status: "INSUFFICIENT_STOCK" as const,
      };
    }
  }

  return {
    status: "OK" as const,
  };
}
