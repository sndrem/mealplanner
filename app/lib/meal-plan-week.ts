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

export type MealPlanTimeStatus = "active" | "upcoming" | "past";

export function isMealPlanPast(endDate: string, today = getTodayDateOnly()) {
  return endDate < today;
}

export function getMealPlanTimeStatus(
  startDate: string,
  endDate: string,
  today = getTodayDateOnly(),
): MealPlanTimeStatus {
  if (isMealPlanPast(endDate, today)) {
    return "past";
  }

  if (startDate > today) {
    return "upcoming";
  }

  return "active";
}

export function partitionMealPlansByTimeStatus<T extends DateRange>(
  plans: T[],
  today = getTodayDateOnly(),
) {
  const active: T[] = [];
  const upcoming: T[] = [];
  const past: T[] = [];

  for (const plan of plans) {
    const status = getMealPlanTimeStatus(plan.startDate, plan.endDate, today);

    if (status === "active") {
      active.push(plan);
    } else if (status === "upcoming") {
      upcoming.push(plan);
    } else {
      past.push(plan);
    }
  }

  active.sort((a, b) => {
    if (a.startDate === b.startDate) {
      return b.endDate.localeCompare(a.endDate);
    }

    return b.startDate.localeCompare(a.startDate);
  });

  upcoming.sort((a, b) => {
    if (a.startDate === b.startDate) {
      return a.endDate.localeCompare(b.endDate);
    }

    return a.startDate.localeCompare(b.startDate);
  });

  past.sort((a, b) => {
    if (a.endDate === b.endDate) {
      return b.startDate.localeCompare(a.startDate);
    }

    return b.endDate.localeCompare(a.endDate);
  });

  return { active, upcoming, past };
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

export function getNextCalendarWeekBounds(
  referenceDate = new Date(),
  timeZone = "Europe/Oslo",
): CalendarWeekBounds {
  const currentWeek = getCalendarWeekBounds(referenceDate, timeZone);

  return {
    weekEnd: addDaysToDateOnly(currentWeek.weekEnd, 7),
    weekStart: addDaysToDateOnly(currentWeek.weekStart, 7),
  };
}

export function getIsoWeekNumber(dateOnly: string) {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));

  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

export function formatMealPlanAutoTitle(startDate: string) {
  if (!startDate) {
    return "";
  }

  return `Uke ${getIsoWeekNumber(startDate)}`;
}

export function resolveAutoMealPlanTitle({
  currentTitle,
  previousAutoTitle,
  startDate,
}: {
  currentTitle: string;
  previousAutoTitle: string;
  startDate: string;
}) {
  const nextAutoTitle = formatMealPlanAutoTitle(startDate);

  if (currentTitle === "" || currentTitle === previousAutoTitle) {
    return nextAutoTitle;
  }

  return currentTitle;
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
