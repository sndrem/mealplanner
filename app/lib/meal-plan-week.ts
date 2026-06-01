import { formatDateOnly } from "./meal-plan-dates";

const ISO_WEEKDAY_BY_SHORT_LABEL: Record<string, number> = {
  Fri: 5,
  Mon: 1,
  Sat: 6,
  Sun: 7,
  Thu: 4,
  Tue: 2,
  Wed: 3,
};

export type CalendarWeekBounds = {
  weekEnd: string;
  weekStart: string;
};

export type DateRange = {
  endDate: string;
  startDate: string;
};

function formatDateOnlyInTimeZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).format(date);
}

export function getTodayDateOnly(timeZone = "Europe/Oslo") {
  return formatDateOnlyInTimeZone(new Date(), timeZone);
}

export function isMealPlanPast(endDate: string, today = getTodayDateOnly()) {
  return endDate < today;
}

function getIsoWeekdayInTimeZone(date: Date, timeZone: string) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);

  return ISO_WEEKDAY_BY_SHORT_LABEL[weekday] ?? 1;
}

function addDaysToDateOnly(dateOnly: string, days: number) {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return formatDateOnly(date);
}

export function getCalendarWeekBounds(
  referenceDate = new Date(),
  timeZone = "Europe/Oslo",
): CalendarWeekBounds {
  const zonedDate = formatDateOnlyInTimeZone(referenceDate, timeZone);
  const weekday = getIsoWeekdayInTimeZone(referenceDate, timeZone);

  return {
    weekEnd: addDaysToDateOnly(zonedDate, 7 - weekday),
    weekStart: addDaysToDateOnly(zonedDate, -(weekday - 1)),
  };
}

export function dateRangesOverlap(
  rangeAStart: string,
  rangeAEnd: string,
  rangeBStart: string,
  rangeBEnd: string,
) {
  return rangeAStart <= rangeBEnd && rangeAEnd >= rangeBStart;
}

export function filterMealPlansOverlappingWeek<T extends DateRange>(
  plans: T[],
  weekBounds: CalendarWeekBounds,
) {
  return plans.filter((plan) =>
    dateRangesOverlap(
      plan.startDate,
      plan.endDate,
      weekBounds.weekStart,
      weekBounds.weekEnd,
    ),
  );
}

export function getCalendarWeekDates(weekBounds: CalendarWeekBounds) {
  const dates: string[] = [];
  let current = weekBounds.weekStart;

  while (current <= weekBounds.weekEnd) {
    dates.push(current);
    current = addDaysToDateOnly(current, 1);
  }

  return dates;
}
