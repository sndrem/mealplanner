import { MealType, Prisma } from "@prisma/client";

import { db } from "./db.server";
import { requireFamilyMembership } from "./family.server";

const CALENDAR_TIME_ZONE = "Europe/Oslo";
const DINNER_END_HOUR = 17;
const DINNER_START_HOUR = 16;

const mealPlanCalendarSelect = Prisma.validator<Prisma.MealPlanSelect>()({
  endDate: true,
  entries: {
    orderBy: [{ date: "asc" }],
    select: {
      date: true,
      freezerItem: {
        select: {
          label: true,
          note: true,
        },
      },
      freezerItemId: true,
      recipe: {
        select: {
          description: true,
          title: true,
        },
      },
      recipeId: true,
    },
    where: {
      mealType: MealType.DINNER,
    },
  },
  id: true,
  startDate: true,
  title: true,
});

export interface CalendarEventInput {
  date: string;
  description: string;
  title: string;
  uid: string;
}

interface MealPlanCalendarExportInput {
  familyId: string;
  mealPlanId: string;
  userId: string;
}

interface MealPlanDayCalendarExportInput extends MealPlanCalendarExportInput {
  date: string;
}

interface CalendarFileResult {
  content: string;
  fileName: string;
}

export async function getMealPlanCalendarExport(
  input: MealPlanCalendarExportInput,
): Promise<CalendarFileResult> {
  const mealPlan = await getMealPlanCalendarData(input);
  const events = buildMealPlanEvents(mealPlan);

  if (!events.length) {
    throw new Response("Fant ingen planlagte middager a eksportere.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  return {
    content: createCalendarFile(getCalendarName(mealPlan.title), events),
    fileName: `${getMealPlanFileSlug(mealPlan.title)}-ukeplan.ics`,
  };
}

export async function getMealPlanDayCalendarExport(
  input: MealPlanDayCalendarExportInput,
): Promise<CalendarFileResult> {
  const mealPlan = await getMealPlanCalendarData(input);
  const requestedDate = parseDateOnly(input.date);

  if (!requestedDate || !isDateWithinRange(requestedDate, mealPlan.startDate, mealPlan.endDate)) {
    throw new Response("Fant ikke dagen i ukeplanen.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  const event = buildMealPlanEventForDate(mealPlan, input.date);

  if (!event) {
    throw new Response("Fant ingen planlagt middag denne dagen.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  return {
    content: createCalendarFile(getCalendarName(mealPlan.title), [event]),
    fileName: `${getMealPlanFileSlug(mealPlan.title)}-${input.date}.ics`,
  };
}

export function createCalendarFile(
  calendarName: string,
  events: CalendarEventInput[],
  stamp = new Date(),
): string {
  const eventContent = events.map((event) => createCalendarEvent(event, stamp)).join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mealplanner//NO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-TIMEZONE:${CALENDAR_TIME_ZONE}`,
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    eventContent,
    "END:VCALENDAR",
  ].join("\r\n");
}

async function getMealPlanCalendarData({ familyId, mealPlanId, userId }: MealPlanCalendarExportInput) {
  await requireFamilyMembership({
    familyId,
    userId,
  });

  const mealPlan = await db.mealPlan.findFirst({
    select: mealPlanCalendarSelect,
    where: {
      familyId,
      id: mealPlanId,
    },
  });

  if (!mealPlan) {
    throw new Response("Fant ikke ukeplanen.", {
      status: 404,
      statusText: "Not Found",
    });
  }

  return mealPlan;
}

function buildMealPlanEvents(mealPlan: Awaited<ReturnType<typeof getMealPlanCalendarData>>) {
  return mealPlan.entries.flatMap((entry) => {
    const date = formatDateOnly(entry.date);
    const meal = getCalendarMealDetails(entry);

    if (!meal) {
      return [];
    }

    return [
      createMealPlanEvent({
        date,
        description: meal.description,
        mealPlanId: mealPlan.id,
        mealPlanTitle: mealPlan.title,
        title: meal.title,
      }),
    ];
  });
}

function buildMealPlanEventForDate(
  mealPlan: Awaited<ReturnType<typeof getMealPlanCalendarData>>,
  date: string,
) {
  const entry = mealPlan.entries.find((mealPlanEntry) => formatDateOnly(mealPlanEntry.date) === date);
  const meal = entry ? getCalendarMealDetails(entry) : null;

  if (!meal) {
    return null;
  }

  return createMealPlanEvent({
    date,
    description: meal.description,
    mealPlanId: mealPlan.id,
    mealPlanTitle: mealPlan.title,
    title: meal.title,
  });
}

function getCalendarMealDetails(
  entry: Awaited<ReturnType<typeof getMealPlanCalendarData>>["entries"][number],
) {
  if (entry.recipeId && entry.recipe) {
    return {
      description: entry.recipe.description,
      title: entry.recipe.title,
    };
  }

  if (entry.freezerItemId && entry.freezerItem) {
    return {
      description: entry.freezerItem.note,
      title: entry.freezerItem.label,
    };
  }

  return null;
}

function createMealPlanEvent({
  date,
  description,
  mealPlanId,
  mealPlanTitle,
  title,
}: {
  date: string;
  description: string | null;
  mealPlanId: string;
  mealPlanTitle: string;
  title: string;
}): CalendarEventInput {
  return {
    date,
    description: createMealPlanDescription(date, mealPlanTitle, description),
    title: `Middag: ${title}`,
    uid: `${mealPlanId}-${date}@mealplanner`,
  };
}

function createCalendarEvent(event: CalendarEventInput, stamp: Date) {
  const startDateTime = formatIcsLocalDateTime(event.date, DINNER_START_HOUR);
  const endDateTime = formatIcsLocalDateTime(event.date, DINNER_END_HOUR);

  return [
    "BEGIN:VEVENT",
    `UID:${escapeText(event.uid)}`,
    `DTSTAMP:${formatDateTimeStamp(stamp)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DTSTART;TZID=${CALENDAR_TIME_ZONE}:${startDateTime}`,
    `DTEND;TZID=${CALENDAR_TIME_ZONE}:${endDateTime}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    "END:VEVENT",
  ].join("\r\n");
}

function createMealPlanDescription(date: string, mealPlanTitle: string, recipeDescription: string | null) {
  const formattedDate = new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
  }).format(parseDateOnly(date)!);
  const normalizedDescription = recipeDescription?.trim() || "Ingen beskrivelse.";

  return `Planlagt for ${formattedDate} i ${mealPlanTitle}. ${normalizedDescription}`;
}

function getCalendarName(mealPlanTitle: string) {
  return `Mealplanner - ${mealPlanTitle}`;
}

function getMealPlanFileSlug(mealPlanTitle: string) {
  const slug = mealPlanTitle
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");

  return slug || "meal-plan";
}

function formatDateOnly(date: Date) {
  return [
    date.getUTCFullYear().toString().padStart(4, "0"),
    (date.getUTCMonth() + 1).toString().padStart(2, "0"),
    date.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
}

function parseDateOnly(value: string) {
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

function isDateWithinRange(date: Date, startDate: Date, endDate: Date) {
  return date.getTime() >= startDate.getTime() && date.getTime() <= endDate.getTime();
}

function formatIcsDate(value: string) {
  return value.replaceAll("-", "");
}

function formatIcsLocalDateTime(value: string, hour: number) {
  return `${formatIcsDate(value)}T${hour.toString().padStart(2, "0")}0000`;
}

function formatDateTimeStamp(value: Date) {
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${value.getUTCDate()}`.padStart(2, "0");
  const hours = `${value.getUTCHours()}`.padStart(2, "0");
  const minutes = `${value.getUTCMinutes()}`.padStart(2, "0");
  const seconds = `${value.getUTCSeconds()}`.padStart(2, "0");

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function escapeText(value: string) {
  return value
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\n", "\\n");
}
