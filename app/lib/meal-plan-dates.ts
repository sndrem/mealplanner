export const MEAL_PLAN_MAX_SPAN_DAYS = 14;

export function getMealPlanMaxSpanMessage() {
  return `Datointervallet kan være maks ${MEAL_PLAN_MAX_SPAN_DAYS} dager.`;
}

export function formatDateOnly(date: Date) {
  return [
    date.getUTCFullYear().toString().padStart(4, "0"),
    (date.getUTCMonth() + 1).toString().padStart(2, "0"),
    date.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
}

export function isPlanDateToday(
  planDate: string,
  referenceDate = new Date(),
) {
  return planDate === formatDateOnly(referenceDate);
}
