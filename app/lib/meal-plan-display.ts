export function formatMealPlanRecipeSelectLabel(title: string, tags: string[]) {
  const cleaned = tags.map((tag) => tag.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    return title;
  }

  return `${title} · ${cleaned.join(", ")}`;
}

export function formatMealPlanWindow(startDate: string, endDate: string) {
  const formatter = new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  return `${formatter.format(new Date(`${startDate}T00:00:00.000Z`))} - ${formatter.format(
    new Date(`${endDate}T00:00:00.000Z`),
  )}`;
}

export function formatWeekdayLabel(date: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    timeZone: "UTC",
    weekday: "long",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export function formatShortDateLabel(date: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

type DinnerMenuEntry = {
  freezerItem?: {
    label: string;
  } | null;
  freezerItemId?: string | null;
  note: string | null;
  recipe?: {
    title: string;
  } | null;
  recipeId: string | null;
};

export function getDinnerMenuLabel(entry: DinnerMenuEntry | null | undefined) {
  if (entry?.recipe?.title) {
    return entry.recipe.title;
  }

  if (entry?.freezerItem?.label) {
    return entry.freezerItem.label;
  }

  const trimmedNote = entry?.note?.trim() ?? "";

  if (trimmedNote) {
    return trimmedNote.length > 48 ? `${trimmedNote.slice(0, 48)}…` : trimmedNote;
  }

  return "Ikke planlagt";
}

export function encodeMealSelection({
  freezerItemId,
  recipeId,
}: {
  freezerItemId: string;
  recipeId: string;
}) {
  if (recipeId) {
    return `recipe:${recipeId}`;
  }

  if (freezerItemId) {
    return `freezer:${freezerItemId}`;
  }

  return "";
}

export function parseMealSelection(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("recipe:")) {
    return {
      freezerItemId: "",
      recipeId: trimmed.slice("recipe:".length),
    };
  }

  if (trimmed.startsWith("freezer:")) {
    return {
      freezerItemId: trimmed.slice("freezer:".length),
      recipeId: "",
    };
  }

  return {
    freezerItemId: "",
    recipeId: "",
  };
}

/** Swap or move encoded meal selections between two fixed dates (dates stay put). */
export function swapOrMoveMealSelection(
  selections: Record<string, string>,
  fromDate: string,
  toDate: string,
): Record<string, string> {
  if (fromDate === toDate) {
    return selections;
  }

  const fromSelection = selections[fromDate] ?? "";
  if (!fromSelection) {
    return selections;
  }

  const toSelection = selections[toDate] ?? "";

  return {
    ...selections,
    [fromDate]: toSelection,
    [toDate]: fromSelection,
  };
}
