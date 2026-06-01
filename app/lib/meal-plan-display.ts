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

  const trimmedNote = entry?.note?.trim() ?? "";

  if (trimmedNote) {
    return trimmedNote.length > 48 ? `${trimmedNote.slice(0, 48)}…` : trimmedNote;
  }

  return "Ikke planlagt";
}
