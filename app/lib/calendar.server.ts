import { Prisma } from "@prisma/client";

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
  note: string | null;
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

  if (entry.note) {
    return {
      description: null,
      ingredients: [],
      title: entry.note,
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

export function getFamilyCalendarName(familyName: string) {
  return `Mealplanner - ${familyName}`;
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
