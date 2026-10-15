import { differenceInUtcDateOnlyDays } from "./meal-plan-dates";

export type StoreModeRecipeUrgencyStep = "soon" | "upcoming";

export function resolveStoreModeRecipeUrgency({
  checked,
  earliestDate,
  postponedUntilDate,
  sourceType,
  todayDateOnly,
}: {
  checked: boolean;
  earliestDate: string | null;
  postponedUntilDate: string | null;
  sourceType: string;
  todayDateOnly: string;
}): {
  label: "i dag" | "i morgen" | null;
  step: StoreModeRecipeUrgencyStep | null;
} {
  if (
    checked ||
    sourceType !== "GENERATED" ||
    postponedUntilDate ||
    !earliestDate
  ) {
    return { label: null, step: null };
  }

  const daysUntil = differenceInUtcDateOnlyDays(todayDateOnly, earliestDate);

  if (!Number.isFinite(daysUntil) || daysUntil < 0 || daysUntil > 4) {
    return { label: null, step: null };
  }

  if (daysUntil <= 1) {
    return {
      label: daysUntil === 0 ? "i dag" : "i morgen",
      step: "soon",
    };
  }

  return { label: null, step: "upcoming" };
}
