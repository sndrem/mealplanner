export function formatGeneratedQuantityBadge(item: {
  occurrenceCount?: number;
  quantityLabel: string | null;
  sourceType: string;
}) {
  if (item.sourceType !== "GENERATED") {
    return item.quantityLabel;
  }

  if (item.quantityLabel) {
    return item.quantityLabel;
  }

  if ((item.occurrenceCount ?? 1) > 1) {
    return "Varierende mengder";
  }

  return null;
}

export function formatGeneratedOccurrenceAttribution(
  occurrences: Array<{ date: string | null; recipeTitle: string }>,
) {
  const labels = occurrences.map((occurrence) =>
    occurrence.date
      ? `${occurrence.recipeTitle} ${formatDateLabelInSummary(occurrence.date)}`
      : `${occurrence.recipeTitle} (denne uken)`,
  );

  return formatNorwegianList(labels);
}

function formatNorwegianList(items: string[]) {
  if (items.length === 0) {
    return null;
  }

  if (items.length === 1) {
    return items[0]!;
  }

  if (items.length === 2) {
    return `${items[0]} og ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")} og ${items.at(-1)}`;
}

export function formatGeneratedItemSummary(item: {
  firstDate: string | null;
  lastDate: string | null;
  occurrenceCount: number;
  occurrences: Array<{ date: string | null; recipeTitle: string }>;
  sourceType: string;
}) {
  if (item.sourceType !== "GENERATED") {
    return null;
  }

  if (item.occurrenceCount === 1) {
    const occurrence = item.occurrences[0];
    const recipeTitle = occurrence?.recipeTitle;

    if (!recipeTitle) {
      return null;
    }

    if (!occurrence.date) {
      return `Fra ${recipeTitle}. Denne uken.`;
    }

    return `Fra ${recipeTitle}. Planlagt ${formatDateLabelInSummary(occurrence.date)}.`;
  }

  const occurrenceAttribution = formatGeneratedOccurrenceAttribution(
    item.occurrences,
  );

  if (!occurrenceAttribution) {
    return null;
  }

  if (!item.firstDate || !item.lastDate) {
    return `Brukt i ${occurrenceAttribution}. Denne uken.`;
  }

  return `Brukt i ${occurrenceAttribution}. Planlagt ${formatDateLabelInSummary(item.firstDate)}–${formatDateLabelInSummary(item.lastDate)}.`;
}

export function formatOccurrenceSourceLine(occurrence: {
  date: string | null;
  quantityLabel: string | null;
  recipeTitle: string;
}) {
  const when = occurrence.date
    ? formatDateLabelInSummary(occurrence.date)
    : "Denne uken";
  const base = `${when}: ${occurrence.recipeTitle}`;

  return occurrence.quantityLabel
    ? `${base} · ${occurrence.quantityLabel}`
    : base;
}

export function formatCompactShoppingSourceLine(item: {
  buyOnDate?: string | null;
  occurrenceCount?: number;
  occurrences?: Array<{ date: string | null; recipeTitle: string }>;
  sourceType: string;
}) {
  if (item.sourceType === "GENERATED") {
    const occurrences = item.occurrences ?? [];

    if (item.occurrenceCount === 1) {
      const recipeTitle = occurrences[0]?.recipeTitle;
      return recipeTitle ? `Fra ${recipeTitle}` : null;
    }

    const occurrenceAttribution =
      formatGeneratedOccurrenceAttribution(occurrences);

    return occurrenceAttribution ? `Brukt i ${occurrenceAttribution}` : null;
  }

  if (item.sourceType === "FAMILY") {
    return "Alltid på listen";
  }

  if (item.buyOnDate) {
    return `Manuell · Kjøpes ${formatCompactDateLabel(item.buyOnDate)}`;
  }

  return "Manuell";
}

function formatCompactDateLabel(value: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatDateLabelInSummary(value: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}
