import { MealType, Prisma } from "@prisma/client";

import { db } from "./db.server";
import { requireFamilyMembership } from "./family.server";

const CALENDAR_TIME_ZONE = "Europe/Oslo";
const DINNER_END_HOUR = 17;
const DINNER_START_HOUR = 16;

export const calendarRecipeSelect = Prisma.validator<Prisma.RecipeSelect>()({
  description: true,
  ingredients: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      amount: true,
      displayName: true,
      unit: true,
    },
  },
  title: true,
});

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
        select: calendarRecipeSelect,
      },
      recipeId: true,
      updatedAt: true,
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
  lastModified?: Date;
  title: string;
  uid: string;
}

export interface CreateCalendarFileOptions {
  includeRefreshInterval?: boolean;
  useEventTimestamps?: boolean;
}

export interface CalendarRecipeIngredient {
  amount: string | null;
  displayName: string;
  unit: string | null;
}

export interface CalendarMealEntry {
  freezerItem: {
    label: string;
    note: string | null;
  } | null;
  freezerItemId: string | null;
  recipe: {
    description: string | null;
    ingredients: CalendarRecipeIngredient[];
    title: string;
  } | null;
  recipeId: string | null;
}

const EUROPE_OSLO_VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${CALENDAR_TIME_ZONE}`,
  `X-LIC-LOCATION:${CALENDAR_TIME_ZONE}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
].join("\r\n");

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
  options: CreateCalendarFileOptions = {},
): string {
  const eventContent = events
    .map((event) => createCalendarEvent(event, stamp, options.useEventTimestamps))
    .join("\r\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mealplanner//NO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  if (options.includeRefreshInterval) {
    lines.push("REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H");
  }

  lines.push(
    `X-WR-TIMEZONE:${CALENDAR_TIME_ZONE}`,
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    EUROPE_OSLO_VTIMEZONE,
  );

  if (eventContent) {
    lines.push(eventContent);
  }

  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
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
      createMealPlanCalendarEvent({
        date,
        description: meal.description,
        ingredients: meal.ingredients,
        lastModified: entry.updatedAt,
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

  if (!entry || !meal) {
    return null;
  }

  return createMealPlanCalendarEvent({
    date,
    description: meal.description,
    ingredients: meal.ingredients,
    lastModified: entry.updatedAt,
    mealPlanId: mealPlan.id,
    mealPlanTitle: mealPlan.title,
    title: meal.title,
  });
}

export function getCalendarMealDetails(entry: CalendarMealEntry) {
  if (entry.recipeId && entry.recipe) {
    return {
      description: entry.recipe.description,
      ingredients: entry.recipe.ingredients ?? [],
      title: entry.recipe.title,
    };
  }

  if (entry.freezerItemId && entry.freezerItem) {
    return {
      description: entry.freezerItem.note,
      ingredients: [],
      title: entry.freezerItem.label,
    };
  }

  return null;
}

export function createMealPlanCalendarEvent({
  date,
  description,
  ingredients = [],
  lastModified,
  mealPlanId,
  mealPlanTitle,
  title,
}: {
  date: string;
  description: string | null;
  ingredients?: CalendarRecipeIngredient[];
  lastModified?: Date;
  mealPlanId: string;
  mealPlanTitle: string;
  title: string;
}): CalendarEventInput {
  return {
    date,
    description: createMealPlanDescription(date, mealPlanTitle, description, ingredients),
    lastModified,
    title: `Middag: ${title}`,
    uid: `${mealPlanId}-${date}@mealplanner`,
  };
}

function createCalendarEvent(
  event: CalendarEventInput,
  stamp: Date,
  useEventTimestamps = false,
) {
  const startDateTime = formatIcsLocalDateTime(event.date, DINNER_START_HOUR);
  const endDateTime = formatIcsLocalDateTime(event.date, DINNER_END_HOUR);
  const stampSource =
    useEventTimestamps && event.lastModified ? event.lastModified : stamp;
  const lines = [
    "BEGIN:VEVENT",
    `UID:${escapeText(event.uid)}`,
    `DTSTAMP:${formatDateTimeStamp(stampSource)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DTSTART;TZID=${CALENDAR_TIME_ZONE}:${startDateTime}`,
    `DTEND;TZID=${CALENDAR_TIME_ZONE}:${endDateTime}`,
    `DESCRIPTION:${escapeText(event.description)}`,
  ];

  if (event.lastModified) {
    lines.push(`LAST-MODIFIED:${formatDateTimeStamp(event.lastModified)}`);
  }

  lines.push("END:VEVENT");

  return lines.join("\r\n");
}

function createMealPlanDescription(
  date: string,
  mealPlanTitle: string,
  recipeDescription: string | null,
  ingredients: CalendarRecipeIngredient[] = [],
) {
  const formattedDate = new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
  }).format(parseDateOnly(date)!);
  const normalizedDescription = recipeDescription?.trim() || "Ingen beskrivelse.";
  const preamble = `Planlagt for ${formattedDate} i ${mealPlanTitle}.`;
  const ingredientLines = ingredients
    .map((ingredient) => formatCalendarIngredientLine(ingredient))
    .filter((line) => line.length > 0);

  if (ingredientLines.length === 0) {
    return `${preamble}\n\n${normalizedDescription}`;
  }

  return [
    preamble,
    "",
    "Ingredienser:",
    ...ingredientLines.map((line) => `- ${line}`),
    "",
    "Beskrivelse:",
    normalizedDescription,
  ].join("\n");
}

function formatCalendarIngredientLine(ingredient: CalendarRecipeIngredient) {
  const quantity = [ingredient.amount, ingredient.unit]
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0)
    .join(" ");
  const displayName = ingredient.displayName.trim();

  return [quantity, displayName].filter((value) => value.length > 0).join(" ");
}

function getCalendarName(mealPlanTitle: string) {
  return `Mealplanner - ${mealPlanTitle}`;
}

export function getFamilyCalendarName(familyName: string) {
  return `Mealplanner - ${familyName}`;
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
