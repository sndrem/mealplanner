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

export function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [yearValue, monthValue, dayValue] = value.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    return null;
  }

  return parsedDate;
}

export function isPlanDateToday(
  planDate: string,
  referenceDate = new Date(),
) {
  return planDate === formatDateOnly(referenceDate);
}

const MS_PER_UTC_DAY = 86_400_000;

export function differenceInUtcDateOnlyDays(fromDate: string, toDate: string) {
  const from = Date.parse(`${fromDate}T00:00:00.000Z`);
  const to = Date.parse(`${toDate}T00:00:00.000Z`);

  return Math.round((to - from) / MS_PER_UTC_DAY);
}
